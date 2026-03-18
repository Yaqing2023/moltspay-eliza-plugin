/**
 * MoltsPayClient - Pay for AI Agent services
 *
 * Uses x402 protocol for gasless, pay-for-success payments.
 * Wallet is stored in ~/.moltspay/wallet.json (created via MOLTSPAY_INIT).
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  chmodSync,
} from "fs";
import { homedir } from "os";
import { join } from "path";
import { Wallet, JsonRpcProvider, Contract, formatUnits } from "ethers";
import { getChain, networkToChainName } from "./chains.js";
import {
  signEIP3009,
  createPaymentPayload,
  parsePaymentRequired,
  encodePaymentHeader,
  findRequirementForChain,
} from "./x402.js";
import type {
  ChainName,
  TokenSymbol,
  ClientConfig,
  WalletData,
  SpendingData,
  ServicesResponse,
  ServiceInfo,
  BalanceInfo,
  AllBalances,
  PayOptions,
  PayResult,
  TransactionRecord,
  InitResult,
} from "../types.js";

// MoltsPay marketplace base URL
const MOLTSPAY_REGISTRY = "https://moltspay.com";

// Headers
const PAYMENT_REQUIRED_HEADER = "x-payment-required";
const PAYMENT_HEADER = "x-payment";

// Default configuration
const DEFAULT_CONFIG: ClientConfig = {
  chain: "base",
  limits: {
    maxPerTx: 10,
    maxPerDay: 100,
  },
};

// ERC20 ABI for balance checks
const ERC20_BALANCE_ABI = [
  "function balanceOf(address account) view returns (uint256)",
];

export interface MoltsPayClientOptions {
  configDir?: string; // Default: ~/.moltspay
}

export class MoltsPayClient {
  private configDir: string;
  private config: ClientConfig;
  private walletData: WalletData | null = null;
  private wallet: Wallet | null = null;
  private todaySpending: number = 0;
  private lastSpendingReset: number = 0;

  constructor(options: MoltsPayClientOptions = {}) {
    this.configDir = options.configDir || join(homedir(), ".moltspay");
    this.config = this.loadConfig();

    // Load wallet from disk only
    this.walletData = this.loadWallet();
    if (this.walletData) {
      this.wallet = new Wallet(this.walletData.privateKey);
    }

    this.loadSpending();
  }

  /**
   * Check if client is initialized (has wallet)
   */
  get isInitialized(): boolean {
    return this.wallet !== null;
  }

  /**
   * Get wallet address
   */
  get address(): string | null {
    return this.wallet?.address || null;
  }

  /**
   * Get current configuration
   */
  getConfig(): ClientConfig {
    return { ...this.config };
  }

  /**
   * Get today's spending
   */
  getTodaySpending(): number {
    this.checkSpendingReset();
    return this.todaySpending;
  }

  /**
   * Update configuration (limits)
   */
  updateConfig(updates: Partial<ClientConfig["limits"]>): void {
    if (updates.maxPerTx !== undefined) {
      this.config.limits.maxPerTx = updates.maxPerTx;
    }
    if (updates.maxPerDay !== undefined) {
      this.config.limits.maxPerDay = updates.maxPerDay;
    }
    this.saveConfig();
  }

  /**
   * Initialize new wallet (static method)
   */
  static init(
    configDir: string,
    options: { chain: ChainName; maxPerTx: number; maxPerDay: number }
  ): InitResult {
    mkdirSync(configDir, { recursive: true });

    // Check if already initialized
    const walletPath = join(configDir, "wallet.json");
    if (existsSync(walletPath)) {
      throw new Error(
        `Wallet already exists at ${walletPath}. Delete it first to reinitialize.`
      );
    }

    // Create new wallet
    const wallet = Wallet.createRandom();
    const walletData: WalletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      createdAt: Date.now(),
    };

    // Save wallet with secure permissions (owner read/write only)
    writeFileSync(walletPath, JSON.stringify(walletData, null, 2), {
      mode: 0o600,
    });

    // Ensure permissions on existing file (for non-Unix systems)
    try {
      chmodSync(walletPath, 0o600);
    } catch {
      // Ignore chmod errors on Windows
    }

    // Save config
    const config: ClientConfig = {
      chain: options.chain,
      limits: {
        maxPerTx: options.maxPerTx,
        maxPerDay: options.maxPerDay,
      },
    };
    const configPath = join(configDir, "config.json");
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    return {
      address: wallet.address,
      configDir,
      chain: options.chain,
      limits: config.limits,
    };
  }

  /**
   * Get services from a provider
   */
  async getServices(serverUrl: string): Promise<ServicesResponse> {
    // Normalize URL
    const normalizedUrl = serverUrl.replace(
      /\/(services|api\/services|\.well-known\/agent-services\.json)\/?$/,
      ""
    );

    // Try endpoints in order
    const endpoints = [
      "/services",
      "/registry/services",
      "/.well-known/agent-services.json",
      "/api/services",
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${normalizedUrl}${endpoint}`);
        if (!res.ok) continue;

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) continue;

        return (await res.json()) as ServicesResponse;
      } catch {
        continue;
      }
    }

    throw new Error(`Failed to get services from ${normalizedUrl}`);
  }

  /**
   * Search services on MoltsPay marketplace
   */
  async searchServices(query?: string): Promise<ServiceInfo[]> {
    try {
      // Use /registry/services for both listing and search
      // Note: /api/search returns HTML frontend, not JSON
      const url = query
        ? `${MOLTSPAY_REGISTRY}/registry/services?q=${encodeURIComponent(query)}`
        : `${MOLTSPAY_REGISTRY}/registry/services`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to search services: ${res.status}`);
      }

      // Verify we got JSON, not HTML
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("API returned non-JSON response");
      }

      const data = (await res.json()) as { services: ServiceInfo[] };
      return data.services || [];
    } catch (error) {
      throw new Error(`Failed to search services: ${(error as Error).message}`);
    }
  }

  /**
   * Find services by name on MoltsPay marketplace
   * Returns all providers that offer this service
   */
  async findServicesByName(serviceName: string): Promise<ServiceInfo[]> {
    const allServices = await this.searchServices();
    
    // Case-insensitive match on service name
    const matches = allServices.filter((s) =>
      s.name.toLowerCase().includes(serviceName.toLowerCase())
    );

    return matches;
  }

  /**
   * Get provider endpoint URL from username
   */
  getProviderEndpoint(username: string): string {
    return `${MOLTSPAY_REGISTRY}/a/${username}`;
  }

  /**
   * Pay for a service using x402 protocol
   *
   * This is GASLESS for the client - only signs, never pays gas.
   * This is PAY-FOR-SUCCESS - payment only claimed if service succeeds.
   */
  async pay(
    serverUrl: string,
    service: string,
    params: Record<string, unknown>,
    options: PayOptions = {}
  ): Promise<PayResult> {
    if (!this.wallet) {
      return { success: false, error: "Client not initialized. Run MOLTSPAY_INIT first." };
    }

    const token = options.token || "USDC";

    try {
      // Step 1: Initial request without payment
      const requestBody: Record<string, unknown> = { service, params };
      if (options.chain) {
        requestBody.chain = options.chain;
      }

      const initialRes = await fetch(`${serverUrl}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // If not 402, check for success or error
      if (initialRes.status !== 402) {
        if (initialRes.ok) {
          const data = (await initialRes.json()) as { result?: Record<string, unknown> };
          return { success: true, result: data.result };
        }
        const error = (await initialRes.json()) as { error?: string };
        return { success: false, error: error.error || `Unexpected response: ${initialRes.status}` };
      }

      // Step 2: Parse payment requirements from 402 response
      const paymentRequiredHeader = initialRes.headers.get(PAYMENT_REQUIRED_HEADER);
      if (!paymentRequiredHeader) {
        return { success: false, error: "Missing x-payment-required header" };
      }

      const requirements = parsePaymentRequired(paymentRequiredHeader);

      // Determine chain
      let chain: ChainName;
      if (options.chain) {
        chain = options.chain;
      } else {
        // Find first supported chain
        const serverChains = requirements
          .map((r) => networkToChainName(r.network))
          .filter((c): c is ChainName => c !== null);

        if (serverChains.length === 0) {
          return { success: false, error: "No supported chains in payment requirements" };
        }

        // Prefer user's default chain if server supports it
        if (serverChains.includes(this.config.chain)) {
          chain = this.config.chain;
        } else {
          chain = serverChains[0];
        }
      }

      const req = findRequirementForChain(requirements, chain);
      if (!req) {
        return { success: false, error: `Server doesn't accept payments on ${chain}` };
      }

      // Step 3: Check limits
      const amountRaw = req.amount || req.maxAmountRequired;
      if (!amountRaw) {
        return { success: false, error: "Missing amount in payment requirements" };
      }
      const amount = Number(amountRaw) / 1e6;

      const limitError = this.checkLimits(amount);
      if (limitError) {
        return { success: false, error: limitError };
      }

      // Step 4: Sign EIP-3009 authorization (GASLESS)
      const chainConfig = getChain(chain);
      const payTo = req.payTo || req.resource;
      if (!payTo) {
        return { success: false, error: "Missing payTo address" };
      }

      const authorization = await signEIP3009(
        this.wallet,
        payTo,
        amount,
        chainConfig,
        token,
        req.extra
      );

      // Step 5: Create payment payload
      const payload = createPaymentPayload(authorization, chain, token, req);
      const paymentHeader = encodePaymentHeader(payload);

      // Step 6: Retry with payment header
      const paidRequestBody: Record<string, unknown> = { service, params };
      if (options.chain) {
        paidRequestBody.chain = options.chain;
      }

      const paidRes = await fetch(`${serverUrl}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [PAYMENT_HEADER]: paymentHeader,
        },
        body: JSON.stringify(paidRequestBody),
      });

      const result = (await paidRes.json()) as {
        result?: Record<string, unknown>;
        error?: string;
        payment?: { txHash?: string };
      };

      if (!paidRes.ok) {
        return { success: false, error: result.error || "Service execution failed" };
      }

      // Record spending and transaction
      this.recordSpending(amount);
      this.recordTransaction({
        timestamp: Date.now(),
        chain,
        service,
        provider: serverUrl,
        amount,
        token,
        status: "confirmed",
        hash: result.payment?.txHash,
      });

      return {
        success: true,
        result: result.result,
        payment: {
          amount,
          token,
          chain,
          txHash: result.payment?.txHash,
        },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get wallet balance on default chain
   */
  async getBalance(): Promise<BalanceInfo> {
    if (!this.wallet) {
      throw new Error("Client not initialized");
    }

    return this.getBalanceOnChain(this.config.chain);
  }

  /**
   * Get balance on specific chain
   */
  async getBalanceOnChain(chainName: ChainName): Promise<BalanceInfo> {
    if (!this.wallet) {
      throw new Error("Client not initialized");
    }

    const chain = getChain(chainName);
    
    // Create provider with static network to avoid detection calls
    const provider = new JsonRpcProvider(chain.rpc, chain.chainId, {
      staticNetwork: true,
    });

    try {
      const [nativeBalance, usdcBalance, usdtBalance] = await Promise.all([
        provider.getBalance(this.wallet.address).catch(() => BigInt(0)),
        chain.tokens.USDC
          ? new Contract(
              chain.tokens.USDC.address,
              ERC20_BALANCE_ABI,
              provider
            ).balanceOf(this.wallet.address).catch(() => BigInt(0))
          : Promise.resolve(BigInt(0)),
        chain.tokens.USDT
          ? new Contract(
              chain.tokens.USDT.address,
              ERC20_BALANCE_ABI,
              provider
            ).balanceOf(this.wallet.address).catch(() => BigInt(0))
          : Promise.resolve(BigInt(0)),
      ]);

      return {
        usdc: chain.tokens.USDC
          ? parseFloat(formatUnits(usdcBalance, chain.tokens.USDC.decimals))
          : 0,
        usdt: chain.tokens.USDT
          ? parseFloat(formatUnits(usdtBalance, chain.tokens.USDT.decimals))
          : 0,
        native: parseFloat(formatUnits(nativeBalance, 18)),
      };
    } catch {
      // Silently return zeros on RPC failure
      return { usdc: 0, usdt: 0, native: 0 };
    }
  }

  /**
   * Get balances on all supported chains
   */
  async getAllBalances(): Promise<AllBalances> {
    if (!this.wallet) {
      throw new Error("Client not initialized");
    }

    const chains: ChainName[] = ["base", "polygon", "base_sepolia"];
    const results: AllBalances = {
      base: { usdc: 0, usdt: 0, native: 0 },
      polygon: { usdc: 0, usdt: 0, native: 0 },
      base_sepolia: { usdc: 0, usdt: 0, native: 0 },
    };

    // Check balances in parallel, silently handle failures
    await Promise.allSettled(
      chains.map(async (chainName) => {
        results[chainName] = await this.getBalanceOnChain(chainName);
      })
    );

    return results;
  }

  /**
   * Get transaction history
   */
  getTransactions(limit: number = 10): TransactionRecord[] {
    const txPath = join(this.configDir, "transactions.json");
    if (!existsSync(txPath)) {
      return [];
    }

    try {
      const transactions: TransactionRecord[] = JSON.parse(
        readFileSync(txPath, "utf-8")
      );
      return transactions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  // --- Private methods ---

  private loadConfig(): ClientConfig {
    const configPath = join(this.configDir, "config.json");
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, "utf-8");
        return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
      } catch {
        return { ...DEFAULT_CONFIG };
      }
    }
    return { ...DEFAULT_CONFIG };
  }

  private saveConfig(): void {
    mkdirSync(this.configDir, { recursive: true });
    const configPath = join(this.configDir, "config.json");
    writeFileSync(configPath, JSON.stringify(this.config, null, 2));
  }

  private loadWallet(): WalletData | null {
    const walletPath = join(this.configDir, "wallet.json");
    if (!existsSync(walletPath)) {
      return null;
    }

    try {
      const content = readFileSync(walletPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private loadSpending(): void {
    const spendingPath = join(this.configDir, "spending.json");
    if (!existsSync(spendingPath)) {
      return;
    }

    try {
      const data: SpendingData = JSON.parse(readFileSync(spendingPath, "utf-8"));
      const today = new Date().setHours(0, 0, 0, 0);

      if (data.date === today) {
        this.todaySpending = data.amount || 0;
        this.lastSpendingReset = data.date;
      } else {
        // Data is from previous day, reset
        this.todaySpending = 0;
        this.lastSpendingReset = today;
      }
    } catch {
      this.todaySpending = 0;
      this.lastSpendingReset = new Date().setHours(0, 0, 0, 0);
    }
  }

  private saveSpending(): void {
    mkdirSync(this.configDir, { recursive: true });
    const spendingPath = join(this.configDir, "spending.json");
    const data: SpendingData = {
      date: this.lastSpendingReset || new Date().setHours(0, 0, 0, 0),
      amount: this.todaySpending,
      updatedAt: Date.now(),
    };
    writeFileSync(spendingPath, JSON.stringify(data, null, 2));
  }

  private checkSpendingReset(): void {
    const today = new Date().setHours(0, 0, 0, 0);
    if (today > this.lastSpendingReset) {
      this.todaySpending = 0;
      this.lastSpendingReset = today;
      this.saveSpending();
    }
  }

  private checkLimits(amount: number): string | null {
    // Check per-tx limit
    if (amount > this.config.limits.maxPerTx) {
      return `Amount $${amount} exceeds max per transaction ($${this.config.limits.maxPerTx})`;
    }

    // Reset daily spending if new day
    this.checkSpendingReset();

    // Check daily limit
    if (this.todaySpending + amount > this.config.limits.maxPerDay) {
      return `Would exceed daily limit ($${this.todaySpending.toFixed(2)} + $${amount.toFixed(2)} > $${this.config.limits.maxPerDay})`;
    }

    return null;
  }

  private recordSpending(amount: number): void {
    this.todaySpending += amount;
    this.saveSpending();
  }

  private recordTransaction(tx: TransactionRecord): void {
    const txPath = join(this.configDir, "transactions.json");
    let transactions: TransactionRecord[] = [];

    if (existsSync(txPath)) {
      try {
        transactions = JSON.parse(readFileSync(txPath, "utf-8"));
      } catch {
        transactions = [];
      }
    }

    transactions.push(tx);

    // Keep only last 1000 transactions
    if (transactions.length > 1000) {
      transactions = transactions.slice(-1000);
    }

    mkdirSync(this.configDir, { recursive: true });
    writeFileSync(txPath, JSON.stringify(transactions, null, 2));
  }
}

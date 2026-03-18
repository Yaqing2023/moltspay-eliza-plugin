/**
 * MoltsPay Plugin Types
 */

// Chain types
export type ChainName = "base" | "polygon" | "base_sepolia";
export type TokenSymbol = "USDC" | "USDT";

// Client configuration (stored in ~/.moltspay/config.json)
export interface ClientConfig {
  chain: ChainName;
  limits: {
    maxPerTx: number;
    maxPerDay: number;
  };
}

// Wallet data (stored in ~/.moltspay/wallet.json)
export interface WalletData {
  address: string;
  privateKey: string;
  createdAt: number;
}

// Spending data (stored in ~/.moltspay/spending.json)
export interface SpendingData {
  date: number;
  amount: number;
  updatedAt: number;
}

// Service info from provider/registry
export interface ServiceInfo {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  type?: string;
  tags?: string[];
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  available?: boolean;
  salesCount?: number;
  rating?: {
    average: number;
    count: number;
  };
  favoriteCount?: number;
  x402_endpoint?: string;
  provider?: {
    username: string;
    name: string;
    wallet: string;
    agent?: {
      endpoint: string;
      status: string;
    };
  };
}

// Provider info
export interface ProviderInfo {
  name: string;
  username?: string;
  wallet: string;
  chains?: string[];
}

// Services response from /.well-known/agent-services.json or /services
export interface ServicesResponse {
  provider?: ProviderInfo;
  services: ServiceInfo[];
}

// Balance info for a single chain
export interface BalanceInfo {
  usdc: number;
  usdt: number;
  native: number;
}

// All balances across chains
export interface AllBalances {
  base: BalanceInfo;
  polygon: BalanceInfo;
  base_sepolia?: BalanceInfo;
}

// Status response
export interface StatusInfo {
  address: string;
  chain: ChainName;
  balances: AllBalances;
  limits: {
    maxPerTx: number;
    maxPerDay: number;
  };
  todaySpending: number;
  remainingDaily: number;
}

// Transaction record (stored in ~/.moltspay/transactions.json)
export interface TransactionRecord {
  hash?: string;
  timestamp: number;
  chain: ChainName;
  service: string;
  provider: string;
  amount: number;
  token: TokenSymbol;
  status: "pending" | "confirmed" | "failed";
}

// Pay options
export interface PayOptions {
  token?: TokenSymbol;
  chain?: ChainName;
  autoSelect?: boolean;
}

// Pay result
export interface PayResult {
  success: boolean;
  result?: Record<string, unknown>;
  payment?: {
    amount: number;
    token: TokenSymbol;
    chain: ChainName;
    txHash?: string;
  };
  error?: string;
}

// Faucet result
export interface FaucetResult {
  success: boolean;
  amount?: number;
  txHash?: string;
  error?: string;
  nextAvailable?: number;
}

// Fund result
export interface FundResult {
  url: string;
  amount: number;
  chain: ChainName;
}

// Init result
export interface InitResult {
  address: string;
  configDir: string;
  chain: ChainName;
  limits: {
    maxPerTx: number;
    maxPerDay: number;
  };
}

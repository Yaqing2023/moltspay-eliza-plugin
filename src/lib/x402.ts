/**
 * x402 Protocol Helpers
 * 
 * Implements EIP-3009 (transferWithAuthorization) for gasless payments.
 */

import { Wallet, randomBytes, hexlify } from "ethers";
import type { ChainConfig, TokenConfig } from "./chains.js";
import { getChain, chainNameToNetwork } from "./chains.js";
import type { ChainName, TokenSymbol } from "../types.js";

// x402 protocol version
const X402_VERSION = 2;

/**
 * EIP-3009 Authorization structure
 */
export interface EIP3009Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

/**
 * Payment requirement from 402 response
 */
export interface PaymentRequirement {
  scheme: string;
  network: string;
  amount?: string;
  maxAmountRequired?: string; // v1 compat
  asset?: string;
  payTo?: string;
  resource?: string; // v1 compat
  maxTimeoutSeconds?: number;
  extra?: {
    name?: string;
    version?: string;
  };
}

/**
 * x402 Payment Payload (sent in x-payment header)
 */
export interface X402PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    authorization: EIP3009Authorization;
    signature: string;
  };
  accepted: {
    scheme: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra: {
      name: string;
      version: string;
    };
  };
}

/**
 * Parse x-payment-required header from 402 response
 */
export function parsePaymentRequired(header: string): PaymentRequirement[] {
  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);

    // Handle v1 format (direct array)
    if (Array.isArray(parsed)) {
      return parsed;
    }

    // Handle v2 format ({ x402Version, accepts: [...] })
    if (parsed.accepts && Array.isArray(parsed.accepts)) {
      return parsed.accepts;
    }

    // Single requirement object
    return [parsed];
  } catch (error) {
    throw new Error(`Failed to parse x-payment-required header: ${error}`);
  }
}

/**
 * Find matching payment requirement for a chain
 */
export function findRequirementForChain(
  requirements: PaymentRequirement[],
  chain: ChainName
): PaymentRequirement | null {
  const chainConfig = getChain(chain);
  const network = `eip155:${chainConfig.chainId}`;

  return (
    requirements.find((r) => r.scheme === "exact" && r.network === network) ||
    null
  );
}

/**
 * Sign EIP-3009 transferWithAuthorization
 * 
 * This is GASLESS - only creates a signature, no on-chain transaction.
 * The server/facilitator will execute the actual transfer.
 */
export async function signEIP3009(
  wallet: Wallet,
  to: string,
  amount: number,
  chain: ChainConfig,
  token: TokenSymbol = "USDC",
  domainOverride?: { name?: string; version?: string }
): Promise<{ authorization: EIP3009Authorization; signature: string }> {
  const tokenConfig = chain.tokens[token];
  if (!tokenConfig) {
    throw new Error(`Token ${token} not supported on ${chain.name}`);
  }

  // Authorization parameters
  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour validity
  const nonce = hexlify(randomBytes(32));
  const value = BigInt(Math.floor(amount * 10 ** tokenConfig.decimals)).toString();

  const authorization: EIP3009Authorization = {
    from: wallet.address,
    to,
    value,
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
  };

  // EIP-712 domain (use server's domain override if provided)
  const domain = {
    name: domainOverride?.name || tokenConfig.eip712Name,
    version: domainOverride?.version || tokenConfig.eip712Version,
    chainId: chain.chainId,
    verifyingContract: tokenConfig.address,
  };

  // EIP-3009 types
  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  // Sign typed data (EIP-712)
  const signature = await wallet.signTypedData(domain, types, authorization);

  return { authorization, signature };
}

/**
 * Create x402 payment payload for request
 */
export function createPaymentPayload(
  auth: { authorization: EIP3009Authorization; signature: string },
  chain: ChainName,
  token: TokenSymbol,
  req: PaymentRequirement
): X402PaymentPayload {
  const chainConfig = getChain(chain);
  const tokenConfig = chainConfig.tokens[token];

  if (!tokenConfig) {
    throw new Error(`Token ${token} not available on ${chain}`);
  }

  const amountRaw = req.amount || req.maxAmountRequired || "0";
  const payTo = req.payTo || req.resource || "";

  if (!payTo) {
    throw new Error("Missing payTo address in payment requirements");
  }

  return {
    x402Version: X402_VERSION,
    scheme: "exact",
    network: chainNameToNetwork(chain),
    payload: auth,
    accepted: {
      scheme: "exact",
      network: chainNameToNetwork(chain),
      asset: tokenConfig.address,
      amount: amountRaw,
      payTo,
      maxTimeoutSeconds: req.maxTimeoutSeconds || 300,
      extra: {
        name: req.extra?.name || tokenConfig.eip712Name,
        version: req.extra?.version || tokenConfig.eip712Version,
      },
    },
  };
}

/**
 * Encode payment payload for x-payment header
 */
export function encodePaymentHeader(payload: X402PaymentPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

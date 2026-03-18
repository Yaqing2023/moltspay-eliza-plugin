/**
 * @elizaos/plugin-moltspay
 *
 * MoltsPay x402 payment plugin for ElizaOS.
 * Enables AI agents to pay for services using USDC/USDT.
 *
 * Features:
 * - Gasless payments (EIP-3009 signatures)
 * - Pay-for-success (payment only claimed on delivery)
 * - Multi-chain (Base, Polygon)
 * - Multi-token (USDC, USDT)
 * - Spending limits (per-tx and daily)
 *
 * Usage:
 *   import { moltspayPlugin } from "@elizaos/plugin-moltspay";
 *
 *   const agent = new AgentRuntime({
 *     plugins: [moltspayPlugin],
 *   });
 *
 * @packageDocumentation
 */

import type { Plugin } from "@elizaos/core";

// Actions
import {
  initAction,
  configAction,
  fundAction,
  faucetAction,
  statusAction,
  listAction,
  servicesAction,
  payAction,
} from "./actions/index.js";

// Providers
import { walletProvider } from "./providers/index.js";

// Services
import { MoltsPayService } from "./services/index.js";

/**
 * MoltsPay Plugin for ElizaOS
 *
 * Provides 8 actions for x402 payment protocol:
 * - MOLTSPAY_INIT: Initialize wallet
 * - MOLTSPAY_CONFIG: Update spending limits
 * - MOLTSPAY_FUND: Coinbase Pay onramp
 * - MOLTSPAY_FAUCET: Testnet USDC
 * - MOLTSPAY_STATUS: Wallet status & balance
 * - MOLTSPAY_LIST: Transaction history
 * - MOLTSPAY_SERVICES: Discover services
 * - MOLTSPAY_PAY: Pay for service
 */
export const moltspayPlugin: Plugin = {
  name: "moltspay",
  description: "x402 payment protocol for AI agent commerce",

  actions: [
    initAction,
    configAction,
    fundAction,
    faucetAction,
    statusAction,
    listAction,
    servicesAction,
    payAction,
  ],

  providers: [walletProvider],

  evaluators: [],

  services: [new MoltsPayService()],
};

export default moltspayPlugin;

// Re-export types for programmatic usage
export * from "./types.js";

// Re-export client for direct usage
export { MoltsPayClient, type MoltsPayClientOptions } from "./lib/client.js";

// Re-export chain utilities
export {
  getChain,
  getChainById,
  getChainNameById,
  networkToChainName,
  chainNameToNetwork,
  CHAINS,
  type ChainConfig,
  type TokenConfig,
} from "./lib/chains.js";

// Re-export x402 utilities
export {
  signEIP3009,
  parsePaymentRequired,
  createPaymentPayload,
  encodePaymentHeader,
  findRequirementForChain,
  type EIP3009Authorization,
  type PaymentRequirement,
  type X402PaymentPayload,
} from "./lib/x402.js";

// Re-export onramp utilities
export {
  generateOnrampUrl,
  requestFaucet,
  printQRCode,
  type CDPCredentials,
} from "./lib/onramp.js";

// Re-export provider
export { walletProvider, type MoltspayWalletState } from "./providers/index.js";

// Re-export service
export { MoltsPayService } from "./services/index.js";

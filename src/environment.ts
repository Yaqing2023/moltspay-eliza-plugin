/**
 * Environment configuration for MoltsPay plugin
 * 
 * Note: Private key is NOT loaded from environment.
 * It's stored in ~/.moltspay/wallet.json and created via MOLTSPAY_INIT.
 * This is intentional for security (no key exposure in env/logs).
 */

import type { IAgentRuntime } from "@elizaos/core";
import type { ChainName } from "./types.js";

export interface MoltspayEnvConfig {
  chain: ChainName;
  maxPerTx: number;
  maxPerDay: number;
  cdpApiKeyId?: string;
  cdpApiKeySecret?: string;
}

/**
 * Validate and load environment configuration
 */
export function validateEnvConfig(runtime: IAgentRuntime): MoltspayEnvConfig {
  // Get chain (default: base)
  const chainSetting = runtime.getSetting("MOLTSPAY_CHAIN") || "base";
  const validChains: ChainName[] = ["base", "polygon", "base_sepolia"];
  const chain = validChains.includes(chainSetting as ChainName)
    ? (chainSetting as ChainName)
    : "base";

  // Get limits (defaults: $10/tx, $100/day)
  const maxPerTx = parseInt(
    runtime.getSetting("MOLTSPAY_MAX_PER_TX") || "10",
    10
  );
  const maxPerDay = parseInt(
    runtime.getSetting("MOLTSPAY_MAX_PER_DAY") || "100",
    10
  );

  // CDP credentials (optional, for onramp)
  const cdpApiKeyId = runtime.getSetting("CDP_API_KEY_ID") || undefined;
  const cdpApiKeySecret = runtime.getSetting("CDP_API_KEY_SECRET") || undefined;

  return {
    chain,
    maxPerTx: isNaN(maxPerTx) ? 10 : maxPerTx,
    maxPerDay: isNaN(maxPerDay) ? 100 : maxPerDay,
    cdpApiKeyId,
    cdpApiKeySecret,
  };
}

/**
 * Check if CDP credentials are configured
 */
export function hasCDPCredentials(runtime: IAgentRuntime): boolean {
  const config = validateEnvConfig(runtime);
  return !!(config.cdpApiKeyId && config.cdpApiKeySecret);
}

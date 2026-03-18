/**
 * MoltsPay Wallet Provider
 * 
 * Provides wallet state to actions.
 * Loads wallet from ~/.moltspay/wallet.json only (no env vars).
 */

import type { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import { MoltsPayClient } from "../lib/client.js";
import type { ChainName, ClientConfig } from "../types.js";

export interface MoltspayWalletState {
  address: string | null;
  chain: ChainName;
  config: ClientConfig;
  client: MoltsPayClient;
  isInitialized: boolean;
  todaySpending: number;
  remainingDaily: number;
}

export const walletProvider: Provider = {
  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<MoltspayWalletState | null> => {
    try {
      // Load client from ~/.moltspay/ (no env vars)
      const client = new MoltsPayClient();

      const config = client.getConfig();
      const spending = client.getTodaySpending();

      return {
        address: client.address,
        chain: config.chain,
        config,
        client,
        isInitialized: client.isInitialized,
        todaySpending: spending,
        remainingDaily: Math.max(0, config.limits.maxPerDay - spending),
      };
    } catch (error) {
      console.error("[MoltsPay] Wallet provider error:", error);
      return null;
    }
  },
};

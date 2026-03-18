/**
 * MOLTSPAY_CONFIG Action
 * 
 * Update MoltsPay spending limits.
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionExample,
} from "@elizaos/core";
import { walletProvider, type MoltspayWalletState } from "../providers/wallet.js";

const examples: ActionExample[][] = [
  [
    {
      name: "{{user1}}",
      content: { text: "Increase my daily spending limit to $200" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "I'll update your daily limit to $200.",
        action: "MOLTSPAY_CONFIG",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Set max transaction to $50" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Updating your per-transaction limit to $50.",
        action: "MOLTSPAY_CONFIG",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Change my MoltsPay limits to $25 per tx and $500 daily" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Updating your spending limits.",
        action: "MOLTSPAY_CONFIG",
      },
    },
  ],
];

export const configAction: Action = {
  name: "MOLTSPAY_CONFIG",
  description: "Update MoltsPay spending limits",
  similes: [
    "update moltspay config",
    "change spending limit",
    "set max per transaction",
    "increase daily limit",
    "configure moltspay",
    "moltspay settings",
  ],
  examples,

  validate: async (
    runtime: IAgentRuntime,
    message: Memory
  ): Promise<boolean> => {
    const wallet = await walletProvider.get(runtime, message);
    return wallet?.isInitialized ?? false;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    const wallet = (await walletProvider.get(
      runtime,
      message
    )) as MoltspayWalletState;

    if (!wallet?.isInitialized) {
      callback?.({
        text: "❌ Wallet not initialized. Run `MOLTSPAY_INIT` first.",
      });
      return false;
    }

    const updates: { maxPerTx?: number; maxPerDay?: number } = {};

    if (state?.maxPerTx !== undefined) {
      const value = Number(state.maxPerTx);
      if (!isNaN(value) && value > 0) {
        updates.maxPerTx = value;
      }
    }

    if (state?.maxPerDay !== undefined) {
      const value = Number(state.maxPerDay);
      if (!isNaN(value) && value > 0) {
        updates.maxPerDay = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      const config = wallet.client.getConfig();
      callback?.({
        text:
          `📋 **Current MoltsPay Configuration**\n\n` +
          `**Chain:** ${config.chain}\n` +
          `**Max per tx:** $${config.limits.maxPerTx}\n` +
          `**Max per day:** $${config.limits.maxPerDay}\n\n` +
          `To update, specify new limits:\n` +
          `• "Set max per transaction to $50"\n` +
          `• "Change daily limit to $200"`,
      });
      return true;
    }

    try {
      wallet.client.updateConfig(updates);
      const newConfig = wallet.client.getConfig();

      callback?.({
        text:
          `✅ **Configuration Updated!**\n\n` +
          `**Max per tx:** $${newConfig.limits.maxPerTx}\n` +
          `**Max per day:** $${newConfig.limits.maxPerDay}`,
      });

      return true;
    } catch (error) {
      callback?.({
        text: `❌ Failed to update config: ${(error as Error).message}`,
      });
      return false;
    }
  },
};

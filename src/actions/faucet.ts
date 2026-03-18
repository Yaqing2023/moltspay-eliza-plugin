/**
 * MOLTSPAY_FAUCET Action
 * 
 * Request testnet USDC from MoltsPay faucet.
 * - Chain: Base Sepolia only
 * - Amount: 1 USDC per request
 * - Limit: 1 request per address per 24 hours
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
import { requestFaucet } from "../lib/onramp.js";

const examples: ActionExample[][] = [
  [
    {
      name: "{{user1}}",
      content: { text: "Get me some testnet USDC" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "I'll request testnet USDC from the faucet.",
        action: "MOLTSPAY_FAUCET",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Request faucet tokens" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Requesting testnet USDC from the MoltsPay faucet.",
        action: "MOLTSPAY_FAUCET",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "I need test USDC for Base Sepolia" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "I'll get you some testnet USDC.",
        action: "MOLTSPAY_FAUCET",
      },
    },
  ],
];

export const faucetAction: Action = {
  name: "MOLTSPAY_FAUCET",
  description: "Request testnet USDC from MoltsPay faucet (Base Sepolia)",
  similes: [
    "get test usdc",
    "request faucet",
    "testnet tokens",
    "free usdc",
    "faucet request",
    "test tokens",
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

    if (!wallet?.isInitialized || !wallet.address) {
      callback?.({
        text: "❌ Wallet not initialized. Run `MOLTSPAY_INIT` first.",
      });
      return false;
    }

    const address = (state?.address as string) || wallet.address;

    callback?.({
      text: `🚰 Requesting testnet USDC for \`${address}\`...`,
    });

    try {
      const result = await requestFaucet(address);

      if (result.success) {
        let successMsg = 
          `✅ **Faucet Success!**\n\n` +
          `**Received:** ${result.amount || 1} USDC\n` +
          `**Chain:** Base Sepolia\n`;
        
        if (result.txHash) {
          successMsg += `**Tx:** \`${result.txHash}\`\n`;
        }
        
        successMsg += `\nUse this for testing x402 payments.`;
        
        callback?.({ text: successMsg });
        return true;
      } else {
        let message = `❌ Faucet request failed: ${result.error}`;

        if (result.nextAvailable) {
          const nextTime = new Date(result.nextAvailable).toLocaleString();
          message += `\n\n⏰ Try again after: ${nextTime}`;
        }

        callback?.({ text: message });
        return false;
      }
    } catch (error) {
      callback?.({
        text: `❌ Faucet error: ${(error as Error).message}`,
      });
      return false;
    }
  },
};

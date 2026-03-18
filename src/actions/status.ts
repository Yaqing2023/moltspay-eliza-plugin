/**
 * MOLTSPAY_STATUS Action
 * 
 * Show wallet status, balance, and configuration.
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
import type { BalanceInfo } from "../types.js";

const examples: ActionExample[][] = [
  [
    {
      name: "{{user1}}",
      content: { text: "Check my MoltsPay balance" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Let me check your wallet status.",
        action: "MOLTSPAY_STATUS",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Show my payment wallet status" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Checking your MoltsPay wallet.",
        action: "MOLTSPAY_STATUS",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "How much USDC do I have?" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "I'll check your USDC balance.",
        action: "MOLTSPAY_STATUS",
      },
    },
  ],
];

function formatBalance(chain: string, bal: BalanceInfo): string {
  const parts = [];
  if (bal.usdc > 0) parts.push(`$${bal.usdc.toFixed(2)} USDC`);
  if (bal.usdt > 0) parts.push(`$${bal.usdt.toFixed(2)} USDT`);
  if (bal.native > 0.0001) parts.push(`${bal.native.toFixed(6)} ETH`);
  
  if (parts.length === 0) {
    return `**${chain}:** No balance`;
  }
  return `**${chain}:** ${parts.join(" | ")}`;
}

export const statusAction: Action = {
  name: "MOLTSPAY_STATUS",
  description: "Show MoltsPay wallet status and balance",
  similes: [
    "check moltspay balance",
    "show wallet status",
    "how much usdc do I have",
    "moltspay status",
    "payment wallet balance",
    "check balance",
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
    _state: State,
    _options: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    const wallet = (await walletProvider.get(
      runtime,
      message
    )) as MoltspayWalletState;

    if (!wallet?.isInitialized || !wallet.address) {
      callback?.({
        text:
          "❌ Wallet not initialized.\n\n" +
          "Run `MOLTSPAY_INIT` to create your wallet.",
      });
      return false;
    }

    callback?.({
      text: "📊 Checking balances...",
    });

    try {
      const balances = await wallet.client.getAllBalances();
      const config = wallet.client.getConfig();
      const todaySpending = wallet.client.getTodaySpending();
      const remaining = Math.max(0, config.limits.maxPerDay - todaySpending);

      // Check if any balance
      const hasBalance =
        balances.base.usdc > 0 ||
        balances.base.usdt > 0 ||
        balances.polygon.usdc > 0 ||
        balances.polygon.usdt > 0 ||
        (balances.base_sepolia?.usdc ?? 0) > 0;

      let balanceSection = "**Balances:**\n";
      balanceSection += formatBalance("Base", balances.base) + "\n";
      balanceSection += formatBalance("Polygon", balances.polygon) + "\n";
      if (balances.base_sepolia) {
        balanceSection += formatBalance("Base Sepolia (testnet)", balances.base_sepolia);
      }

      let statusMessage =
        `💰 **MoltsPay Wallet Status**\n\n` +
        `**Address:** \`${wallet.address}\`\n` +
        `**Default Chain:** ${config.chain}\n\n` +
        `${balanceSection}\n\n` +
        `**Spending Limits:**\n` +
        `• Max per tx: $${config.limits.maxPerTx}\n` +
        `• Max per day: $${config.limits.maxPerDay}\n` +
        `• Spent today: $${todaySpending.toFixed(2)}\n` +
        `• Remaining: $${remaining.toFixed(2)}`;

      if (!hasBalance) {
        statusMessage +=
          `\n\n⚠️ **Wallet Empty**\n` +
          `Send USDC to \`${wallet.address}\` on ${config.chain} to start.`;
      }

      callback?.({ text: statusMessage });
      return true;
    } catch (error) {
      callback?.({
        text: `❌ Failed to get status: ${(error as Error).message}`,
      });
      return false;
    }
  },
};

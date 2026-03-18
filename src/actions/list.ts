/**
 * MOLTSPAY_LIST Action
 * 
 * List recent transactions.
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
import type { TransactionRecord, ChainName } from "../types.js";

const examples: ActionExample[][] = [
  // English examples
  [
    {
      name: "{{user1}}",
      content: { text: "Show my last 5 payments" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Here are your recent transactions.",
        action: "MOLTSPAY_LIST",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Transaction history" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Fetching your payment history.",
        action: "MOLTSPAY_LIST",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "What services have I paid for?" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Let me check your payment history.",
        action: "MOLTSPAY_LIST",
      },
    },
  ],
  // Chinese examples
  [
    {
      name: "{{user1}}",
      content: { text: "看看我的交易记录" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "正在获取您的交易历史。",
        action: "MOLTSPAY_LIST",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "最近买了什么" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "让我查一下您的购买记录。",
        action: "MOLTSPAY_LIST",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "消费记录" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "正在查询您的支付记录。",
        action: "MOLTSPAY_LIST",
      },
    },
  ],
];

function formatTransaction(tx: TransactionRecord): string {
  const date = new Date(tx.timestamp).toLocaleDateString();
  const time = new Date(tx.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const status =
    tx.status === "confirmed" ? "✅" : tx.status === "pending" ? "⏳" : "❌";

  return `${status} **${date} ${time}**\n   ${tx.service} | $${tx.amount.toFixed(2)} ${tx.token} | ${tx.chain}`;
}

export const listAction: Action = {
  name: "MOLTSPAY_LIST",
  description: "📜 List recent MoltsPay transactions | 查看交易记录",
  similes: [
    // English
    "show recent payments",
    "transaction history",
    "list moltspay transactions",
    "payment history",
    "recent purchases",
    "what did I pay for",
    // Chinese
    "交易记录",
    "看看买了什么",
    "消费记录",
    "支付历史",
    "最近的交易",
    "购买记录",
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

    const limit = (state?.limit as number) || 10;
    const chainFilter = state?.chain as ChainName | undefined;

    try {
      let transactions = wallet.client.getTransactions(100); // Get more, then filter

      // Apply chain filter if specified
      if (chainFilter) {
        transactions = transactions.filter((tx) => tx.chain === chainFilter);
      }

      // Apply limit
      transactions = transactions.slice(0, limit);

      if (transactions.length === 0) {
        callback?.({
          text:
            "📜 **No Transactions Found**\n\n" +
            "Use `MOLTSPAY_PAY` to start using services!\n\n" +
            "Example: Pay for video generation at https://juai8.com/zen7",
        });
        return true;
      }

      // Calculate totals
      const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      const uniqueServices = new Set(transactions.map((tx) => tx.service)).size;

      let message = `📜 **Recent Transactions** (${transactions.length})\n\n`;
      message += transactions.map(formatTransaction).join("\n\n");
      message += `\n\n---\n`;
      message += `**Total:** $${totalSpent.toFixed(2)} | **Services:** ${uniqueServices}`;

      callback?.({ text: message });
      return true;
    } catch (error) {
      callback?.({
        text: `❌ Failed to list transactions: ${(error as Error).message}`,
      });
      return false;
    }
  },
};

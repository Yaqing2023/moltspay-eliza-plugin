/**
 * MOLTSPAY_FUND Action
 * 
 * Fund MoltsPay wallet with USDC via Coinbase Pay.
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
import { generateOnrampUrl } from "../lib/onramp.js";
import { validateEnvConfig, hasCDPCredentials } from "../environment.js";
import type { ChainName } from "../types.js";

const examples: ActionExample[][] = [
  // English examples
  [
    {
      name: "{{user1}}",
      content: { text: "Fund my wallet with $100" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "I'll generate a Coinbase Pay link for you.",
        action: "MOLTSPAY_FUND",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Add $50 USDC to my MoltsPay wallet" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Creating a funding link for $50 USDC.",
        action: "MOLTSPAY_FUND",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Top up my payment wallet" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "I'll help you add funds to your wallet.",
        action: "MOLTSPAY_FUND",
      },
    },
  ],
  // Chinese examples
  [
    {
      name: "{{user1}}",
      content: { text: "给钱包充值100美金" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "好的，正在生成 Coinbase Pay 充值链接。",
        action: "MOLTSPAY_FUND",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "往钱包里加点钱" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "我来帮您充值。",
        action: "MOLTSPAY_FUND",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "充50 USDC" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "正在创建 $50 USDC 的充值链接。",
        action: "MOLTSPAY_FUND",
      },
    },
  ],
];

export const fundAction: Action = {
  name: "MOLTSPAY_FUND",
  description: "💵 Fund MoltsPay wallet with USDC via Coinbase Pay | 充值钱包",
  similes: [
    // English
    "fund moltspay wallet",
    "add usdc to wallet",
    "buy crypto for moltspay",
    "deposit to moltspay",
    "top up wallet",
    "fund wallet",
    // Chinese
    "充值",
    "给钱包充钱",
    "加钱",
    "充 usdc",
    "入金",
    "钱包充值",
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

    // Check for CDP credentials
    if (!hasCDPCredentials(runtime)) {
      callback?.({
        text:
          `⚠️ **Coinbase Pay Not Configured**\n\n` +
          `Set \`CDP_API_KEY_ID\` and \`CDP_API_KEY_SECRET\` to enable Coinbase Pay.\n\n` +
          `**Alternative:** Send USDC directly to your wallet:\n\n` +
          `**Address:** \`${wallet.address}\`\n` +
          `**Chain:** ${wallet.chain}\n\n` +
          `Use any wallet (Coinbase, MetaMask, etc.) to send USDC.`,
      });
      return true;
    }

    const envConfig = validateEnvConfig(runtime);
    const amount = (state?.amount as number) || 50;
    const chain = (state?.chain as ChainName) || wallet.chain;

    try {
      const url = await generateOnrampUrl({
        destinationAddress: wallet.address,
        amount,
        chain,
        credentials: {
          apiKeyId: envConfig.cdpApiKeyId!,
          apiKeySecret: envConfig.cdpApiKeySecret!,
        },
      });

      callback?.({
        text:
          `💳 **Fund Your Wallet**\n\n` +
          `**Amount:** $${amount} USDC\n` +
          `**Chain:** ${chain}\n` +
          `**Destination:** \`${wallet.address}\`\n\n` +
          `[👉 Open Coinbase Pay](${url})\n\n` +
          `*US debit card or Apple Pay accepted*`,
      });

      return true;
    } catch (error) {
      callback?.({
        text:
          `❌ Failed to generate funding link: ${(error as Error).message}\n\n` +
          `**Alternative:** Send USDC directly to:\n` +
          `\`${wallet.address}\` (${wallet.chain})`,
      });
      return false;
    }
  },
};

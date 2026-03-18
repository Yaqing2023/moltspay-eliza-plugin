/**
 * MOLTSPAY_INIT Action
 * 
 * Initialize a new MoltsPay wallet for payments.
 * Creates ~/.moltspay/wallet.json with a new keypair.
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionExample,
} from "@elizaos/core";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { MoltsPayClient } from "../lib/client.js";
import { validateEnvConfig } from "../environment.js";
import type { ChainName } from "../types.js";

const examples: ActionExample[][] = [
  // English examples
  [
    {
      name: "{{user1}}",
      content: { text: "Initialize my MoltsPay wallet" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "I'll create a new MoltsPay wallet for you.",
        action: "MOLTSPAY_INIT",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Setup a payment wallet with $50 daily limit" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Creating your wallet with a $50 daily spending limit.",
        action: "MOLTSPAY_INIT",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Create a MoltsPay wallet on Polygon" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Setting up your MoltsPay wallet on Polygon.",
        action: "MOLTSPAY_INIT",
      },
    },
  ],
  // Chinese examples
  [
    {
      name: "{{user1}}",
      content: { text: "帮我创建一个支付钱包" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "好的，正在为您创建 MoltsPay 钱包。",
        action: "MOLTSPAY_INIT",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "初始化钱包，每天限额100美金" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "正在创建钱包，日限额设为 $100。",
        action: "MOLTSPAY_INIT",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "新建一个 Polygon 链上的钱包" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "好的，正在 Polygon 链上创建钱包。",
        action: "MOLTSPAY_INIT",
      },
    },
  ],
];

export const initAction: Action = {
  name: "MOLTSPAY_INIT",
  description: "🔐 Initialize a new MoltsPay wallet for payments | 初始化 MoltsPay 支付钱包",
  similes: [
    // English
    "initialize moltspay",
    "create payment wallet",
    "setup moltspay wallet",
    "init moltspay",
    "create moltspay account",
    "new moltspay wallet",
    // Chinese
    "初始化钱包",
    "创建钱包",
    "设置支付钱包",
    "新建钱包",
    "开通 moltspay",
    "创建支付账户",
  ],
  examples,

  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory
  ): Promise<boolean> => {
    // Check if wallet already exists
    const walletPath = join(homedir(), ".moltspay", "wallet.json");
    if (existsSync(walletPath)) {
      return false; // Already initialized
    }
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    state: State,
    _options: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    // Check if already initialized
    const walletPath = join(homedir(), ".moltspay", "wallet.json");
    if (existsSync(walletPath)) {
      callback?.({
        text:
          "⚠️ MoltsPay wallet already exists.\n\n" +
          "Use `MOLTSPAY_STATUS` to check your wallet.\n" +
          "To reinitialize, delete `~/.moltspay/wallet.json` first.",
      });
      return false;
    }

    // Get parameters from state or environment
    const envConfig = validateEnvConfig(runtime);

    const chain = (state?.chain as ChainName) || envConfig.chain;
    const maxPerTx =
      (state?.maxPerTx as number) || envConfig.maxPerTx;
    const maxPerDay =
      (state?.maxPerDay as number) || envConfig.maxPerDay;

    try {
      const configDir = join(homedir(), ".moltspay");

      const result = MoltsPayClient.init(configDir, {
        chain,
        maxPerTx,
        maxPerDay,
      });

      callback?.({
        text:
          `✅ **MoltsPay Wallet Created!**\n\n` +
          `**Address:** \`${result.address}\`\n` +
          `**Chain:** ${chain}\n` +
          `**Max per tx:** $${maxPerTx}\n` +
          `**Max per day:** $${maxPerDay}\n\n` +
          `📥 **Next Steps:**\n` +
          `1. Fund your wallet with USDC on ${chain}\n` +
          `2. Send USDC to: \`${result.address}\`\n` +
          `3. Or use \`MOLTSPAY_FUND\` for Coinbase Pay\n\n` +
          `Once funded, you can pay for AI services!`,
      });

      return true;
    } catch (error) {
      callback?.({
        text: `❌ Failed to initialize wallet: ${(error as Error).message}`,
      });
      return false;
    }
  },
};

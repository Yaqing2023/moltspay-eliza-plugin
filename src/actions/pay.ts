/**
 * MOLTSPAY_PAY Action
 * 
 * Pay for a service using x402 protocol.
 * - Finds service by name on MoltsPay marketplace
 * - If multiple providers, lists them for user to choose (stored in memory)
 * - Uses provider.username to construct endpoint URL
 * 
 * This is GASLESS - only signs, never pays gas.
 * This is PAY-FOR-SUCCESS - payment only claimed if service succeeds.
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
import { MoltsPayClient } from "../lib/client.js";
import type { ChainName, TokenSymbol, ServiceInfo } from "../types.js";

// Memory key for storing pending provider selection
const PENDING_SERVICES_KEY = "moltspay_pending_services";

const examples: ActionExample[][] = [
  [
    {
      name: "{{user1}}",
      content: { text: "Pay for Text to Video with prompt 'a sunset over ocean'" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "I'll find the Text to Video service and process the payment.",
        action: "MOLTSPAY_PAY",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Buy Image to Video from Zen7" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Processing payment for Image to Video from Zen7...",
        action: "MOLTSPAY_PAY",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Use provider 2" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Using that provider for the payment.",
        action: "MOLTSPAY_PAY",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Pay for Multi-Chain Cat on polygon" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "I'll process the payment on Polygon chain.",
        action: "MOLTSPAY_PAY",
      },
    },
  ],
  // Natural English expressions
  [
    {
      name: "{{user1}}",
      content: { text: "Buy me a video of a cat dancing" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "I'll find a video generation service for you.",
        action: "MOLTSPAY_PAY",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "I want to buy text to video service" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Let me find that service for you.",
        action: "MOLTSPAY_PAY",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Get me an AI generated video of sunset" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "I'll search for video generation services.",
        action: "MOLTSPAY_PAY",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Can you purchase image to video for me?" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Sure, let me find that service.",
        action: "MOLTSPAY_PAY",
      },
    },
  ],
  // Chinese examples
  [
    {
      name: "{{user1}}",
      content: { text: "帮我买个视频生成服务" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "好的，我来找视频生成服务。",
        action: "MOLTSPAY_PAY",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "我想买文字转视频" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "让我帮你找这个服务。",
        action: "MOLTSPAY_PAY",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "购买图片转视频，生成一只猫跳舞" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "正在查找图片转视频服务。",
        action: "MOLTSPAY_PAY",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "我要付款买视频服务" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "好的，处理中。",
        action: "MOLTSPAY_PAY",
      },
    },
  ],
];

function extractProviderChoice(text: string): number | null {
  // Check for number choice like "1", "2", "option 1", "provider 2", "use 1", "select 2"
  const match = text.match(/(?:use|select|choose|pick|option|provider|#)?\s*(\d+)/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 20) { // reasonable range
      return num;
    }
  }
  return null;
}

function extractChain(text: string): ChainName | null {
  const lower = text.toLowerCase();
  if (lower.includes("polygon")) return "polygon";
  if (lower.includes("base sepolia") || lower.includes("base_sepolia") || lower.includes("testnet")) return "base_sepolia";
  if (lower.includes("base")) return "base";
  return null;
}

function formatProviderOption(service: ServiceInfo, index: number): string {
  const provider = service.provider?.name || service.provider?.username || "Unknown";
  const rating = service.rating?.average ? `⭐${service.rating.average.toFixed(1)}` : "";
  const sales = service.salesCount ? `📦${service.salesCount} sales` : "";
  const stats = [rating, sales].filter(Boolean).join(" | ");
  
  return `**${index + 1}. ${provider}** - $${service.price} ${service.currency}${stats ? ` (${stats})` : ""}`;
}

export const payAction: Action = {
  name: "MOLTSPAY_PAY",
  description: "💳 Pay for a service using x402 protocol | 支付购买 AI 服务（无需 Gas）",
  similes: [
    // English
    "pay for service",
    "buy service",
    "buy me",
    "get me",
    "I want to buy",
    "I want to purchase",
    "I want to pay for",
    "purchase with moltspay",
    "use moltspay to pay",
    "pay with usdc",
    "use provider",
    "select provider",
    "choose provider",
    "option 1",
    "option 2",
    "use 1",
    "use 2",
    // Chinese
    "买",
    "购买",
    "帮我买",
    "我想买",
    "我要买",
    "付款",
    "买个",
    "买一个",
    "用这个",
    "选这个",
    "选第一个",
    "选第二个",
    "第1个",
    "第2个",
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

    const client = new MoltsPayClient();
    const text = message.content.text || "";

    // Check if user is selecting from a previous provider list (stored in memory)
    const providerChoice = extractProviderChoice(text);
    
    if (providerChoice) {
      // Try to get pending services from recent memories
      try {
        const memories = await runtime.getMemories({
          roomId: message.roomId,
          tableName: "messages",
          count: 20,
        });
        
        console.log("[MoltsPay] Found", memories.length, "memories");
        for (const mem of memories) {
          // Check if this memory has our pending services data
          const content = mem.content as Record<string, unknown>;
          console.log("[MoltsPay] Memory content type:", typeof content);
          console.log("[MoltsPay] Memory content keys:", content ? Object.keys(content) : "null");
          
          if (content?.pendingServices) {
            const pendingServices = content.pendingServices as ServiceInfo[];
            console.log("[MoltsPay] Found pendingServices with", pendingServices.length, "items");
            console.log("[MoltsPay] content.params:", JSON.stringify(content.params));
            
            if (providerChoice >= 1 && providerChoice <= pendingServices.length) {
              const selectedService = pendingServices[providerChoice - 1];
              const savedParams = (content.params as Record<string, unknown>) || {};
              const chain = extractChain(text) || (content.chain as ChainName);
              
              console.log("[MoltsPay] savedParams:", JSON.stringify(savedParams));
              console.log("[MoltsPay] chain:", chain);
              
              callback?.({
                text: `✅ Selected **${selectedService.provider?.name || selectedService.provider?.username}**`,
              });
              
              return await executePayment(wallet, client, selectedService, { ...state, params: savedParams, chain }, callback);
            }
          }
        }
      } catch (e) {
        // Memory lookup failed, continue with normal flow
        console.log("[MoltsPay] Memory lookup failed:", e);
      }
    }

    // Extract chain from user message
    const chain = extractChain(text);

    // Use LLM to extract service name from user's message
    let serviceName = (state?.service as string) || (state?.serviceName as string);
    let providerName = (state?.provider as string) || (state?.providerName as string);
    const params = (state?.params as Record<string, unknown>) || {};
    
    if (!serviceName && text) {
      try {
        const extractResult = await runtime.generateText(
          `Extract the service name from this user message. Return ONLY the service name, nothing else. If the user is just selecting a number (like "1", "2", "use 1"), return "NONE". If no service name is found, return "NONE".

User message: "${text}"

Service name:`
        );
        const extracted = extractResult.text?.trim();
        if (extracted && extracted !== "NONE" && extracted.length < 100) {
          serviceName = extracted;
        }
      } catch {
        // If LLM extraction fails, continue without service name
      }
    }

    // Extract prompt from text using LLM
    if (!params.prompt && text) {
      try {
        const extractResult = await runtime.generateText(
          `Extract the creative prompt or description from this user message. This is for a video/image generation service. Return ONLY the prompt content, nothing else. If no prompt/description is found, return "NONE".

User message: "${text}"

Prompt:`
        );
        const extracted = extractResult.text?.trim();
        if (extracted && extracted !== "NONE" && extracted.length < 500) {
          params.prompt = extracted;
          console.log("[MoltsPay] Extracted prompt:", extracted);
        }
      } catch (e) {
        console.log("[MoltsPay] Prompt extraction failed:", e);
      }
    }

    if (!serviceName) {
      callback?.({
        text:
          "❌ What service do you want to pay for?\n\n" +
          "**Examples:**\n" +
          "• Pay for Text to Video with prompt 'a cat dancing'\n" +
          "• Buy Image to Video from Zen7\n" +
          "• Pay for Multi-Chain Cat on polygon\n\n" +
          "Use `MOLTSPAY_SERVICES` to see available services.",
      });
      return false;
    }

    callback?.({
      text: `🔍 Finding "${serviceName}" service...`,
    });

    try {
      // Search for services matching the name
      let services = await client.findServicesByName(serviceName);

      if (services.length === 0) {
        callback?.({
          text:
            `❌ No service found matching "${serviceName}".\n\n` +
            `Use \`MOLTSPAY_SERVICES\` to see available services.`,
        });
        return false;
      }

      // If provider specified, filter to that provider
      if (providerName) {
        const filtered = services.filter(
          (s) =>
            s.provider?.username?.toLowerCase() === providerName.toLowerCase() ||
            s.provider?.name?.toLowerCase() === providerName.toLowerCase()
        );
        if (filtered.length > 0) {
          services = filtered;
        } else {
          callback?.({
            text: `⚠️ Provider "${providerName}" not found for this service. Showing all providers.`,
          });
        }
      }

      // If only one provider, use it directly
      if (services.length === 1) {
        return await executePayment(wallet, client, services[0], { ...state, params, chain }, callback);
      }

      // Multiple providers - store in memory and let user choose
      console.log("[MoltsPay] Storing in memory - params:", JSON.stringify(params));
      console.log("[MoltsPay] Storing in memory - chain:", chain);
      try {
        await runtime.createMemory(
          {
            id: crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
            entityId: message.entityId,
            roomId: message.roomId,
            content: {
              text: `Pending provider selection for ${serviceName}`,
              pendingServices: services,
              serviceName,
              params,
              chain,
            },
            createdAt: Date.now(),
          },
          "messages" // tableName
        );
      } catch (e) {
        // Memory creation failed, but we can still show the list
        console.log("[MoltsPay] Memory creation failed:", e);
      }

      let msg = `🛒 **"${serviceName}" is offered by ${services.length} providers:**\n\n`;
      msg += services.map((s, i) => formatProviderOption(s, i)).join("\n");
      msg += `\n\n**Reply with the number to select a provider** (e.g., "1" or "use 2")`;
      if (chain) {
        msg += `\n📍 Chain: ${chain}`;
      }

      callback?.({ text: msg });
      return true;
    } catch (error) {
      callback?.({
        text: `❌ Error finding service: ${(error as Error).message}`,
      });
      return false;
    }
  },
};

async function executePayment(
  wallet: MoltspayWalletState,
  client: MoltsPayClient,
  service: ServiceInfo,
  state: State,
  callback?: HandlerCallback
): Promise<boolean> {
  const params = (state?.params as Record<string, unknown>) || {};
  const token = (state?.token as TokenSymbol) || "USDC";
  const chain = state?.chain as ChainName | undefined;

  // Get provider endpoint
  const username = service.provider?.username;
  if (!username) {
    callback?.({
      text: `❌ Service has no provider information.`,
    });
    return false;
  }

  const endpoint = client.getProviderEndpoint(username);
  const providerName = service.provider?.name || username;

  callback?.({
    text:
      `💳 **Processing Payment**\n\n` +
      `**Service:** ${service.name}\n` +
      `**Provider:** ${providerName}\n` +
      `**Price:** $${service.price} ${service.currency}\n` +
      `**Token:** ${token}\n` +
      (chain ? `**Chain:** ${chain}\n` : "") +
      `\n⏳ Signing transaction (gasless)...`,
  });

  try {
    const result = await wallet.client.pay(endpoint, service.id, params, {
      token,
      chain,
    });

    if (result.success) {
      let successMessage = `✅ **Payment Successful!**\n\n`;

      if (result.payment) {
        successMessage +=
          `**Paid:** $${result.payment.amount.toFixed(2)} ${result.payment.token}\n` +
          `**Provider:** ${providerName}\n` +
          `**Chain:** ${result.payment.chain}\n`;
        if (result.payment.txHash) {
          successMessage += `**Tx:** \`${result.payment.txHash.slice(0, 10)}...${result.payment.txHash.slice(-8)}\`\n`;
        }
      }

      // Extract media URLs from result
      let videoUrl: string | undefined;
      let imageUrl: string | undefined;

      if (result.result) {
        successMessage += `\n**Result:**\n`;
        if (typeof result.result === "object") {
          if ("url" in result.result && typeof result.result.url === "string") {
            successMessage += `🔗 ${result.result.url}\n`;
          }
          if ("videoUrl" in result.result && typeof result.result.videoUrl === "string") {
            videoUrl = result.result.videoUrl;
            successMessage += `🎬 ${videoUrl}\n`;
          }
          if ("imageUrl" in result.result && typeof result.result.imageUrl === "string") {
            imageUrl = result.result.imageUrl;
            successMessage += `🖼️ ${imageUrl}\n`;
          }
          if ("message" in result.result) {
            successMessage += `📝 ${result.result.message}\n`;
          }
          const resultStr = JSON.stringify(result.result, null, 2);
          if (resultStr.length < 500 && !("url" in result.result || "videoUrl" in result.result || "imageUrl" in result.result)) {
            successMessage += `\`\`\`json\n${resultStr}\n\`\`\``;
          }
        } else {
          successMessage += `${result.result}`;
        }
      }

      // Send with attachment if we have video/image URL
      const attachments: Array<{id: string; url: string; title: string; contentType: string}> = [];
      
      if (videoUrl) {
        attachments.push({
          id: crypto.randomUUID(),
          url: videoUrl,
          title: "Generated Video",
          contentType: "video"
        });
      } else if (imageUrl) {
        attachments.push({
          id: crypto.randomUUID(),
          url: imageUrl,
          title: "Generated Image",
          contentType: "image"
        });
      }

      if (attachments.length > 0) {
        callback?.({ text: successMessage, attachments });
      } else {
        callback?.({ text: successMessage });
      }
      return true;
    } else {
      callback?.({
        text:
          `❌ **Payment Failed**\n\n` +
          `**Error:** ${result.error}\n\n` +
          `Check your balance with \`MOLTSPAY_STATUS\``,
      });
      return false;
    }
  } catch (error) {
    callback?.({
      text: `❌ Payment error: ${(error as Error).message}`,
    });
    return false;
  }
}

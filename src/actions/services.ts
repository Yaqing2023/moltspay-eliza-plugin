/**
 * MOLTSPAY_SERVICES Action
 * 
 * Discover available services from MoltsPay marketplace.
 * Defaults to moltspay.com, supports search by keyword.
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionExample,
} from "@elizaos/core";
import { MoltsPayClient } from "../lib/client.js";
import type { ServiceInfo } from "../types.js";

const examples: ActionExample[][] = [
  [
    {
      name: "{{user1}}",
      content: { text: "What services can I buy?" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Let me check what services are available on MoltsPay.",
        action: "MOLTSPAY_SERVICES",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Find video generation services" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Searching for video services...",
        action: "MOLTSPAY_SERVICES",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Show me available AI services" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "I'll check the MoltsPay marketplace.",
        action: "MOLTSPAY_SERVICES",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "Find services on moltspay.com" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "I'll list the available services from MoltsPay.",
        action: "MOLTSPAY_SERVICES",
      },
    },
  ],
  [
    {
      name: "{{user1}}",
      content: { text: "List moltspay services" },
    },
    {
      name: "{{agent}}",
      content: {
        text: "Fetching services from MoltsPay marketplace...",
        action: "MOLTSPAY_SERVICES",
      },
    },
  ],
];

function formatService(s: ServiceInfo, index: number): string {
  const provider = s.provider?.name || s.provider?.username || "Unknown";
  const rating = s.rating?.average ? `⭐${s.rating.average.toFixed(1)}` : "";
  const sales = s.salesCount ? `📦${s.salesCount}` : "";
  const stats = [rating, sales].filter(Boolean).join(" | ");
  
  let text = `**${index + 1}. ${s.name}**`;
  if (stats) {
    text += ` (${stats})`;
  }
  text += `\n   💰 $${s.price} ${s.currency} | 👤 ${provider}`;
  if (s.description) {
    // Truncate long descriptions
    const desc = s.description.length > 60 
      ? s.description.slice(0, 60) + "..." 
      : s.description;
    text += `\n   ${desc}`;
  }
  return text;
}

export const servicesAction: Action = {
  name: "MOLTSPAY_SERVICES",
  description: "List, find, or search for services available on MoltsPay. Use when user asks about services, what they can buy, or wants to browse MoltsPay marketplace.",
  similes: [
    "list services",
    "what services are available",
    "discover services",
    "show moltspay services",
    "what can I buy",
    "find services",
    "search services",
    "find services on moltspay",
    "moltspay services",
    "list moltspay services",
    "services on moltspay.com",
    "browse moltspay",
    "moltspay marketplace",
  ],
  examples,

  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory
  ): Promise<boolean> => {
    // Services discovery doesn't require wallet initialization
    return true;
  },

  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    state: State,
    _options: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    // Get search keyword from state (extracted by LLM)
    // If no keyword, list all services
    const keyword = (state?.query as string) || 
                    (state?.keyword as string) || 
                    undefined;

    callback?.({
      text: keyword 
        ? `🔍 Searching for "${keyword}" services...`
        : `🔍 Loading popular services from MoltsPay...`,
    });

    try {
      const client = new MoltsPayClient();
      let services = await client.searchServices(keyword || undefined);

      if (!services || services.length === 0) {
        callback?.({
          text: keyword
            ? `⚠️ No services found for "${keyword}". Try a different search term.`
            : `⚠️ No services available on MoltsPay marketplace.`,
        });
        return false;
      }

      // Sort by sales count (most popular first) and limit
      services = services
        .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
        .slice(0, 10);

      let msg = keyword
        ? `🛒 **Services matching "${keyword}"** (${services.length})\n\n`
        : `🛒 **Popular Services on MoltsPay** (${services.length})\n\n`;

      msg += services.map((s, i) => formatService(s, i)).join("\n\n");

      msg += `\n\n---\n`;
      msg += `**To buy:** Just say "Pay for [service name]"\n`;
      msg += `**To search:** "Find [keyword] services"`;

      callback?.({ text: msg });
      return true;
    } catch (error) {
      callback?.({
        text: `❌ Failed to discover services: ${(error as Error).message}`,
      });
      return false;
    }
  },
};

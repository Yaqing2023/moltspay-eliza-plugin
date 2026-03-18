/**
 * Chain configurations for MoltsPay
 */

import type { ChainName, TokenSymbol } from "../types.js";

export interface TokenConfig {
  address: string;
  decimals: number;
  eip712Name: string;
  eip712Version: string;
}

export interface ChainConfig {
  chainId: number;
  name: string;
  rpc: string;
  explorer: string;
  tokens: Partial<Record<TokenSymbol, TokenConfig>>;
}

export const CHAINS: Record<ChainName, ChainConfig> = {
  base: {
    chainId: 8453,
    name: "Base",
    rpc: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    tokens: {
      USDC: {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
        eip712Name: "USD Coin",
        eip712Version: "2",
      },
      USDT: {
        address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
        decimals: 6,
        eip712Name: "Tether USD",
        eip712Version: "1",
      },
    },
  },
  polygon: {
    chainId: 137,
    name: "Polygon",
    rpc: "https://polygon-rpc.com",
    explorer: "https://polygonscan.com",
    tokens: {
      USDC: {
        address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
        decimals: 6,
        eip712Name: "USD Coin",
        eip712Version: "2",
      },
      USDT: {
        address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        decimals: 6,
        eip712Name: "(PoS) Tether USD",
        eip712Version: "1",
      },
    },
  },
  base_sepolia: {
    chainId: 84532,
    name: "Base Sepolia",
    rpc: "https://base-sepolia-rpc.publicnode.com",
    explorer: "https://sepolia.basescan.org",
    tokens: {
      USDC: {
        address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        decimals: 6,
        eip712Name: "USD Coin",
        eip712Version: "2",
      },
    },
  },
};

/**
 * Get chain configuration by name
 */
export function getChain(name: ChainName): ChainConfig {
  const chain = CHAINS[name];
  if (!chain) {
    throw new Error(`Unknown chain: ${name}. Supported: ${Object.keys(CHAINS).join(", ")}`);
  }
  return chain;
}

/**
 * Get chain by chain ID
 */
export function getChainById(chainId: number): ChainConfig | undefined {
  return Object.values(CHAINS).find((c) => c.chainId === chainId);
}

/**
 * Get chain name by chain ID
 */
export function getChainNameById(chainId: number): ChainName | undefined {
  for (const [name, config] of Object.entries(CHAINS)) {
    if (config.chainId === chainId) {
      return name as ChainName;
    }
  }
  return undefined;
}

/**
 * Convert network string (eip155:8453) to chain name
 */
export function networkToChainName(network: string): ChainName | null {
  const match = network.match(/^eip155:(\d+)$/);
  if (!match) return null;
  
  const chainId = parseInt(match[1], 10);
  return getChainNameById(chainId) || null;
}

/**
 * Convert chain name to network string
 */
export function chainNameToNetwork(name: ChainName): string {
  const chain = getChain(name);
  return `eip155:${chain.chainId}`;
}

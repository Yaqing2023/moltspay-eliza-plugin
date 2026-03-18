# @elizaos/plugin-moltspay Design Document

MoltsPay plugin for ElizaOS - enables AI agents to pay for services using x402 protocol.

## Overview

This plugin integrates MoltsPay's x402 payment infrastructure into ElizaOS, allowing agents to:
- Pay for AI services (video generation, image analysis, etc.)
- Manage payment wallet and spending limits
- Discover available services from providers
- Fund wallet via Coinbase onramp or testnet faucet

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ElizaOS Agent                           │
├─────────────────────────────────────────────────────────────────┤
│  @elizaos/plugin-moltspay                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Actions                                                      ││
│  │  • MOLTSPAY_INIT      - Initialize wallet                   ││
│  │  • MOLTSPAY_CONFIG    - Update limits                       ││
│  │  • MOLTSPAY_FUND      - Coinbase onramp                     ││
│  │  • MOLTSPAY_FAUCET    - Testnet USDC                        ││
│  │  • MOLTSPAY_STATUS    - Wallet status & balance             ││
│  │  • MOLTSPAY_LIST      - Transaction history                 ││
│  │  • MOLTSPAY_SERVICES  - Discover services                   ││
│  │  • MOLTSPAY_PAY       - Pay for service                     ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Providers                                                    ││
│  │  • moltspayWallet     - Wallet state (from ~/.moltspay/)    ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Services                                                     ││
│  │  • MoltsPayService    - Background service (optional)       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────────────┐
│    ~/.moltspay/          │    │         x402 Protocol            │
│  • wallet.json (key)     │    │  • Gasless (EIP-3009 signatures) │
│  • config.json (limits)  │    │  • Pay-for-success               │
│  • spending.json         │    │  • Multi-chain (Base, Polygon)   │
└──────────────────────────┘    │  • Multi-token (USDC, USDT)      │
                                └──────────────────────────────────┘
```

## Wallet Strategy

### Dedicated MoltsPay Wallet (Always Separate)

MoltsPay creates its own wallet in `~/.moltspay/wallet.json`. This is intentional:

1. **Budget Isolation** - User funds a dedicated "AI services budget"
2. **Spending Limits Matter** - Limits protect the service budget, not their main wallet
3. **Safety** - Worst case: lose service budget, not main funds
4. **Simplicity** - Single source of truth, no env vars needed

**We do NOT reuse existing EVM wallets.** This is a feature, not a limitation.

### Wallet Storage
- Config directory: `~/.moltspay/`
- Wallet file: `wallet.json` (600 permissions) - contains private key
- Config file: `config.json` - chain, limits
- Spending tracker: `spending.json` - daily spending

## Actions Specification

### 1. MOLTSPAY_INIT

Initialize a new MoltsPay wallet.

**Similes:**
- "initialize moltspay"
- "create payment wallet"
- "setup moltspay wallet"

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| chain | string | "base" | Chain: base, polygon, base_sepolia |
| maxPerTx | number | 10 | Max USD per transaction |
| maxPerDay | number | 100 | Max USD per day |

**Example:**
```
User: "Initialize my MoltsPay wallet with $50 daily limit"
Agent: [MOLTSPAY_INIT] → Creates wallet, sets limits
```

### 2. MOLTSPAY_CONFIG

Update wallet configuration.

**Similes:**
- "update moltspay config"
- "change spending limit"
- "set max per transaction"

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| maxPerTx | number | New max per transaction |
| maxPerDay | number | New max per day |

**Example:**
```
User: "Increase my daily spending limit to $200"
Agent: [MOLTSPAY_CONFIG] → Updates config
```

### 3. MOLTSPAY_FUND

Generate Coinbase Pay URL for funding wallet.

**Similes:**
- "fund moltspay wallet"
- "add usdc to wallet"
- "buy crypto for moltspay"

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| amount | number | 50 | Amount in USD to fund |
| chain | string | "base" | Target chain |

**Returns:**
- Coinbase Pay URL
- QR code (if terminal)

**Example:**
```
User: "Fund my wallet with $100"
Agent: [MOLTSPAY_FUND] → Returns Coinbase Pay URL
```

### 4. MOLTSPAY_FAUCET

Request testnet USDC from MoltsPay faucet.

**Similes:**
- "get test usdc"
- "request faucet"
- "testnet tokens"

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| address | string | Optional: specific address (default: wallet address) |

**Limits:**
- 1 USDC per request
- 1 request per address per 24 hours
- 100 USDC daily total across all users

**Example:**
```
User: "Get me some testnet USDC"
Agent: [MOLTSPAY_FAUCET] → Requests 1 USDC from faucet
```

### 5. MOLTSPAY_STATUS

Show wallet status, balance, and config.

**Similes:**
- "check moltspay balance"
- "show wallet status"
- "how much usdc do I have"

**Returns:**
```typescript
{
  address: string;
  chain: string;
  balances: {
    base: { usdc: number; usdt: number; native: number };
    polygon: { usdc: number; usdt: number; native: number };
  };
  limits: {
    maxPerTx: number;
    maxPerDay: number;
  };
  todaySpending: number;
}
```

**Example:**
```
User: "Check my MoltsPay balance"
Agent: [MOLTSPAY_STATUS] → Shows balances on all chains
```

### 6. MOLTSPAY_LIST

List recent transactions.

**Similes:**
- "show recent payments"
- "transaction history"
- "list moltspay transactions"

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| limit | number | 10 | Number of transactions |
| chain | string | all | Filter by chain |

**Example:**
```
User: "Show my last 5 payments"
Agent: [MOLTSPAY_LIST] → Lists recent transactions
```

### 7. MOLTSPAY_SERVICES

Discover services from a provider endpoint.

**Similes:**
- "list services"
- "what can I buy"
- "show available services"
- "discover services at"

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| url | string | Provider endpoint URL |

**Returns:**
```typescript
{
  provider: {
    name: string;
    wallet: string;
    chains: string[];
  };
  services: [{
    id: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    input: object;
    output: object;
  }];
}
```

**Example:**
```
User: "What services does https://juai8.com/zen7 offer?"
Agent: [MOLTSPAY_SERVICES] → Lists: text-to-video ($0.99), image-to-video ($1.49)
```

### 8. MOLTSPAY_PAY

Pay for a service using x402 protocol.

**Similes:**
- "pay for service"
- "buy video generation"
- "purchase with moltspay"
- "use moltspay to pay"

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| url | string | Provider endpoint URL |
| service | string | Service ID |
| params | object | Service parameters |
| token | string | Token: USDC or USDT (default: USDC) |
| chain | string | Chain: base, polygon (default: auto) |

**Flow:**
1. Initial request → 402 Payment Required
2. Parse x-payment-required header
3. Check spending limits
4. Sign EIP-3009 authorization (gasless)
5. Retry with x-payment header
6. Return service result

**Example:**
```
User: "Generate a video of a cat playing piano using Zen7"
Agent: [MOLTSPAY_PAY] → Pays $0.99, returns video URL
```

## Provider Specification

### moltspayWallet

Provides wallet state to actions.

**State Interface:**
```typescript
interface MoltspayWalletState {
  address: string;
  chain: ChainName;
  config: ClientConfig;
  client: MoltsPayClient;
  
  // Computed
  isInitialized: boolean;
  todaySpending: number;
  remainingDaily: number;
}
```

**Key Resolution:**
```typescript
// Wallet is ONLY loaded from ~/.moltspay/wallet.json
// No environment variables, no fallbacks
const walletData = loadWalletFromDisk();
if (!walletData) {
  // Not initialized - user must run MOLTSPAY_INIT
  return null;
}
const privateKey = walletData.privateKey;
```

## Service Specification (Optional)

### MoltsPayService

Background service for periodic tasks.

**Features:**
- Periodic balance checks
- Low balance alerts
- Transaction notifications
- Spending reports

**Configuration:**
```typescript
interface MoltsPayServiceConfig {
  enabled: boolean;
  balanceCheckInterval: number;  // ms
  lowBalanceThreshold: number;   // USD
  alertOnLowBalance: boolean;
}
```

## Configuration

### No Private Key in Environment

MoltsPay does NOT use environment variables for private keys. The wallet is stored in `~/.moltspay/wallet.json` and created via `MOLTSPAY_INIT`.

This is intentional:
- No risk of key exposure in env/logs
- Wallet file has 600 permissions (owner-only)
- User explicitly creates and funds the wallet

### Environment Variables (Optional)

```bash
# Default chain (optional, default: base)
MOLTSPAY_CHAIN=base

# Default limits (optional)
MOLTSPAY_MAX_PER_TX=10
MOLTSPAY_MAX_PER_DAY=100

# Coinbase onramp credentials (optional, for MOLTSPAY_FUND)
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
```

### Character Configuration

```json
{
  "name": "MyAgent",
  "settings": {
    "MOLTSPAY_CHAIN": "base",
    "MOLTSPAY_MAX_PER_TX": "50",
    "MOLTSPAY_MAX_PER_DAY": "500"
  },
  "plugins": ["@elizaos/plugin-moltspay"]
}
```

### Runtime Configuration

```typescript
const runtime = new AgentRuntime({
  plugins: [moltspayPlugin],
  settings: {
    MOLTSPAY_CHAIN: "base",
    MOLTSPAY_MAX_PER_TX: "50",
    MOLTSPAY_MAX_PER_DAY: "500",
  },
});
```

## Installation

```bash
# Using bun (recommended for Eliza)
bun add @elizaos/plugin-moltspay

# Using npm
npm install @elizaos/plugin-moltspay

# Using pnpm
pnpm add @elizaos/plugin-moltspay
```

## Usage

### Basic Setup

```typescript
import { moltspayPlugin } from "@elizaos/plugin-moltspay";

const agent = new AgentRuntime({
  plugins: [moltspayPlugin],
  // ...
});
```

### First-Time Setup Flow

1. **Initialize wallet** - Agent or user triggers MOLTSPAY_INIT
2. **Fund wallet** - User sends USDC to the generated address
3. **Set limits** - Configure spending limits (optional, has defaults)
4. **Start using** - Agent can now pay for services

```
User: "Initialize my MoltsPay wallet"
Agent: [MOLTSPAY_INIT] → Creates ~/.moltspay/wallet.json
       "Wallet created! Address: 0x1234..."
       "Fund with USDC on Base to start using services."

User: "I sent $100 USDC"
Agent: [MOLTSPAY_STATUS] → "Balance: $100 USDC. Ready to use!"

User: "Generate a video of a sunset"
Agent: [MOLTSPAY_PAY] → Pays $0.99, returns video
```

### Programmatic Usage

```typescript
import { MoltsPayClient } from "@elizaos/plugin-moltspay";

// Load client (reads from ~/.moltspay/)
const client = new MoltsPayClient();

// Check if initialized
if (!client.isInitialized) {
  // Create new wallet
  MoltsPayClient.init("~/.moltspay", {
    chain: "base",
    maxPerTx: 10,
    maxPerDay: 100,
  });
}

// Check balance
const balance = await client.getBalance();
console.log(`USDC: $${balance.usdc}`);

// Discover services
const services = await client.getServices("https://juai8.com/zen7");

// Pay for service
const result = await client.pay(
  "https://juai8.com/zen7",
  "text-to-video",
  { prompt: "a cat playing piano" }
);
```

## Supported Chains & Tokens

| Chain | Chain ID | USDC | USDT | Network |
|-------|----------|------|------|---------|
| Base | 8453 | ✅ | ✅ | Mainnet |
| Polygon | 137 | ✅ | ✅ | Mainnet |
| Base Sepolia | 84532 | ✅ | ❌ | Testnet |

**Note:** USDT requires gas for approval (no EIP-2612 permit support). USDC is fully gasless.

## x402 Protocol Details

### Payment Flow

```
┌─────────┐                    ┌─────────┐                    ┌──────────┐
│  Agent  │                    │ Provider│                    │ Coinbase │
│(Client) │                    │(Server) │                    │   CDP    │
└────┬────┘                    └────┬────┘                    └────┬─────┘
     │                              │                              │
     │ POST /execute {service}      │                              │
     │─────────────────────────────>│                              │
     │                              │                              │
     │ 402 + x-payment-required     │                              │
     │<─────────────────────────────│                              │
     │                              │                              │
     │ [Sign EIP-3009 - NO GAS]     │                              │
     │                              │                              │
     │ POST /execute + x-payment    │                              │
     │─────────────────────────────>│                              │
     │                              │                              │
     │                              │ Verify + Settle              │
     │                              │─────────────────────────────>│
     │                              │                              │
     │                              │ Confirmation                 │
     │                              │<─────────────────────────────│
     │                              │                              │
     │ 200 + Result                 │                              │
     │<─────────────────────────────│                              │
     │                              │                              │
```

### Key Benefits

1. **Gasless for Client** - Only signs, never pays gas
2. **Pay-for-Success** - Payment claimed only on successful delivery
3. **Atomic** - No partial payments, no refund complexity
4. **Multi-chain** - Same wallet, multiple chains

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Client not initialized` | No wallet in ~/.moltspay/ | Run MOLTSPAY_INIT to create wallet |
| `Exceeds max per transaction` | Amount > maxPerTx | Increase limit via MOLTSPAY_CONFIG |
| `Would exceed daily limit` | Daily spending reached | Wait until tomorrow or increase limit |
| `Insufficient balance` | Not enough USDC/USDT | Fund wallet via MOLTSPAY_FUND |
| `Server doesn't accept chain` | Chain mismatch | Specify correct --chain |

### Retry Strategy

```typescript
// Built-in retry for transient failures
const result = await client.pay(url, service, params, {
  retries: 3,
  retryDelay: 1000,
});
```

## Security Considerations

1. **Private Key Storage**
   - Wallet stored in `~/.moltspay/wallet.json` only
   - File has 0600 permissions (owner read/write only)
   - Never in environment variables (no exposure in logs/ps)
   - Never logged or exposed in error messages

2. **Budget Isolation**
   - Separate wallet from user's main funds
   - User explicitly funds with intended service budget
   - Worst case: lose service budget, not main wallet

3. **Spending Limits**
   - Per-transaction limit (default: $10)
   - Daily limit (default: $100)
   - Persisted to disk (survives restarts)
   - Checked before every signature

4. **Signature Scope**
   - EIP-3009 signatures scoped to specific amount/recipient
   - Time-bounded (validBefore, default 1 hour)
   - Single-use (random nonce)

## Testing

```bash
# Run tests
bun test

# Test with testnet
MOLTSPAY_CHAIN=base_sepolia bun test:e2e
```

## Dependencies

```json
{
  "dependencies": {
    "ethers": "^6.0.0"
  },
  "peerDependencies": {
    "@elizaos/core": "^1.0.0"
  },
  "optionalDependencies": {
    "qrcode-terminal": "^0.12.0"
  }
}
```

Note: No dependency on `@elizaos/plugin-evm`. MoltsPay is self-contained.

## Changelog

### v0.1.0
- Initial release
- All 8 core actions
- EVM wallet reuse support
- Multi-chain support (Base, Polygon)
- Multi-token support (USDC, USDT)

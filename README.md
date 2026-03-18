# @elizaos/plugin-moltspay

MoltsPay x402 payment plugin for ElizaOS - enables AI agents to pay for services using USDC/USDT.

## Features

- **Gasless Payments** - Only signs, never pays gas (EIP-3009)
- **Pay-for-Success** - Payment only claimed when service succeeds
- **Multi-chain** - Base, Polygon, Base Sepolia (testnet)
- **Multi-token** - USDC, USDT
- **Spending Limits** - Per-transaction and daily limits
- **Budget Isolation** - Dedicated wallet for AI service spending

## Installation

```bash
# Using bun (recommended for Eliza)
bun add @elizaos/plugin-moltspay

# Using npm
npm install @elizaos/plugin-moltspay

# Using pnpm
pnpm add @elizaos/plugin-moltspay
```

## Quick Start

### 1. Add Plugin to Agent

```typescript
import { moltspayPlugin } from "@elizaos/plugin-moltspay";

const agent = new AgentRuntime({
  plugins: [moltspayPlugin],
});
```

### 2. Initialize Wallet

The agent (or user) triggers wallet creation:

```
User: "Initialize my MoltsPay wallet"
Agent: [MOLTSPAY_INIT] → Creates ~/.moltspay/wallet.json
       "Wallet created! Address: 0x1234..."
```

### 3. Fund Wallet

Send USDC to the wallet address on Base (or Polygon):

```
User: "Check my MoltsPay status"
Agent: [MOLTSPAY_STATUS] → "Address: 0x1234..., Balance: $100 USDC"
```

### 4. Pay for Services

```
User: "Generate a video of a sunset"
Agent: [MOLTSPAY_PAY] → Signs payment, calls service
       "Payment successful! Here's your video: https://..."
```

## Actions

| Action | Description |
|--------|-------------|
| `MOLTSPAY_INIT` | Initialize wallet (~/.moltspay/wallet.json) |
| `MOLTSPAY_CONFIG` | Update spending limits |
| `MOLTSPAY_FUND` | Generate Coinbase Pay URL |
| `MOLTSPAY_FAUCET` | Request testnet USDC (Base Sepolia) |
| `MOLTSPAY_STATUS` | Show wallet status & balance |
| `MOLTSPAY_LIST` | List transaction history |
| `MOLTSPAY_SERVICES` | Discover services from provider |
| `MOLTSPAY_PAY` | Pay for a service |

## Configuration

### Environment Variables (Optional)

```bash
# Default chain (base, polygon, base_sepolia)
MOLTSPAY_CHAIN=base

# Default spending limits
MOLTSPAY_MAX_PER_TX=10
MOLTSPAY_MAX_PER_DAY=100

# Coinbase Pay (optional, for MOLTSPAY_FUND)
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...

# Background service (optional)
MOLTSPAY_BALANCE_CHECK=true
MOLTSPAY_CHECK_INTERVAL=3600000
MOLTSPAY_LOW_BALANCE_THRESHOLD=10
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

## Wallet Storage

MoltsPay creates a dedicated wallet in `~/.moltspay/`:

```
~/.moltspay/
├── wallet.json      # Private key (600 permissions)
├── config.json      # Chain, limits
├── spending.json    # Daily spending tracker
└── transactions.json # Transaction history
```

**Note:** The wallet is NOT loaded from environment variables. This is intentional for security - no key exposure in logs or env.

## Programmatic Usage

```typescript
import { MoltsPayClient } from "@elizaos/plugin-moltspay";

// Load client from ~/.moltspay/
const client = new MoltsPayClient();

// Check if initialized
if (!client.isInitialized) {
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
console.log(services);

// Pay for service
const result = await client.pay(
  "https://juai8.com/zen7",
  "text-to-video",
  { prompt: "a cat playing piano" }
);
```

## Supported Chains

| Chain | Chain ID | USDC | USDT | Type |
|-------|----------|------|------|------|
| Base | 8453 | ✅ | ✅ | Mainnet |
| Polygon | 137 | ✅ | ✅ | Mainnet |
| Base Sepolia | 84532 | ✅ | ❌ | Testnet |

## x402 Protocol

This plugin implements the [x402 protocol](https://x402.org) for HTTP-native payments:

1. Client sends request without payment
2. Server returns 402 with `x-payment-required` header
3. Client signs EIP-3009 authorization (gasless)
4. Client retries with `x-payment` header
5. Server verifies, executes service, claims payment

**Key Benefits:**
- No gas for client
- Atomic - no partial payments
- Pay-for-success - refund if service fails

## Security

- **Budget Isolation**: Dedicated wallet, not your main funds
- **Spending Limits**: Per-tx and daily limits
- **Secure Storage**: wallet.json has 600 permissions
- **No Env Keys**: Private key never in environment

## License

MIT

# @moltspay/plugin-elizaos

MoltsPay plugin for ElizaOS — enables AI agents to discover and pay for services using x402 protocol.

## Features

- 🔍 **Service Discovery** — Browse services from MoltsPay marketplace
- 💳 **Gasless Payments** — Pay with USDC, no gas needed
- 🔐 **Spending Limits** — Per-transaction and daily limits
- 🌐 **Multi-chain** — Base, Polygon, Base Sepolia (testnet)
- 🇨🇳 **Bilingual** — English and Chinese support

## Installation

Navigate to your ElizaOS project directory first:

```bash
cd /path/to/your/eliza-project
npm install @moltspay/plugin-elizaos
# or
bun add @moltspay/plugin-elizaos
```

Then add to your `src/character.ts`:

```typescript
plugins: [
  '@elizaos/plugin-sql',
  '@moltspay/plugin-elizaos',  // Add this line
],
```

Restart ElizaOS and you're ready to go!

## Usage In Discord
Assume you have a Discord bot, then you can do following:

### 🔐 Initialize Wallet (MOLTSPAY_INIT)

Create a new wallet to start making payments.

```
You: Initialize my MoltsPay wallet
Bot: ✅ Wallet created! Address: 0x1234...

You: 帮我创建一个支付钱包
Bot: ✅ 钱包已创建！地址：0x1234...

You: Setup wallet with $100 daily limit on Polygon
Bot: ✅ Wallet created on Polygon with $100 daily limit!
```

---

### 💰 Check Status (MOLTSPAY_STATUS)

View your wallet balance and spending limits.

```
You: Check my MoltsPay balance
Bot: 💰 Balance: $10.00 USDC on Base
     Max per tx: $5 | Daily limit: $50 | Spent today: $2.00

You: 查看余额
Bot: 💰 余额：$10.00 USDC (Base 链)
     单笔限额：$5 | 日限额：$50 | 今日已消费：$2.00

You: How much USDC do I have?
Bot: 💰 Your balances across all chains...
```

---

### ⚙️ Configure Limits (MOLTSPAY_CONFIG)

Adjust your spending limits for safety.

```
You: Set my daily limit to $200
Bot: ✅ Daily limit updated to $200

You: 单笔最高50刀
Bot: ✅ 单笔限额已设为 $50

You: Change limits to $25 per tx and $500 daily
Bot: ✅ Limits updated: $25 per tx, $500 daily
```

---

### 💵 Fund Wallet (MOLTSPAY_FUND)

Add USDC to your wallet via Coinbase Pay.

```
You: Fund my wallet with $100
Bot: 💳 Here's your Coinbase Pay link...
     [Open Coinbase Pay]

You: 给钱包充值50美金
Bot: 💳 这是您的充值链接...

You: Top up my payment wallet
Bot: 💳 Opening funding options...
```

---

### 🚰 Get Testnet USDC (MOLTSPAY_FAUCET)

Request free test tokens for development (Base Sepolia).

```
You: Get me some testnet USDC
Bot: 🚰 Requesting from faucet...
     ✅ Received 1 USDC on Base Sepolia!

You: 领测试币
Bot: 🚰 正在从水龙头领取...
     ✅ 已收到 1 USDC (Base Sepolia 测试网)

You: I need test tokens
Bot: 🚰 Sent 1 USDC to your wallet!
```

---

### 🛒 Browse Services (MOLTSPAY_SERVICES)

Discover available AI services on MoltsPay marketplace.

```
You: What services can I buy?
Bot: 🛒 Popular Services (5)
     1. Text to Video - $0.99 | Zen7
     2. Image to Video - $1.49 | Zen7
     ...

You: 有什么服务可以买
Bot: 🛒 热门服务 (5)
     1. 文字转视频 - $0.99 | Zen7
     2. 图片转视频 - $1.49 | Zen7
     ...

You: Find video generation services
Bot: 🔍 Searching for "video"...
     Found 3 matching services...
```

---

### 💳 Pay for Service (MOLTSPAY_PAY)

Purchase a service — payment is gasless and automatic.

```
You: Pay for Text to Video, a cat dancing in the rain
Bot: 🔍 Finding service...
     💳 Processing payment: $0.99 USDC
     ✅ Payment successful!
     🎬 https://...your-video.mp4

You: 帮我买个文字转视频，生成一只猫在跳舞
Bot: 🔍 搜索服务中...
     💳 支付中：$0.99 USDC
     ✅ 支付成功！
     🎬 https://...your-video.mp4

You: Buy Image to Video from Zen7
Bot: 💳 Processing payment to Zen7...

You: Use provider 2
Bot: ✅ Using provider #2 for your request...
```

---

### 📜 Transaction History (MOLTSPAY_LIST)

View your recent payments and purchases.

```
You: Show my last 5 payments
Bot: 📜 Recent Transactions (5)
     ✅ Mar 18 - Text to Video | $0.99 | Base
     ✅ Mar 17 - Image to Video | $1.49 | Base
     ...

You: 看看我的交易记录
Bot: 📜 最近交易 (5)
     ✅ 3月18日 - 文字转视频 | $0.99 | Base
     ✅ 3月17日 - 图片转视频 | $1.49 | Base
     ...

You: What services have I paid for?
Bot: 📜 Your payment history...
```

---

## How It Works

1. User requests a service (e.g., "generate a video of sunset")
2. Plugin searches MoltsPay marketplace for matching services
3. If multiple providers exist, user picks one
4. Plugin signs a gasless payment (EIP-3009)
5. Service executes — payment only claimed on success
6. Result delivered to user

**No gas fees. No private keys exposed. Pay only for success.**

## Wallet Storage

Wallet data is stored locally in `~/.moltspay/`:

| File | Purpose |
|------|---------|
| `wallet.json` | Private key (never exposed) |
| `config.json` | Chain and spending limits |
| `spending.json` | Daily spending tracker |

## Contributing

We welcome contributions! Whether it's:

- 🐛 Bug fixes
- ✨ New features
- 📝 Documentation improvements
- 🌍 Translations

**Getting started:**

```bash
git clone https://github.com/Yaqing2023/moltspay-eliza-plugin.git
cd moltspay-eliza-plugin
bun install
bun run build
```

Join our Discord to discuss ideas and get help!

## Links

- 🏠 [MoltsPay](https://moltspay.com) — Home
- 💬 [Discord](https://discord.gg/QwCJgVBxVK) — Community

## License

MIT

/**
 * Coinbase Pay Onramp & Faucet
 */

import type { ChainName, FaucetResult } from "../types.js";

const CDP_API_BASE = "https://api.developer.coinbase.com";
const MOLTSPAY_FAUCET_URL = "https://moltspay.com/api/v1/faucet";

export interface CDPCredentials {
  apiKeyId: string;
  apiKeySecret: string;
}

/**
 * Generate JWT for CDP API authentication
 */
async function generateCdpJwt(
  credentials: CDPCredentials,
  method: string,
  path: string
): Promise<string> {
  // Dynamic import for jose (optional dependency)
  const { SignJWT, importJWK } = await import("jose");
  const crypto = await import("crypto");

  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");
  const uri = `${method} api.developer.coinbase.com${path}`;

  const claims = {
    sub: credentials.apiKeyId,
    iss: "cdp",
    nbf: now,
    exp: now + 120,
    uri,
  };

  // Ed25519 key: 64 bytes = 32 seed + 32 public
  const decoded = Buffer.from(credentials.apiKeySecret, "base64");
  const seed = decoded.subarray(0, 32);
  const publicKey = decoded.subarray(32);

  const jwk = {
    kty: "OKP" as const,
    crv: "Ed25519" as const,
    d: seed.toString("base64url"),
    x: publicKey.toString("base64url"),
  };

  const key = await importJWK(jwk, "EdDSA");

  return await new SignJWT(claims)
    .setProtectedHeader({
      alg: "EdDSA",
      kid: credentials.apiKeyId,
      typ: "JWT",
      nonce,
    })
    .sign(key);
}

/**
 * Get public IP address (required for CDP onramp)
 */
async function getPublicIp(): Promise<string> {
  const response = await fetch("https://api.ipify.org");
  if (!response.ok) {
    throw new Error("Failed to get public IP");
  }
  return (await response.text()).trim();
}

/**
 * Generate Coinbase Pay URL for funding wallet
 */
export async function generateOnrampUrl(params: {
  destinationAddress: string;
  amount: number;
  chain?: ChainName;
  credentials: CDPCredentials;
}): Promise<string> {
  const chain = params.chain || "base";
  const clientIp = await getPublicIp();

  const path = "/onramp/v1/token";
  const jwt = await generateCdpJwt(params.credentials, "POST", path);

  const response = await fetch(`${CDP_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      addresses: [
        {
          address: params.destinationAddress,
          blockchains: [chain],
        },
      ],
      clientIp,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CDP API error (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as { token: string };

  const queryParams = new URLSearchParams({
    sessionToken: result.token,
    defaultAsset: "USDC",
    defaultNetwork: chain,
    presetFiatAmount: params.amount.toString(),
  });

  return `https://pay.coinbase.com/buy/select-asset?${queryParams.toString()}`;
}

/**
 * Request testnet USDC from MoltsPay faucet
 * 
 * - Chain: Base Sepolia only
 * - Amount: 1 USDC per request
 * - Limit: 1 request per address per 24 hours
 */
export async function requestFaucet(address: string): Promise<FaucetResult> {
  try {
    const response = await fetch(MOLTSPAY_FAUCET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });

    const data = (await response.json()) as {
      success?: boolean;
      amount?: number;
      txHash?: string;
      error?: string;
      nextAvailable?: number;
    };

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Faucet error: ${response.status}`,
        nextAvailable: data.nextAvailable,
      };
    }

    return {
      success: true,
      amount: data.amount,
      txHash: data.txHash,
    };
  } catch (error) {
    return {
      success: false,
      error: `Faucet request failed: ${(error as Error).message}`,
    };
  }
}

/**
 * Print QR code to terminal (optional)
 */
export async function printQRCode(url: string): Promise<void> {
  try {
    const qrcodeModule = await import("qrcode-terminal");
    const qrcode = qrcodeModule.default || qrcodeModule;

    return new Promise((resolve) => {
      qrcode.generate(url, { small: true }, (qr: string) => {
        console.log(qr);
        resolve();
      });
    });
  } catch {
    // qrcode-terminal not installed, skip
    console.log(`Fund URL: ${url}`);
  }
}

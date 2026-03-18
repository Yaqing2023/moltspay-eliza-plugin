/**
 * MoltsPay Background Service
 * 
 * Optional service for periodic tasks like balance checks.
 */

import type { Service, IAgentRuntime, ServiceType } from "@elizaos/core";
import { MoltsPayClient } from "../lib/client.js";

export class MoltsPayService implements Service {
  static serviceType: ServiceType = "MOLTSPAY" as ServiceType;
  
  capabilityDescription = "MoltsPay x402 payment service for AI agents";
  
  private runtime: IAgentRuntime | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private client: MoltsPayClient | null = null;

  async initialize(runtime: IAgentRuntime): Promise<void> {
    this.runtime = runtime;
    
    try {
      this.client = new MoltsPayClient();
      
      if (!this.client.isInitialized) {
        console.log("[MoltsPay] Service: Wallet not initialized. Run MOLTSPAY_INIT.");
        return;
      }
      
      console.log(`[MoltsPay] Service initialized. Wallet: ${this.client.address}`);
      
      // Optional: periodic balance check
      const checkEnabled = runtime.getSetting("MOLTSPAY_BALANCE_CHECK") === "true";
      if (checkEnabled) {
        const intervalMs = parseInt(
          runtime.getSetting("MOLTSPAY_CHECK_INTERVAL") || "3600000",
          10
        );
        this.checkInterval = setInterval(() => this.checkBalance(), intervalMs);
        console.log(`[MoltsPay] Balance check enabled (interval: ${intervalMs}ms)`);
      }
    } catch (error) {
      console.error("[MoltsPay] Service initialization error:", error);
    }
  }

  async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log("[MoltsPay] Service stopped");
  }

  private async checkBalance(): Promise<void> {
    if (!this.client?.isInitialized) {
      return;
    }

    try {
      const balance = await this.client.getBalance();
      const config = this.client.getConfig();
      const threshold = parseFloat(
        this.runtime?.getSetting("MOLTSPAY_LOW_BALANCE_THRESHOLD") || "10"
      );

      if (balance.usdc < threshold) {
        console.warn(
          `[MoltsPay] Low balance warning: $${balance.usdc.toFixed(2)} USDC ` +
          `(threshold: $${threshold}) on ${config.chain}`
        );
        // Could emit an event or send notification here
      } else {
        console.log(
          `[MoltsPay] Balance check: $${balance.usdc.toFixed(2)} USDC on ${config.chain}`
        );
      }
    } catch (error) {
      console.error("[MoltsPay] Balance check error:", error);
    }
  }
}

/**
 * DALI POS Integration Service for DALIAudit
 * Provides server-side data loading, connection diagnostics, and graceful fallback.
 */

import { DaliPosClient } from "../integrations/dalipos-client.mjs";

class PosService {
  constructor() {
    this.cache = {
      health: null,
      products: [],
      inventory: [],
      lastRefresh: null
    };
    this.ttlMs = 60 * 1000; // 1 minute in-memory cache
  }

  getClient() {
    return new DaliPosClient({
      baseUrl: process.env.DALI_POS_BASE_URL || "http://127.0.0.1:3000",
      token: process.env.DALI_POS_INTEGRATION_TOKEN || ""
    });
  }

  /**
   * Diagnostic check of DALI POS connection
   * @returns {Promise<{ok: boolean, service?: string, status?: string, capabilities?: Array<string>, productsCount?: number, inventoryCount?: number, error?: string, timestamp: string}>}
   */
  async checkConnection() {
    const timestamp = new Date().toISOString();
    const token = process.env.DALI_POS_INTEGRATION_TOKEN;

    if (!token) {
      return {
        ok: false,
        error: "DALI_POS_INTEGRATION_TOKEN is not configured in DALIAudit .env.",
        timestamp
      };
    }

    try {
      const client = this.getClient();

      // 1. Health check
      const health = await client.health();
      if (!health || health.status !== "ready" && health.status !== "healthy" && health.status !== "ok") {
        return {
          ok: false,
          service: health?.service || "DALI POS",
          status: health?.status || "unknown",
          error: `POS health returned status: '${health?.status || "unknown"}'`,
          timestamp
        };
      }

      // 2. Products count check
      const prodRes = await client.products({ page: 1, limit: 1 });
      const productsCount = prodRes?.pagination?.total ?? (prodRes?.data?.length || 0);

      // 3. Inventory count check
      const invRes = await client.inventory({ page: 1, limit: 1 });
      const inventoryCount = invRes?.pagination?.total ?? (invRes?.data?.length || 0);

      const result = {
        ok: true,
        service: health.service || "DALI POS",
        status: health.status || "ready",
        capabilities: health.capabilities || ["products", "inventory", "sales"],
        productsCount,
        inventoryCount,
        timestamp
      };

      this.cache.health = result;
      this.cache.lastRefresh = new Date();
      return result;
    } catch (err) {
      return {
        ok: false,
        error: err.message || "Failed to connect to DALI POS.",
        code: err.code || "CONNECTION_FAILED",
        timestamp
      };
    }
  }

  /**
   * Get products with fallback
   */
  async getProducts(options = { page: 1, limit: 50 }) {
    try {
      const client = this.getClient();
      const res = await client.products(options);
      return {
        products: res.data || [],
        pagination: res.pagination || {},
        isLive: true
      };
    } catch (err) {
      return {
        products: [],
        pagination: {},
        isLive: false,
        error: err.message
      };
    }
  }

  /**
   * Get inventory stock with fallback
   */
  async getInventory(options = { page: 1, limit: 50 }) {
    try {
      const client = this.getClient();
      const res = await client.inventory(options);
      return {
        inventory: res.data || [],
        pagination: res.pagination || {},
        isLive: true
      };
    } catch (err) {
      return {
        inventory: [],
        pagination: {},
        isLive: false,
        error: err.message
      };
    }
  }
}

export const posService = new PosService();
export default posService;

/**
 * DALIStock Integration Service for DALIAudit
 * Provides cached, server-side data loading and graceful degradation during network outages.
 */

import { DaliStockClient } from "../integrations/dalistock-client.mjs";

class StockService {
  constructor() {
    this.cache = {
      branches: [],
      products: [],
      lastRefresh: null,
      healthStatus: null
    };
    this.ttlMs = 60 * 1000; // 1 minute in-memory cache TTL
  }

  getClient() {
    return new DaliStockClient({
      baseUrl: process.env.STOCK_API_BASE_URL,
      token: process.env.STOCK_API_TOKEN
    });
  }

  /**
   * Diagnostic check of DALIStock connection
   * @returns {Promise<{ok: boolean, system?: string, source?: string, status?: string, branchesCount?: number, productsCount?: number, error?: string, timestamp: string}>}
   */
  async checkConnection() {
    const timestamp = new Date().toISOString();
    const token = process.env.STOCK_API_TOKEN;

    if (!token) {
      return {
        ok: false,
        error: "STOCK_API_TOKEN is not configured in DALIAudit .env. Ask DALIStock admin to generate credential.",
        timestamp
      };
    }

    try {
      const client = this.getClient();

      // 1. Health check
      const health = await client.health();
      if (health.system !== "DALIStock") {
        return {
          ok: false,
          error: `Unexpected system response. Expected 'DALIStock', received '${health.system || "unknown"}'.`,
          timestamp
        };
      }

      // 2. Branch check
      const branchRes = await client.branches();
      const branches = branchRes?.data || [];

      // 3. Product catalog probe
      const prodRes = await client.products({ page: 1, limit: 5 });
      const products = prodRes?.data || [];

      const result = {
        ok: true,
        system: health.system,
        source: health.source,
        status: health.status || "ready",
        branchesCount: branches.length,
        productsCount: prodRes?.pagination?.totalItems || products.length,
        targetBranch: process.env.STOCK_BRANCH_CODE || "BR-001",
        timestamp
      };

      // Update in-memory cache
      this.cache.branches = branches;
      this.cache.lastRefresh = new Date();
      this.cache.healthStatus = result;

      return result;
    } catch (err) {
      return {
        ok: false,
        error: err.message || "Failed to connect to DALIStock.",
        code: err.code || "CONNECTION_FAILED",
        timestamp
      };
    }
  }

  /**
   * Loads authorized branches with graceful fallback
   */
  async getPermittedBranches() {
    const isCacheFresh = this.cache.lastRefresh && (Date.now() - this.cache.lastRefresh.getTime() < this.ttlMs);
    if (isCacheFresh && this.cache.branches.length > 0) {
      return {
        branches: this.cache.branches,
        isLive: true,
        lastRefresh: this.cache.lastRefresh
      };
    }

    try {
      const client = this.getClient();
      const res = await client.branches();
      const branches = res?.data || [];
      this.cache.branches = branches;
      this.cache.lastRefresh = new Date();
      return {
        branches,
        isLive: true,
        lastRefresh: this.cache.lastRefresh
      };
    } catch (err) {
      // Graceful fallback to stale cache or local Calapan definition
      if (this.cache.branches.length > 0) {
        return {
          branches: this.cache.branches,
          isLive: false,
          isStale: true,
          error: err.message,
          lastRefresh: this.cache.lastRefresh
        };
      }
      return {
        branches: [
          { branchCode: process.env.STOCK_BRANCH_CODE || "BR-001", name: "Calapan (Local Fallback)", location: "Mindoro" }
        ],
        isLive: false,
        isFallback: true,
        error: err.message
      };
    }
  }

  /**
   * Loads permitted product catalog with graceful fallback
   */
  async getCatalogProducts(options = { page: 1, limit: 100 }) {
    try {
      const client = this.getClient();
      const res = await client.products(options);
      const products = res?.data || [];
      this.cache.products = products;
      return {
        products,
        pagination: res?.pagination || { page: 1, limit: products.length, totalItems: products.length },
        isLive: true
      };
    } catch (err) {
      return {
        products: this.cache.products || [],
        isLive: false,
        isUnavailable: true,
        error: err.message
      };
    }
  }

  /**
   * Validate submitted branch and product SKU against permitted Stock data
   */
  async validateSelection(branchCode, sku) {
    if (!branchCode && !sku) {
      return { valid: true };
    }

    // Branch validation
    if (branchCode) {
      const { branches } = await this.getPermittedBranches();
      const branchMatch = branches.some((b) => b.branchCode === branchCode);
      if (!branchMatch) {
        return {
          valid: false,
          error: `Branch '${branchCode}' is not authorized in DALIStock integration.`
        };
      }
    }

    // Product SKU validation
    if (sku) {
      try {
        const client = this.getClient();
        const res = await client.products({ sku });
        const product = res?.data?.[0] || (Array.isArray(res?.data) ? null : res?.data);
        if (!product) {
          return {
            valid: false,
            error: `Product SKU '${sku}' was not found in the authorized DALIStock catalog.`
          };
        }
        return {
          valid: true,
          product
        };
      } catch (err) {
        // If Stock is offline during submit, allow with warning to prevent inspection failure
        return {
          valid: true,
          warning: `DALIStock offline; SKU '${sku}' accepted with unverified status.`
        };
      }
    }

    return { valid: true };
  }
}

export const stockService = new StockService();
export default stockService;

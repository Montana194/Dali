/**
 * DALI POS Integration Client for DALIAudit
 * Provides authenticated, read-only HTTP access to DALI POS endpoints:
 * - Health & Capabilities: GET /api/integration/v1/health
 * - Products: GET /api/integration/v1/products
 * - Inventory: GET /api/integration/v1/inventory
 * - Sales: GET /api/integration/v1/sales
 */

export class DaliPosClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.baseUrl] - Base URL of DALI POS (default: http://127.0.0.1:3000)
   * @param {string} [options.token] - DALI_POS_INTEGRATION_TOKEN bearer token
   * @param {number} [options.timeoutMs=10000] - Request timeout in milliseconds
   */
  constructor(options = {}) {
    this.baseUrl = (
      options.baseUrl ||
      process.env.DALI_POS_BASE_URL ||
      "http://127.0.0.1:3000"
    ).replace(/\/+$/, "");
    this.token = options.token || process.env.DALI_POS_INTEGRATION_TOKEN || "";
    this.timeoutMs = options.timeoutMs || 10000;
  }

  /**
   * Internal authenticated request helper with timeout and error mapping
   * @private
   */
  async _request(path, queryParams = {}, retries = 1) {
    if (!this.baseUrl) {
      throw new Error("DALI POS Base URL is not configured. Set DALI_POS_BASE_URL in .env");
    }

    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, val] of Object.entries(queryParams)) {
      if (val !== undefined && val !== null && val !== "") {
        url.searchParams.set(key, String(val));
      }
    }

    const headers = {
      "Accept": "application/json",
      "User-Agent": "DALIAudit-PosClient/1.0"
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(url.toString(), {
          method: "GET",
          headers,
          signal: controller.signal
        });
        clearTimeout(timer);

        const contentType = res.headers.get("content-type") || "";
        let body = null;
        if (contentType.includes("application/json")) {
          body = await res.json();
        } else {
          const text = await res.text();
          try {
            body = JSON.parse(text);
          } catch {
            body = { message: text.slice(0, 200) };
          }
        }

        if (!res.ok) {
          const errorCode = body?.error?.code || `HTTP_${res.status}`;
          const errorMessage =
            body?.error?.message ||
            body?.message ||
            res.statusText ||
            "Request failed";
          const err = new Error(`DALI POS API error (${res.status} ${errorCode}): ${errorMessage}`);
          err.status = res.status;
          err.code = errorCode;
          err.details = body;
          throw err;
        }

        return body;
      } catch (err) {
        clearTimeout(timer);
        if (err.name === "AbortError") {
          lastError = new Error(`DALI POS connection timed out after ${this.timeoutMs}ms at ${url.origin}`);
          lastError.code = "ETIMEDOUT";
        } else {
          lastError = err;
        }

        // Do not retry client errors (401, 403, 404)
        if (lastError.status && lastError.status < 500) {
          throw lastError;
        }

        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    throw lastError;
  }

  /**
   * Check POS API and database health, returns service status and capabilities
   * @returns {Promise<{service: string, status: string, capabilities: Array<string>}>}
   */
  async health() {
    return this._request("/api/integration/v1/health");
  }

  /**
   * Fetch active and inactive products catalog
   * @param {Object} [options]
   * @param {number} [options.page=1]
   * @param {number} [options.limit=50]
   * @returns {Promise<{data: Array<Object>, pagination: {page: number, limit: number, total: number, totalPages: number}}>}
   */
  async products(options = {}) {
    const params = {
      page: options.page || 1,
      limit: Math.min(Math.max(options.limit || 50, 1), 100)
    };
    return this._request("/api/integration/v1/products", params);
  }

  /**
   * Fetch current stock and inventory details
   * @param {Object} [options]
   * @param {number} [options.page=1]
   * @param {number} [options.limit=50]
   * @returns {Promise<{data: Array<Object>, pagination: {page: number, limit: number, total: number, totalPages: number}}>}
   */
  async inventory(options = {}) {
    const params = {
      page: options.page || 1,
      limit: Math.min(Math.max(options.limit || 50, 1), 100)
    };
    return this._request("/api/integration/v1/inventory", params);
  }

  /**
   * Fetch completed sales records within optional date range
   * @param {Object} [options]
   * @param {number} [options.page=1]
   * @param {number} [options.limit=50]
   * @param {string} [options.from] - ISO-8601 start date
   * @param {string} [options.to] - ISO-8601 end date
   * @returns {Promise<{data: Array<Object>, pagination: {page: number, limit: number, total: number, totalPages: number}}>}
   */
  async sales(options = {}) {
    const params = {
      page: options.page || 1,
      limit: Math.min(Math.max(options.limit || 50, 1), 100)
    };
    if (options.from) params.from = options.from;
    if (options.to) params.to = options.to;
    return this._request("/api/integration/v1/sales", params);
  }
}

export default DaliPosClient;

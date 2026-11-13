/**
 * DALIStock Integration Client for DALIAudit
 * Provides authenticated, read-only access to DALIStock branch registry and product catalog.
 */

export class DaliStockClient {
  /**
   * @param {Object} options
   * @param {string} [options.baseUrl] - Base URL of DALIStock (e.g. http://10.183.59.144:3000)
   * @param {string} [options.token] - Registered DALIAudit Bearer token
   * @param {number} [options.timeoutMs] - Request timeout in milliseconds (default: 5000ms)
   */
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || process.env.STOCK_API_BASE_URL || "http://10.183.59.144:3000").replace(/\/+$/, "");
    this.token = options.token || process.env.STOCK_API_TOKEN || "";
    this.timeoutMs = options.timeoutMs || 5000;
  }

  /**
   * Internal fetch with timeout, headers, and transient retry
   * @private
   */
  async _request(path, queryParams = {}, retries = 1) {
    if (!this.baseUrl) {
      throw new Error("DALIStock Base URL is not configured. Check STOCK_API_BASE_URL in .env");
    }

    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, val] of Object.entries(queryParams)) {
      if (val !== undefined && val !== null && val !== "") {
        url.searchParams.set(key, String(val));
      }
    }

    const headers = {
      "Accept": "application/json",
      "User-Agent": "DALIAudit-IntegrationClient/1.0"
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
          const errorMessage = body?.error?.message || body?.message || res.statusText || "Request failed";
          const err = new Error(`DALIStock API error (${res.status} ${errorCode}): ${errorMessage}`);
          err.status = res.status;
          err.code = errorCode;
          err.details = body;
          throw err;
        }

        return body;
      } catch (err) {
        clearTimeout(timer);
        if (err.name === "AbortError") {
          lastError = new Error(`DALIStock connection timed out after ${this.timeoutMs}ms at ${url.origin}`);
          lastError.code = "ETIMEDOUT";
        } else {
          lastError = err;
        }

        // If client error (401, 403, 404), do not retry
        if (lastError.status && lastError.status < 500) {
          throw lastError;
        }

        // If transient network failure and retries remaining, wait 500ms
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    throw lastError;
  }

  /**
   * Confirms Stock identity and authenticated source
   * @returns {Promise<{system: string, version: number, source: string, status: string}>}
   */
  async health() {
    return this._request("/api/integration/v1/health");
  }

  /**
   * Fetches permitted branches
   * @param {Object} [filter]
   * @param {string} [filter.code] - Filter by branch code, e.g. "BR-001"
   * @returns {Promise<{data: Array<{branchCode: string, name: string, location: string}>}>}
   */
  async branches(filter = {}) {
    const params = {};
    if (filter.code) params.code = filter.code;
    return this._request("/api/integration/v1/branches", params);
  }

  /**
   * Fetches product catalog from authorized branches
   * @param {Object} [options]
   * @param {number} [options.page=1]
   * @param {number} [options.limit=50]
   * @param {string} [options.sku]
   * @returns {Promise<{data: Array<{sku: string, name: string, size?: string, category?: string, unitCost?: number, currency?: string}>, pagination?: Object}>}
   */
  async products(options = {}) {
    const params = {
      page: options.page || 1,
      limit: Math.min(options.limit || 50, 100)
    };
    if (options.sku) {
      params.sku = options.sku;
    }
    return this._request("/api/integration/v1/products", params);
  }
}

export default DaliStockClient;

/**
 * Remote MCP client — forwards proprietary-algorithm calls to the DancyCodes engine.
 *
 * The engine exposes `dd_process_*` tools that accept the client's local state as
 * input and return computed results. This client wraps the MCP JSON-RPC protocol
 * so local handlers can call engine tools as simple async functions.
 */

const DEFAULT_ENGINE_URL = "https://dancycodes-engine.dancycodes.workers.dev/mcp";

export interface RemoteClientConfig {
  engineUrl: string;
  licenseKey: string;
  timeoutMs?: number;
}

export class RemoteClient {
  private config: RemoteClientConfig;
  private nextId = 1;
  private initialized = false;

  constructor(config?: Partial<RemoteClientConfig>) {
    const licenseKey = config?.licenseKey ?? process.env.DANCYCODES_LICENSE_KEY ?? "";
    if (!licenseKey) {
      throw new Error(
        "DANCYCODES_LICENSE_KEY environment variable (or RemoteClient config) is required.",
      );
    }
    this.config = {
      engineUrl: config?.engineUrl ?? process.env.DANCYCODES_ENGINE_URL ?? DEFAULT_ENGINE_URL,
      licenseKey,
      timeoutMs: config?.timeoutMs ?? 30000,
    };
  }

  private async rpc(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const body = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    let response: Response;
    try {
      response = await fetch(this.config.engineUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "X-License-Key": this.config.licenseKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Engine returned HTTP ${response.status}: ${text.substring(0, 200)}`,
      );
    }

    const ct = response.headers.get("content-type") ?? "";
    let data: { result?: unknown; error?: { code: number; message: string } };
    if (ct.includes("text/event-stream")) {
      // SSE: parse the first `data: {...}` frame
      const text = await response.text();
      const match = text.match(/^data: (.+)$/m);
      if (!match) throw new Error("SSE response without data frame");
      data = JSON.parse(match[1]);
    } else {
      data = (await response.json()) as typeof data;
    }

    if (data.error) {
      throw new Error(`Engine RPC error ${data.error.code}: ${data.error.message}`);
    }
    return data.result;
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await this.rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "dd-manager-proxy", version: "0.2.0" },
    });
    this.initialized = true;
  }

  /**
   * Pings GET /licenses/check on the engine. Returns:
   *  - { ok: true, plan, email } if license is valid
   *  - { ok: false, reason } if rejected (HTTP 401/403)
   *  - { ok: false, reason: 'network', error } if engine unreachable
   */
  async checkLicenseHealth(): Promise<{
    ok: boolean;
    reason?: string;
    plan?: string;
    email?: string;
  }> {
    // The engine root URL is the MCP URL with /mcp stripped.
    const engineRoot = this.config.engineUrl.replace(/\/mcp\/?$/, "");
    const url = `${engineRoot}/licenses/check`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-License-Key": this.config.licenseKey,
        },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      return {
        ok: false,
        reason: `engine unreachable: ${(err as Error).message}`,
      };
    }
    clearTimeout(timeout);

    let data: { valid?: boolean; plan?: string; email?: string; reason?: string };
    try {
      data = (await response.json()) as typeof data;
    } catch {
      return { ok: false, reason: `engine returned non-JSON (HTTP ${response.status})` };
    }

    if (data.valid === true) {
      return { ok: true, plan: data.plan, email: data.email };
    }
    return { ok: false, reason: data.reason ?? `HTTP ${response.status}` };
  }

  /**
   * Fetches engine metadata (version, min_proxy_version) from GET /. No auth needed.
   */
  async getEngineMeta(): Promise<{
    ok: boolean;
    version?: string;
    min_proxy_version?: string;
    error?: string;
  }> {
    const engineRoot = this.config.engineUrl.replace(/\/mcp\/?$/, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(engineRoot, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = (await response.json()) as {
        version?: string;
        min_proxy_version?: string;
      };
      return {
        ok: true,
        version: data.version,
        min_proxy_version: data.min_proxy_version,
      };
    } catch (err) {
      clearTimeout(timeout);
      return { ok: false, error: (err as Error).message };
    }
  }

  /** Call a single MCP tool on the engine and return the parsed content JSON. */
  async callTool(name: string, args: unknown): Promise<unknown> {
    await this.ensureInitialized();
    const result = (await this.rpc("tools/call", { name, arguments: args })) as {
      content?: Array<{ type: string; text: string }>;
      isError?: boolean;
    };
    if (!result?.content || !Array.isArray(result.content) || result.content.length === 0) {
      throw new Error(`Tool ${name} returned no content`);
    }
    const textBlock = result.content.find((c) => c.type === "text");
    if (!textBlock) throw new Error(`Tool ${name} returned no text content`);

    const parsed = JSON.parse(textBlock.text);
    if (result.isError) {
      throw new Error(`Tool ${name} error: ${parsed.error ?? JSON.stringify(parsed)}`);
    }
    return parsed;
  }
}

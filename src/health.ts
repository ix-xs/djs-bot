/**
 * A tiny, dependency-free HTTP health server for containers/orchestrators.
 *
 *   GET /healthz  → 200 while the process is alive (liveness)
 *   GET /readyz   → 200 when the gateway is connected, else 503 (readiness)
 *   GET /metrics  → 200 JSON snapshot (uptime, interaction/error counts, shards)
 *
 * @module health
 */
import http from "node:http";

/** Live status reported by the server, produced on each request. */
export interface HealthStatus {
  /** Whether the bot is connected and ready to serve. */
  ready: boolean;
  /** Milliseconds since the process started. */
  uptimeMs: number;
  /** Arbitrary counters (interactions, errors, guilds, …). */
  metrics: Record<string, number>;
  /** Optional shard info when sharded. */
  shard?: { id: number; count: number };
}

/** Options for {@link startHealthServer}. */
export interface HealthOptions {
  /** Port to listen on. Default `3000`. */
  port?: number;
  /** Host/interface to bind. Default all interfaces. */
  host?: string;
  /** Called if the server fails to bind (e.g. the port is in use). */
  onError?: (error: Error) => void;
}

function send(res: http.ServerResponse, code: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(code, { "content-type": "application/json", "content-length": Buffer.byteLength(json) });
  res.end(json);
}

/**
 * Starts the health server. `getStatus` is called per request so values are
 * always current.
 *
 * @example const server = startHealthServer(() => ({ ready: client.isReady(), uptimeMs, metrics: {} }), { port: 3000 });
 */
export function startHealthServer(getStatus: () => HealthStatus, options: HealthOptions = {}): http.Server {
  const server = http.createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    const status = getStatus();
    switch (path) {
      case "/healthz":
        return send(res, 200, { status: "ok", uptimeMs: status.uptimeMs });
      case "/readyz":
        return send(res, status.ready ? 200 : 503, { ready: status.ready });
      case "/metrics":
        return send(res, 200, status);
      default:
        return send(res, 404, { error: "not found" });
    }
  });
  // A bind failure (e.g. EADDRINUSE) emits 'error'; without a handler it would
  // crash the whole bot. Report it and carry on - health is non-essential.
  server.on("error", (error: Error) => {
    if (options.onError) options.onError(error);
    else process.stderr.write(`[djs-bot] health server error: ${error.message}\n`);
  });
  server.listen(options.port ?? 3000, options.host);
  server.unref?.();
  return server;
}

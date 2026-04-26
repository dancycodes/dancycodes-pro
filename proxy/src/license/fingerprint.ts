/**
 * v0.3.0 — Machine fingerprint generation.
 *
 * Produces a stable SHA256 hash representing this machine's identity. Used to bind
 * a license to ONE machine. Re-running on the same machine yields the same hash;
 * running on a different machine yields a different hash.
 *
 * Inputs (combined and hashed):
 * - hostname (os.hostname)
 * - primary non-internal MAC address (first stable interface)
 * - CPU model + architecture
 * - OS platform + release
 *
 * Deliberately NOT included (would create false-positive swaps):
 * - process PID, ephemeral env vars, transient IP addresses, current working directory.
 *
 * Cached at ~/.dancycodes/fingerprint after first computation so the same hash is
 * returned across proxy restarts even if a hardware reading flickers (rare but possible
 * with virtualized network adapters).
 */
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const CACHE_FILE = path.join(os.homedir(), ".dancycodes", "fingerprint");

export interface MachineIdentity {
  fingerprint: string;
  hostname: string;
  os_platform: string;
}

export function getMachineIdentity(): MachineIdentity {
  const hostname = os.hostname();
  const os_platform = `${os.platform()}-${os.release()}-${os.arch()}`;

  // Try cached fingerprint first.
  const cached = readCachedFingerprint();
  if (cached) {
    return { fingerprint: cached, hostname, os_platform };
  }

  const fingerprint = computeFingerprint(hostname, os_platform);
  writeCachedFingerprint(fingerprint);
  return { fingerprint, hostname, os_platform };
}

function computeFingerprint(hostname: string, os_platform: string): string {
  const mac = pickStableMac();
  const cpuModel = (os.cpus()[0]?.model ?? "unknown").trim();

  const material = [
    `hostname:${hostname}`,
    `mac:${mac}`,
    `cpu:${cpuModel}`,
    `os:${os_platform}`,
  ].join("|");

  return crypto.createHash("sha256").update(material).digest("hex");
}

/**
 * Pick the most stable MAC address available. Skips:
 * - internal (loopback) interfaces
 * - all-zero MACs (virtualized stubs)
 * - non-up interfaces
 *
 * Falls back to "no-mac" if nothing usable is found (still gives a stable fingerprint
 * via hostname+CPU+OS combination).
 */
function pickStableMac(): string {
  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];

  // Sort interface names for deterministic ordering across runs.
  const ifaceNames = Object.keys(interfaces).sort();

  for (const name of ifaceNames) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.internal) continue;
      const m = (addr.mac ?? "").toLowerCase();
      if (!m || m === "00:00:00:00:00:00") continue;
      candidates.push(m);
    }
  }

  if (candidates.length === 0) return "no-mac";

  // Sort and return the first — guarantees stability when multiple interfaces exist.
  candidates.sort();
  return candidates[0];
}

function readCachedFingerprint(): string | null {
  try {
    const content = fs.readFileSync(CACHE_FILE, "utf8").trim();
    if (content.length === 64 && /^[a-f0-9]+$/.test(content)) {
      return content;
    }
  } catch {
    // File missing or unreadable — no cache yet.
  }
  return null;
}

function writeCachedFingerprint(fingerprint: string): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, fingerprint, { encoding: "utf8", mode: 0o600 });
  } catch (err) {
    // Non-fatal — fingerprint will be re-computed next run, may produce a swap if
    // the underlying machine info shifts. Log to stderr so the operator can investigate.
    console.error(`[dd-manager-proxy] WARN: could not cache fingerprint to ${CACHE_FILE}: ${(err as Error).message}`);
  }
}

/** For diagnostics — return a short prefix of the fingerprint for log/UI display. */
export function fingerprintShort(fp: string): string {
  return fp.length > 12 ? fp.substring(0, 12) : fp;
}

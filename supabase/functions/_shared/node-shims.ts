// Supabase's edge runtime doesn't populate every `node:process` field. The
// Prisma query-compiler runtime evaluates `process.pid.toString(36)` (a machine
// fingerprint) at MODULE-EVAL time, plus reads process.version/cwd/nextTick, so
// it crashes with "Cannot read properties of undefined (reading 'toString')"
// unless these exist. This module MUST be imported before the Prisma client.
import process from 'node:process';

const p = process as unknown as Record<string, unknown>;

function ensure(key: string, value: unknown): void {
  try {
    if (p[key] === undefined || p[key] === null) p[key] = value;
  } catch {
    try {
      Object.defineProperty(process, key, { value, configurable: true });
    } catch {
      /* read-only and already defined — leave it */
    }
  }
}

ensure('pid', 1);
ensure('version', 'v20.0.0');
if (typeof p.cwd !== 'function') ensure('cwd', () => '/');
if (typeof p.nextTick !== 'function') {
  ensure('nextTick', (cb: (...a: unknown[]) => void, ...args: unknown[]) => queueMicrotask(() => cb(...args)));
}

// Mirror onto the global in case the runtime reads `globalThis.process`.
try {
  (globalThis as unknown as { process?: unknown }).process ??= process;
} catch {
  /* ignore */
}

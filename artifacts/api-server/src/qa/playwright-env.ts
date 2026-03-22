import { existsSync } from 'fs';

const NIX_MESA_PATH = '/nix/store/24w3s75aa2lrvvxsybficn8y3zxd27kp-mesa-libgbm-25.1.0/lib';

/**
 * Returns the env object to pass to Playwright's chromium.launch().
 * On Replit/NixOS the mesa-libgbm path is injected so Chromium can find GPU libs.
 * On a standard laptop this path doesn't exist and is silently omitted.
 */
export function playwrightEnv(): Record<string, string> {
  const base = process.env as Record<string, string>;
  const existing = base['LD_LIBRARY_PATH'] ?? '';

  if (!existsSync(NIX_MESA_PATH)) {
    return base;
  }

  const ldPath = existing ? `${NIX_MESA_PATH}:${existing}` : NIX_MESA_PATH;
  return { ...base, LD_LIBRARY_PATH: ldPath };
}

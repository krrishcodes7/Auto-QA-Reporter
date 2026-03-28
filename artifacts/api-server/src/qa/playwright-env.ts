import { existsSync } from 'fs';
import path from 'path';

const NIX_MESA_PATH = '/nix/store/24w3s75aa2lrvvxsybficn8y3zxd27kp-mesa-libgbm-25.1.0/lib';

// Browsers are stored in the workspace cache when installed via `pnpm exec playwright install`
const WORKSPACE_BROWSERS_PATH = path.join(process.cwd(), '..', '..', '.cache', 'ms-playwright');

/**
 * Returns the env object to pass to Playwright's chromium.launch().
 *
 * On Replit/NixOS:
 *  - Injects the mesa-libgbm path into LD_LIBRARY_PATH so Chromium can find GPU libs.
 *  - Sets PLAYWRIGHT_BROWSERS_PATH to the workspace-local cache directory so the
 *    downloaded browsers are found regardless of how the server process is started.
 *
 * On a standard machine these paths don't exist and are silently omitted.
 */
export function playwrightEnv(): Record<string, string> {
  const base = { ...(process.env as Record<string, string>) };

  // Point Playwright at the workspace-local browser cache if it exists there
  if (existsSync(WORKSPACE_BROWSERS_PATH) && !base['PLAYWRIGHT_BROWSERS_PATH']) {
    base['PLAYWRIGHT_BROWSERS_PATH'] = WORKSPACE_BROWSERS_PATH;
  }

  if (!existsSync(NIX_MESA_PATH)) {
    return base;
  }

  const existing = base['LD_LIBRARY_PATH'] ?? '';
  const ldPath = existing ? `${NIX_MESA_PATH}:${existing}` : NIX_MESA_PATH;
  return { ...base, LD_LIBRARY_PATH: ldPath };
}

/**
 * autic ui — Launch the full-screen Ink terminal UI.
 *
 * Explicit command alias for the primary interactive experience.
 * Identical to running `autic` with no arguments.
 */

import { dashboardCommand } from './dashboard.js';

export async function uiCommand(): Promise<void> {
  await dashboardCommand();
}

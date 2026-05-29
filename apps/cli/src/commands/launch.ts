/**
 * autic launch — Explicit launch command
 *
 * Opens the Launchpad Dashboard — identical experience to running `autic` with no arguments.
 * Provides a future-safe explicit command alias for the primary entry point.
 */

import { dashboardCommand } from './dashboard.js';

export async function launchCommand(): Promise<void> {
  await dashboardCommand();
}

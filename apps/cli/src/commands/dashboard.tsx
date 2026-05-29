/**
 * autic — Launchpad Dashboard
 *
 * Launches the full-screen Ink-based terminal UI.
 * This is the primary experience when running `autic` with no arguments.
 */

import { render } from 'ink';
import { AuticApp } from '../ui/app.js';

export async function dashboardCommand(): Promise<void> {
  const { waitUntilExit } = render(<AuticApp />);
  await waitUntilExit();
}

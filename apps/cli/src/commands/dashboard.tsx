/**
 * autic — Launchpad Dashboard
 *
 * Launches the full-screen Ink-based terminal UI wrapped with RuntimeProvider
 * for real runtime state access.
 */

import React from 'react';
import { render } from 'ink';
import { RuntimeProvider } from '../runtime/RuntimeContext.js';
import { AuticApp } from '../ui/app.js';

export async function dashboardCommand(): Promise<void> {
  const { waitUntilExit } = render(
    <RuntimeProvider>
      <AuticApp />
    </RuntimeProvider>,
  );
  await waitUntilExit();
}

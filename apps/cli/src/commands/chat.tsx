/**
 * autic chat — Start an interactive chat session with Autic.
 * Launches the full-screen Ink terminal UI wrapped with RuntimeProvider.
 */

import React from 'react';
import { render } from 'ink';
import { RuntimeProvider } from '../runtime/RuntimeContext.js';
import { AuticApp } from '../ui/app.js';

export async function chatCommand(
  _options: {
    model?: string;
    provider?: string;
    session?: string;
    file?: string;
  } = {},
): Promise<void> {
  const { waitUntilExit } = render(
    <RuntimeProvider>
      <AuticApp />
    </RuntimeProvider>,
  );
  await waitUntilExit();
}

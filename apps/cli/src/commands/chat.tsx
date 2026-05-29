/**
 * autic chat — Start an interactive chat session with Autic.
 * Launches the full-screen Ink terminal UI for interactive conversation.
 * The TUI provides the input box, execution feed, todo panel, and agent view.
 */

import { render } from 'ink';
import { AuticApp } from '../ui/app.js';

export async function chatCommand(
  _options: {
    model?: string;
    provider?: string;
    session?: string;
    file?: string;
  } = {},
): Promise<void> {
  // Launch the full Ink-based terminal UI
  const { waitUntilExit } = render(<AuticApp />);
  await waitUntilExit();
}

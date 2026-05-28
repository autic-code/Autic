/**
 * autic build — Build the current Autic workspace.
 * Runs TypeScript compilation across all packages.
 */

import { execSync } from 'node:child_process';
import { colorText, heading, divider } from '@autic/ui';

export async function buildCommand(options: { watch?: boolean; clean?: boolean } = {}): Promise<void> {
  console.log(`\n  ${heading('Build Workspace')} ${colorText('(TypeScript compilation)', 'dim')}`);
  console.log(`  ${divider(48)}\n`);

  try {
    if (options.clean) {
      process.stdout.write(`  ${colorText('⟳', 'warning')} ${colorText('Cleaning previous builds...', 'dim')}`);
      execSync('pnpm -r clean', { stdio: 'pipe' });
      process.stdout.write(`\r  ${colorText('✓', 'success')} ${colorText('Clean complete', 'success')}\n\n`);
    } else {
      process.stdout.write(`  ${colorText('⟳', 'primary')} ${colorText('Compiling TypeScript', 'dim')}`);
    }

    if (options.clean) {
      process.stdout.write(`  ${colorText('⟳', 'primary')} ${colorText('Compiling TypeScript', 'dim')}${options.watch ? ' (watch mode)' : ''}...\n`);
    }

    const watchFlag = options.watch ? ' --watch' : '';
    execSync(`pnpm -r build${watchFlag}`, { stdio: 'inherit' });

    console.log(`\n  ${colorText('✓', 'success')} ${colorText('Build complete', 'success')}`);
    console.log(`  ${divider(48)}\n`);
  } catch (error) {
    console.error(`\n  ${colorText('✗', 'error')} ${colorText('Build failed:', 'error')} ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

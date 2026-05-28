/**
 * autic update — Check for updates and manage version.
 *
 * Supports: check, info, version
 * No forced auto-updates — user must explicitly install.
 */

import { ConfigManager, UpdateChecker } from '@autic/config';

let updateChecker: UpdateChecker | null = null;

async function getUpdateChecker(): Promise<UpdateChecker> {
  if (!updateChecker) {
    const cm = new ConfigManager();
    await cm.init();
    const updateConfig = cm.getUpdateConfig();
    updateChecker = new UpdateChecker(updateConfig);
    await updateChecker.loadCache();
  }
  return updateChecker;
}

export async function updateCommand(action?: string): Promise<void> {
  const uc = await getUpdateChecker();

  if (!action || action === 'check') {
    await checkForUpdates(uc);
    return;
  }

  if (action === 'info') {
    await showUpdateInfo(uc);
    return;
  }

  if (action === 'version') {
    await showVersion();
    return;
  }

  // Help
  console.log('\n  Usage: autic update <action>\n');
  console.log('  Actions:');
  console.log('    check     Check for updates (default)');
  console.log('    info      Show detailed update info');
  console.log('    version   Show current version\n');
  console.log('  To install updates:');
  console.log('    npm install -g autic@latest\n');
}

async function checkForUpdates(uc: UpdateChecker): Promise<void> {
  console.log('\n  Checking for updates...\n');

  try {
    const result = await uc.check();

    console.log(`  Current version:  v${result.currentVersion}\n`);

    if (result.updateAvailable && result.latestVersion) {
      console.log(`  ✓ Update available: v${result.currentVersion} → v${result.latestVersion}\n`);
      console.log('  To install:');
      console.log(`    ${uc.getUpdateCommand()}\n`);
      if (result.releaseNotesUrl) {
        console.log(`  Release notes: ${result.releaseNotesUrl}\n`);
      }
    } else {
      console.log('  ✓ You are on the latest version.\n');
    }
  } catch (error) {
    console.log('  ○ Could not check for updates (offline?).\n');
    if (error instanceof Error && process.env.AUTIC_DEBUG) {
      console.log(`  Error: ${error.message}\n`);
    }
  }
}

async function showUpdateInfo(uc: UpdateChecker): Promise<void> {
  console.log('\n  Update Information\n');
  console.log(`  Auto-check:    Enabled`);
  console.log(`  Check interval: 24 hours\n`);
  console.log('  Update command:');
  console.log(`    ${uc.getUpdateCommand()}\n`);
  console.log('  Rollback command:');
  console.log(`    ${uc.getRollbackCommand()}\n`);
  console.log('  Note: Updates are never forced. You choose when to update.\n');
}

async function showVersion(): Promise<void> {
  const { CLI_VERSION } = await import('../constants.js');
  console.log(`\n  Autic v${CLI_VERSION}\n`);
}

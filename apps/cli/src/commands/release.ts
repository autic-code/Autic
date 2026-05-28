/**
 * autic release — Release channel management command.
 *
 * Manages release channels (stable, beta, dev) and provides
 * update checking, channel switching, and version info.
 */

import { ReleaseChannelManager, type ReleaseChannel } from '@autic/release';

/**
 * Run release command
 */
export async function releaseCommand(action?: string, value?: string): Promise<void> {
  const manager = new ReleaseChannelManager('0.1.0', {
    channel: 'stable',
    autoUpdatePatch: true,
    autoUpdateMinor: false,
    skipMajorUpgrades: true,
  });

  // Register known releases
  manager.registerRelease('0.1.0', 'stable', {
    notes: 'Initial release',
    features: [
      'Full Autic runtime',
      'Provider orchestration',
      'Security system',
      'Hardening systems',
    ],
  });

  switch (action ?? 'status') {
    case 'status': {
      const config = manager.getConfig();
      console.log('\n  ╭─── Release Channel ────────────────────────╮');
      console.log(`  │ Current Version: ${'0.1.0'.padEnd(27)}│`);
      console.log(`  │ Channel:         ${config.channel.padEnd(27)}│`);
      console.log(`  │ Auto Patch:      ${config.autoUpdatePatch ? 'Yes' : 'No'.padEnd(27)}│`);
      console.log(`  │ Auto Minor:      ${config.autoUpdateMinor ? 'Yes' : 'No'.padEnd(27)}│`);
      console.log(`  │ Skip Major:      ${config.skipMajorUpgrades ? 'Yes' : 'No'.padEnd(27)}│`);
      console.log('  ╰──────────────────────────────────────────────╯');

      const check = manager.checkForUpdates();
      if (check.latestVersion) {
        console.log(`\n  Latest: ${check.latestVersion.version} (${check.latestVersion.channel})`);
        console.log(`  Recommendation: ${check.recommendation ?? 'Up to date'}`);
      }
      break;
    }

    case 'check': {
      const check = manager.checkForUpdates();
      console.log(`\n  Current: 0.1.0`);
      if (check.updateAvailable && check.latestVersion) {
        console.log(`  Available: ${check.latestVersion.version} (${check.latestVersion.channel})`);
        console.log(`  ${check.recommendation}`);
      } else {
        console.log('  Up to date.');
      }
      break;
    }

    case 'channel': {
      if (value && ['stable', 'beta', 'dev'].includes(value)) {
        manager.switchChannel(value as ReleaseChannel);
        const config = manager.getConfig();
        console.log(`\n  ✓ Switched to ${config.channel} channel`);
      } else if (value) {
        console.log(`\n  ✗ Invalid channel: ${value}`);
        console.log('  Valid channels: stable, beta, dev');
      } else {
        console.log(`\n  Current channel: ${manager.getConfig().channel}`);
      }
      break;
    }

    case 'versions': {
      const releases = manager.getAllReleases();
      console.log('\n  Release Versions:');
      console.log('  ─────────────────────────────────────────────────');
      if (releases.length === 0) {
        console.log('  No releases registered.');
      } else {
        for (const r of releases) {
          const marker = r.latest ? '← latest' : '';
          console.log(
            `  ${r.version.padEnd(14)} ${r.channel.padEnd(8)} ${r.notes ?? ''} ${marker}`,
          );
        }
      }
      break;
    }

    default: {
      console.log(`\n  ✗ Unknown action: ${action}`);
      console.log('  Usage: autic release [status|check|channel|versions]');
    }
  }
}

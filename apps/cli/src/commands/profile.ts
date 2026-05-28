/**
 * autic profile — Manage developer profile presets.
 *
 * Supports: status, list, set, describe
 * Profile presets: safe, balanced, full_auto, local_only
 */

import { ConfigManager, ProfileManager } from '@autic/config';
import type { DeveloperProfile } from '@autic/shared';

let profileManager: ProfileManager | null = null;

async function getProfileManager(): Promise<ProfileManager> {
  if (!profileManager) {
    const cm = new ConfigManager();
    await cm.init();
    profileManager = new ProfileManager(cm);
  }
  return profileManager;
}

export async function profileCommand(action?: string, profile?: string): Promise<void> {
  const pm = await getProfileManager();

  if (!action || action === 'status') {
    await showProfileStatus(pm);
    return;
  }

  if (action === 'list') {
    await listProfiles(pm);
    return;
  }

  if (action === 'set') {
    await setProfile(pm, profile);
    return;
  }

  if (action === 'describe') {
    await describeProfile(pm, profile);
    return;
  }

  // Help
  console.log('\n  Usage: autic profile <action> [profile]\n');
  console.log('  Actions:');
  console.log('    status               Show current profile');
  console.log('    list                 List all available profiles');
  console.log('    set <profile>        Set active profile');
  console.log('    describe <profile>   Describe a profile\n');
  console.log('  Profiles: safe, balanced, full_auto, local_only\n');
}

async function showProfileStatus(pm: ProfileManager): Promise<void> {
  const current = pm.getCurrentProfile();
  const config = pm.getCurrentProfileConfig();

  console.log('\n  Active Profile\n');
  console.log(`  Profile:     ${config.label} (${config.profile})`);
  console.log(`  Description: ${config.description}`);
  console.log('');
  console.log('  Policies:');
  console.log(`    Dangerous commands:  ${config.allowDangerousCommands ? 'Allowed' : 'Blocked'}`);
  console.log(
    `    Medium risk:         ${config.requireApprovalForMedium ? 'Requires approval' : 'Auto-approved'}`,
  );
  console.log(
    `    Low risk:            ${config.autoApproveLowRisk ? 'Auto-approved' : 'Requires approval'}`,
  );
  console.log(`    Max depth:           ${config.maxExecutionDepth}`);
  console.log(`    Workflow timeout:    ${config.workflowTimeoutMs}ms`);
  console.log(`    Cloud providers:     ${config.allowCloudProviders ? 'Allowed' : 'Blocked'}`);
  console.log(`    Local providers:     ${config.allowLocalProviders ? 'Allowed' : 'Blocked'}`);
  console.log(`    Telemetry:           ${config.telemetryEnabled ? 'Enabled' : 'Disabled'}`);
  console.log('');
}

async function listProfiles(pm: ProfileManager): Promise<void> {
  const current = pm.getCurrentProfile();
  const profiles = pm.getAvailableProfiles();

  console.log(`\n  Available Profiles (current: ${current})\n`);

  for (const p of profiles) {
    const marker = p.profile === current ? ' ◀' : '';
    console.log(`  ${p.profile}${marker}`);
    console.log(`    ${p.description}`);
    console.log(
      `    Depth: ${p.maxExecutionDepth} | Timeout: ${p.workflowTimeoutMs}ms | Cloud: ${p.allowCloudProviders ? '✓' : '✗'}`,
    );
    console.log('');
  }
}

async function setProfile(pm: ProfileManager, profile?: string): Promise<void> {
  if (!profile) {
    console.log('\n  Usage: autic profile set <profile>\n');
    console.log('  Profiles: safe, balanced, full_auto, local_only\n');
    return;
  }

  const validProfiles: DeveloperProfile[] = ['safe', 'balanced', 'full_auto', 'local_only'];
  const target = profile as DeveloperProfile;

  if (!validProfiles.includes(target)) {
    console.log(`\n  Invalid profile: "${profile}". Use: ${validProfiles.join(', ')}\n`);
    return;
  }

  const current = pm.getCurrentProfile();
  if (current === target) {
    console.log(`\n  Profile "${profile}" is already active.\n`);
    return;
  }

  await pm.setProfile(target);
  const config = pm.getProfileConfig(target);
  console.log(`\n  ✓ Profile set to: ${config.label} (${config.profile})\n`);
  console.log(`  ${config.description}\n`);
}

async function describeProfile(pm: ProfileManager, profile?: string): Promise<void> {
  if (!profile) {
    console.log('\n  Usage: autic profile describe <profile>\n');
    console.log('  Profiles: safe, balanced, full_auto, local_only\n');
    return;
  }

  const validProfiles: DeveloperProfile[] = ['safe', 'balanced', 'full_auto', 'local_only'];
  const target = profile as DeveloperProfile;

  if (!validProfiles.includes(target)) {
    console.log(`\n  Invalid profile: "${profile}". Use: ${validProfiles.join(', ')}\n`);
    return;
  }

  const config = pm.getProfileConfig(target);
  console.log(`\n  Profile: ${config.label} (${config.profile})`);
  console.log(`  ${config.description}\n`);
  console.log('  Policies:');
  console.log(`    Dangerous commands:  ${config.allowDangerousCommands ? 'Allowed' : 'Blocked'}`);
  console.log(
    `    Medium risk:         ${config.requireApprovalForMedium ? 'Requires approval' : 'Auto-approved'}`,
  );
  console.log(
    `    Low risk:            ${config.autoApproveLowRisk ? 'Auto-approved' : 'Requires approval'}`,
  );
  console.log(`    Max depth:           ${config.maxExecutionDepth}`);
  console.log(`    Workflow timeout:    ${config.workflowTimeoutMs}ms`);
  console.log(`    Cloud providers:     ${config.allowCloudProviders ? 'Allowed' : 'Blocked'}`);
  console.log(`    Local providers:     ${config.allowLocalProviders ? 'Allowed' : 'Blocked'}`);
  console.log('');
}

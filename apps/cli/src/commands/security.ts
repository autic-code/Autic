/**
 * CLI command: autic security
 * Show security status, manage trust profiles, view permissions and security events.
 */

import { theme } from '@autic/ui';
import { SecurityEventSystem } from '@autic/security';
import { TrustProfileSystem } from '@autic/security';
import { AutoModeManager } from '@autic/security';
import { PermissionManager, createDefaultPermissions } from '@autic/security';
import type { TrustProfile } from '@autic/shared';
import { getVault } from '@autic/security';

let securityEvents: SecurityEventSystem | null = null;
let trustProfile: TrustProfileSystem | null = null;
let autoMode: AutoModeManager | null = null;
let permissions: PermissionManager | null = null;

function getSecurityEvents(): SecurityEventSystem {
  if (!securityEvents) securityEvents = new SecurityEventSystem();
  return securityEvents;
}

function getTrustProfile(): TrustProfileSystem {
  if (!trustProfile) trustProfile = new TrustProfileSystem('balanced');
  return trustProfile;
}

function getAutoMode(): AutoModeManager {
  if (!autoMode) autoMode = new AutoModeManager('guided', getSecurityEvents());
  return autoMode;
}

function getPermissions(): PermissionManager {
  if (!permissions) permissions = createDefaultPermissions();
  return permissions;
}

function colorForLevel(level: string): string {
  switch (level) {
    case 'low': return theme.colors.success;
    case 'medium': return theme.colors.warning;
    case 'high': return theme.colors.error;
    case 'safe': return theme.colors.success;
    case 'balanced': return theme.colors.warning;
    case 'full_auto': return theme.colors.error;
    default: return theme.colors.textDim;
  }
}

function colorForSeverity(severity: string): string {
  switch (severity) {
    case 'critical': return theme.colors.error;
    case 'warning': return theme.colors.warning;
    case 'info': return theme.colors.info;
    default: return theme.colors.textDim;
  }
}

function formatMode(mode: string): string {
  const modeLabels: Record<string, string> = {
    safe: `${theme.colors.success}SAFE${theme.colors.text}`,
    guided: `${theme.colors.warning}GUIDED${theme.colors.text}`,
    full_auto: `${theme.colors.error}FULL AUTO${theme.colors.text}`,
  };
  return modeLabels[mode] || mode;
}

export async function securityCommand(
  action?: string,
  sub?: string,
  options?: Record<string, unknown>,
): Promise<void> {
  const effectiveAction = action || 'status';

  switch (effectiveAction) {
    case 'status': {
      const profile = getTrustProfile();
      const mode = getAutoMode();
      const vault = getVault();
      const events = getSecurityEvents();
      const perms = getPermissions();
      const vaultKeys = vault.isInitialized() ? await vault.list() : [];

      console.log(`\n  ${theme.colors.primary}${theme.icon.shield} Security Status${theme.colors.text}\n`);
      console.log(`  ${theme.colors.textDim}Trust Profile:${theme.colors.text}  ${colorForLevel(profile.getProfile())}${profile.getProfile().replace('_', ' ').toUpperCase()}${theme.colors.text}`);
      console.log(`  ${theme.colors.textDim}Auto Mode:${theme.colors.text}     ${formatMode(mode.getMode())}`);
      console.log(`  ${theme.colors.textDim}Vault:${theme.colors.text}         ${vault.isInitialized() ? `${theme.colors.success}Initialized${theme.colors.text} (${vaultKeys.length} key(s))` : `${theme.colors.warning}Not initialized${theme.colors.text}`}`);
      console.log(`  ${theme.colors.textDim}Events:${theme.colors.text}        ${events.size} recorded`);
      console.log(`  ${theme.colors.textDim}Permissions:${theme.colors.text}   ${perms.getRules().length} rule(s)\n`);

      const summary = events.getSummary();
      if (summary.total > 0) {
        console.log(`  ${theme.colors.primary}Event Summary${theme.colors.text}`);
        console.log(`  ${theme.colors.textDim}  Info:${theme.colors.text}     ${summary.info}`);
        console.log(`  ${theme.colors.textDim}  Warnings:${theme.colors.text}  ${summary.warnings}`);
        console.log(`  ${theme.colors.textDim}  Critical:${theme.colors.text}  ${summary.critical}\n`);
      }

      if (summary.critical > 0 || summary.warnings > 0) {
        console.log(`  ${theme.colors.warning}Recent Warnings:${theme.colors.text}`);
        const recent = events.getRecentEvents(5).filter((e) => e.severity !== 'info');
        for (const event of recent) {
          const sevColor = colorForSeverity(event.severity);
          console.log(`  ${sevColor}${theme.icon.dot}${theme.colors.text} ${event.message}`);
        }
        console.log();
      }

      break;
    }

    case 'profile': {
      const profile = getTrustProfile();
      if (sub && ['safe', 'balanced', 'full_auto'].includes(sub)) {
        profile.setProfile(sub as TrustProfile);
        console.log(`\n  ${theme.colors.success}${theme.icon.check} Trust profile set to: ${colorForLevel(sub)}${sub.replace('_', ' ').toUpperCase()}${theme.colors.text}\n`);
      } else {
        const current = profile.getConfig();
        console.log(`\n  ${theme.colors.primary}${theme.icon.shield} Current Trust Profile${theme.colors.text}\n`);
        console.log(`  ${theme.colors.textDim}Profile:${theme.colors.text}        ${colorForLevel(profile.getProfile())}${profile.getProfile().replace('_', ' ').toUpperCase()}${theme.colors.text}`);
        console.log(`  ${theme.colors.textDim}Dangerous Commands:${theme.colors.text} ${current.allowDangerousCommands ? `${theme.colors.error}Allowed${theme.colors.text}` : `${theme.colors.success}Blocked${theme.colors.text}`}`);
        console.log(`  ${theme.colors.textDim}Medium Risk Approval:${theme.colors.text}  ${current.requireApprovalForMedium ? `${theme.colors.warning}Required${theme.colors.text}` : `${theme.colors.success}Auto${theme.colors.text}`}`);
        console.log(`  ${theme.colors.textDim}Max Depth:${theme.colors.text}      ${current.maxExecutionDepth}`);
        console.log(`  ${theme.colors.textDim}Timeout:${theme.colors.text}        ${current.workflowTimeoutMs}ms\n`);

        console.log(`  ${theme.colors.primary}Available Profiles${theme.colors.text}`);
        const descriptions = TrustProfileSystem.getProfileDescriptions();
        for (const desc of descriptions) {
          const c = colorForLevel(desc.name);
          console.log(`  ${c}${theme.icon.dot}${theme.colors.text} ${desc.name.replace('_', ' ').toUpperCase()} — ${desc.description}`);
        }
        console.log(`\n  ${theme.colors.textDim}Usage: autic security profile <safe|balanced|full_auto>${theme.colors.text}\n`);
      }
      break;
    }

    case 'permissions': {
      const perms = getPermissions();
      const rules = perms.getRules();

      if (sub === 'list' || !sub) {
        console.log(`\n  ${theme.colors.primary}${theme.icon.shield} Permission Rules${theme.colors.text}\n`);
        if (rules.length === 0) {
          console.log(`  ${theme.colors.textDim}No permission rules configured.${theme.colors.text}\n`);
        } else {
          for (const rule of rules) {
            const color = rule.effect === 'allow' ? theme.colors.success : theme.colors.error;
            const icon = rule.effect === 'allow' ? theme.icon.check : theme.icon.cross;
            const level = rule.level || 'medium';
            const levelColor = colorForLevel(level);
            console.log(`  ${color}${icon}${theme.colors.text} ${rule.action} on ${rule.resource} ${color}${rule.effect}${theme.colors.text} ${levelColor}(${level})${theme.colors.text}`);
          }
          console.log();
        }
      } else {
        console.log(`\n  ${theme.colors.warning}Unknown subcommand: ${sub}${theme.colors.text}\n`);
      }
      break;
    }

    case 'events': {
      const events = getSecurityEvents();
      const limit = options?.limit ? Number(options.limit) : 20;

      console.log(`\n  ${theme.colors.primary}${theme.icon.shield} Security Events (last ${limit})${theme.colors.text}\n`);

      const allEvents = events.getRecentEvents(limit);
      if (allEvents.length === 0) {
        console.log(`  ${theme.colors.textDim}No security events recorded.${theme.colors.text}\n`);
      } else {
        for (const event of allEvents) {
          const sevColor = colorForSeverity(event.severity);
          const time = new Date(event.timestamp).toLocaleTimeString();
          console.log(`  ${sevColor}${theme.icon.dot}${theme.colors.text} [${time}] ${event.message}`);
        }
        console.log();
      }
      break;
    }

    case 'vault': {
      const vault = getVault();
      console.log(`\n  ${theme.colors.primary}${theme.icon.shield} Vault Status${theme.colors.text}\n`);

      if (!vault.isInitialized()) {
        console.log(`  ${theme.colors.warning}Vault not initialized. Set AUTIC_VAULT_KEY or run init.${theme.colors.text}\n`);
      } else {
        const keys = await vault.listKeys();
        console.log(`  ${theme.colors.textDim}Status:${theme.colors.text}  ${theme.colors.success}Initialized${theme.colors.text}`);
        console.log(`  ${theme.colors.textDim}Keys:${theme.colors.text}    ${keys.length}\n`);

        if (keys.length > 0) {
          console.log(`  ${theme.colors.primary}Stored Keys${theme.colors.text}`);
          for (const entry of keys.slice(0, 10)) {
            const prefix = await vault.getKeyPrefix(entry.key);
            console.log(`  ${theme.icon.dot} ${entry.key}: ${theme.colors.textDim}${prefix || '[unknown]'}${theme.colors.text}`);
          }
          if (keys.length > 10) {
            console.log(`  ${theme.colors.textDim}  ... and ${keys.length - 10} more${theme.colors.text}`);
          }
          console.log();
        }
      }
      break;
    }

    case 'help':
    default: {
      console.log(`\n  ${theme.colors.primary}${theme.icon.shield} Security Command Usage${theme.colors.text}\n`);
      console.log(`  ${theme.colors.textDim}autic security${theme.colors.text}               Show security status`);
      console.log(`  ${theme.colors.textDim}autic security status${theme.colors.text}         Show detailed security status`);
      console.log(`  ${theme.colors.textDim}autic security profile${theme.colors.text}        Show current trust profile`);
      console.log(`  ${theme.colors.textDim}autic security profile <name>${theme.colors.text}  Set trust profile (safe/balanced/full_auto)`);
      console.log(`  ${theme.colors.textDim}autic security permissions${theme.colors.text}     List permission rules`);
      console.log(`  ${theme.colors.textDim}autic security events${theme.colors.text}         Show recent security events`);
      console.log(`  ${theme.colors.textDim}autic security vault${theme.colors.text}          Show vault status\n`);
      break;
    }
  }
}

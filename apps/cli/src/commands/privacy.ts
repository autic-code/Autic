/**
 * CLI command: autic privacy
 * Configure privacy mode: normal, local_only, or offline.
 */

import { theme } from '@autic/ui';
import { PrivacyManager } from '@autic/security';
import { SecurityEventSystem } from '@autic/security';
import type { PrivacyMode } from '@autic/security';

let privacyManager: PrivacyManager | null = null;

function getPrivacyManager(): PrivacyManager {
  if (!privacyManager) {
    privacyManager = new PrivacyManager('normal', new SecurityEventSystem());
  }
  return privacyManager;
}

function formatPrivacyMode(mode: string): string {
  const modeLabels: Record<string, string> = {
    normal: `${theme.colors.success}NORMAL${theme.colors.text}`,
    local_only: `${theme.colors.warning}LOCAL ONLY${theme.colors.text}`,
    offline: `${theme.colors.error}OFFLINE${theme.colors.text}`,
  };
  return modeLabels[mode] || mode;
}

export async function privacyCommand(action?: string, sub?: string): Promise<void> {
  const effectiveAction = action || 'status';

  switch (effectiveAction) {
    case 'status': {
      const pm = getPrivacyManager();
      const config = pm.getConfig();
      const allowedProviders = pm.getAllowedProviders();

      console.log(
        `\n  ${theme.colors.primary}${theme.icon.shield} Privacy Mode${theme.colors.text}\n`,
      );
      console.log(
        `  ${theme.colors.textDim}Mode:${theme.colors.text}         ${formatPrivacyMode(pm.getMode())}`,
      );
      console.log(
        `  ${theme.colors.textDim}Outbound:${theme.colors.text}     ${config.blockOutboundRequests ? `${theme.colors.error}Blocked${theme.colors.text}` : `${theme.colors.success}Allowed${theme.colors.text}`}`,
      );
      console.log(
        `  ${theme.colors.textDim}Telemetry:${theme.colors.text}    ${config.disableTelemetry ? `${theme.colors.warning}Disabled${theme.colors.text}` : `${theme.colors.success}Enabled${theme.colors.text}`}`,
      );
      console.log(
        `  ${theme.colors.textDim}Cloud Sync:${theme.colors.text}   ${config.disableCloudSync ? `${theme.colors.warning}Disabled${theme.colors.text}` : `${theme.colors.success}Enabled${theme.colors.text}`}`,
      );
      console.log(
        `  ${theme.colors.textDim}Providers:${theme.colors.text}    ${allowedProviders.join(', ')}\n`,
      );
      break;
    }

    case 'set': {
      const mode = sub as PrivacyMode;
      if (!['normal', 'local_only', 'offline'].includes(mode)) {
        console.log(
          `\n  ${theme.colors.warning}Invalid mode. Use: normal, local_only, or offline${theme.colors.text}\n`,
        );
        return;
      }

      const pm = getPrivacyManager();
      pm.setMode(mode);
      console.log(
        `\n  ${theme.colors.success}${theme.icon.check} Privacy mode set to: ${formatPrivacyMode(mode)}\n`,
      );

      if (mode === 'offline') {
        console.log(
          `  ${theme.colors.warning}${theme.icon.dot} Offline mode: all outbound requests blocked.${theme.colors.text}`,
        );
        console.log(
          `  ${theme.colors.warning}${theme.icon.dot} Only local providers (Ollama) available.${theme.colors.text}`,
        );
      } else if (mode === 'local_only') {
        console.log(
          `  ${theme.colors.warning}${theme.icon.dot} Local-only mode: cloud sync and telemetry disabled.${theme.colors.text}`,
        );
      }
      console.log();
      break;
    }

    case 'help':
    default: {
      console.log(
        `\n  ${theme.colors.primary}${theme.icon.shield} Privacy Command Usage${theme.colors.text}\n`,
      );
      console.log(
        `  ${theme.colors.textDim}autic privacy${theme.colors.text}                   Show current privacy status`,
      );
      console.log(
        `  ${theme.colors.textDim}autic privacy status${theme.colors.text}            Show detailed privacy status`,
      );
      console.log(
        `  ${theme.colors.textDim}autic privacy set normal${theme.colors.text}        Full connectivity`,
      );
      console.log(
        `  ${theme.colors.textDim}autic privacy set local_only${theme.colors.text}    Local providers only`,
      );
      console.log(
        `  ${theme.colors.textDim}autic privacy set offline${theme.colors.text}       Fully isolated mode\n`,
      );
      break;
    }
  }
}

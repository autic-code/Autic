/**
 * Styled text rendering utilities for the terminal.
 */

import { theme } from '../theme.js';

export type TextVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'dim'
  | 'muted'
  | 'bold';

const variantColors: Record<TextVariant, string> = {
  default: theme.colors.text,
  primary: theme.colors.primary,
  success: theme.colors.success,
  warning: theme.colors.warning,
  error: theme.colors.error,
  dim: theme.colors.textDim,
  muted: theme.colors.textMuted,
  bold: theme.colors.text,
};

export function colorText(text: string, variant: TextVariant = 'default'): string {
  const color = variantColors[variant];
  if (variant === 'bold') {
    return `\x1b[1m${text}\x1b[0m`;
  }
  return `\x1b[38;2;${hexToRgb(color)}m${text}\x1b[0m`;
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '226,232,240';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

export function label(text: string, variant: TextVariant = 'primary'): string {
  return colorText(`[${text}]`, variant);
}

export function heading(text: string): string {
  return `${colorText('❯', 'primary')} ${colorText(text, 'bold')}`;
}

export function divider(length = 60): string {
  return colorText(theme.icon.divider.repeat(length), 'muted');
}

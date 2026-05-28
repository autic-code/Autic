/**
 * Styled box component for creating visually distinct terminal sections.
 */

import { theme } from '../theme.js';

export interface BoxOptions {
  title?: string;
  border?: boolean;
  padding?: number;
  width?: number;
  color?: string;
}

export function createBox(options: BoxOptions = {}): string {
  const { title, border = true, padding = 1, width = 80, color = theme.colors.primary } = options; // Calculate content area — width is used for border sizing
  const horizontalBorder = theme.icon.divider.repeat(width - 2);
  const paddingLine = `│${' '.repeat(width - 2)}│`;

  const lines: string[] = [];

  if (border) {
    if (title) {
      const titleStr = ` ${title} `;
      const prefix = horizontalBorder.slice(0, 2);
      const suffix = horizontalBorder.slice(2 + titleStr.length);
      lines.push(`${prefix}${colorize(titleStr, color)}${suffix}┐`);
    } else {
      lines.push(`┌${horizontalBorder}┐`);
    }
  }

  for (let i = 0; i < padding; i++) {
    lines.push(paddingLine);
  }

  return lines.join('\n');
}

function colorize(text: string, color: string): string {
  return `\x1b[38;2;${hexToRgb(color)}m${text}\x1b[0m`;
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '74,158,255';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

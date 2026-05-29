#!/usr/bin/env node

/**
 * Autic CLI bundle script.
 *
 * Bundles all @autic/* internal packages into the CLI distribution
 * so the package can be published to npm as a standalone installable CLI.
 *
 * External dependencies (commander, ink, react) remain as proper
 * npm dependencies since they are available on the public registry
 * and are kept in the published package.json's dependencies field.
 */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function main() {
  const start = Date.now();

  const distDir = path.join(rootDir, 'dist');
  const outFile = path.join(distDir, 'index.js');

  // Ensure dist directory exists
  fs.mkdirSync(distDir, { recursive: true });

  // External dependencies that remain as npm deps
  const external = [
    'commander',
    'ink',
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'scheduler',
    'scheduler/tracing',
  ];

  // Build the bundle
  const result = await esbuild.build({
    entryPoints: [path.join(rootDir, 'src/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: outFile,
    external,
    sourcemap: false,
    minify: false,
    banner: {
      js: `/**
 * Autic v0.1.0 — CLI-native autonomous AI engineering runtime.
 * Bundled distribution. Source: https://github.com/autic/autic
 */`,
    },
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
    },
    jsx: 'automatic',
    mainFields: ['module', 'main'],
    conditions: ['import', 'module', 'node'],
  });

  // Prepend shebang, stripping any shebangs preserved from source files
  let content = fs.readFileSync(outFile, 'utf-8');
  content = content.replace(/^#!.*\n/, '');
  fs.writeFileSync(outFile, `#!/usr/bin/env node\n${content}`, 'utf-8');

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  const stats = fs.statSync(outFile);

  console.log(`\n  ✓ Bundle complete (${duration}s)`);
  console.log(`  Output: dist/index.js (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`  Warnings: ${result.warnings.length}`);

  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.log(`    ⚠ ${w.text}`);
    }
  }

  console.log('');
}

main().catch((err) => {
  console.error('Bundle failed:', err.message);
  process.exit(1);
});

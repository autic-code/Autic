/**
 * autic template — Workspace template scaffolding command.
 *
 * Scaffolds new projects from built-in templates:
 * saas-starter, cli-starter, api-starter, ai-tool-starter
 */

import { TemplateRegistry } from '@autic/templates';
import * as path from 'node:path';

/**
 * Run template command
 */
export async function templateCommand(
  templateName?: string,
  targetDir?: string,
): Promise<void> {
  const registry = new TemplateRegistry();

  // List templates
  if (!templateName || templateName === 'list') {
    const templates = registry.getAll();
    console.log('\n  Available templates:');
    console.log('  ─────────────────────────────────────────────────');
    for (const t of templates) {
      console.log(`  ${t.name.padEnd(20)} ${t.description}`);
      console.log(`  ${''.padEnd(4)}ID: ${t.id}  |  Tags: ${t.tags.join(', ')}`);
      console.log();
    }
    return;
  }

  // Get template
  const template = registry.get(templateName);
  if (!template) {
    console.log(`\n  ✗ Template not found: ${templateName}`);
    console.log('  Run `autic template list` to see available templates.');
    return;
  }

  const target = targetDir ?? templateName;
  const fullPath = path.resolve(process.cwd(), target);

  console.log(`\n  Scaffolding "${template.name}" → ${fullPath}...`);

  const result = await registry.scaffold(templateName, {
    targetDir: fullPath,
    variables: {
      project_name: target,
      description: template.description,
      cli_name: target,
      tool_name: target,
    },
    overwrite: false,
  });

  if (result.success) {
    console.log(`  ✓ Created ${result.createdFiles.length} file(s)`);
    for (const file of result.createdFiles) {
      console.log(`    → ${file}`);
    }

    if (result.warnings.length > 0) {
      for (const w of result.warnings) {
        console.log(`  ⚠ ${w}`);
      }
    }

    if (template.nextSteps?.length) {
      console.log('\n  Next steps:');
      for (const step of template.nextSteps) {
        console.log(`  ${step}`);
      }
    }
  } else {
    console.log(`  ✗ Scaffolding failed:`);
    for (const err of result.errors) {
      console.log(`    ${err.error}`);
    }
  }
}

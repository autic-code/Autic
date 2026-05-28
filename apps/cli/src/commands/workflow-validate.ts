/**
 * CLI command: autic workflow-validate
 * Run workflow validation against real project types (TypeScript, Next.js, Python, etc.)
 */

import { WorkflowValidator } from '@autic/validation';
import { theme } from '@autic/ui';
import { colorText, heading, divider } from '@autic/ui';

export async function workflowValidateCommand(action?: string): Promise<void> {
  const validator = new WorkflowValidator();

  console.log(heading('Workflow Validation'));
  console.log(divider());

  switch (action) {
    case 'typescript':
    case 'ts': {
      console.log(`  ${colorText('⟳', 'primary')} Validating against TypeScript project...`);
      const result = await validator.validateTypeScriptProject();
      printResult(result);
      break;
    }
    case 'nextjs':
    case 'next': {
      console.log(`  ${colorText('⟳', 'primary')} Validating against Next.js project...`);
      const result = await validator.validateNextJSProject();
      printResult(result);
      break;
    }
    case 'python':
    case 'py': {
      console.log(`  ${colorText('⟳', 'primary')} Validating against Python project...`);
      const result = await validator.validatePythonProject();
      printResult(result);
      break;
    }
    case 'saas': {
      console.log(`  ${colorText('⟳', 'primary')} Validating against SaaS repository...`);
      const result = await validator.validateSaasRepository();
      printResult(result);
      break;
    }
    case 'monorepo': {
      console.log(`  ${colorText('⟳', 'primary')} Validating against large monorepo...`);
      const result = await validator.validateMonorepo();
      printResult(result);
      break;
    }
    case 'cli': {
      console.log(`  ${colorText('⟳', 'primary')} Validating against CLI repository...`);
      const result = await validator.validateCLIRepository();
      printResult(result);
      break;
    }
    case 'all':
    default: {
      // Run all validations
      const repoTypes = [
        { name: 'TypeScript', fn: () => validator.validateTypeScriptProject() },
        { name: 'Next.js', fn: () => validator.validateNextJSProject() },
        { name: 'Python', fn: () => validator.validatePythonProject() },
        { name: 'SaaS', fn: () => validator.validateSaasRepository() },
        { name: 'Monorepo', fn: () => validator.validateMonorepo() },
        { name: 'CLI', fn: () => validator.validateCLIRepository() },
      ];

      console.log(`  ${colorText('Starting full workflow validation suite...', 'primary')}\n`);

      for (const repo of repoTypes) {
        console.log(`  ${colorText('⟳', 'primary')} Validating ${repo.name}...`);
        const result = await repo.fn();
        printResult(result);
        console.log('');
      }

      // Print summary
      const allResults = await validator.runAllValidations();
      console.log(divider());
      console.log(`  ${colorText('Summary', 'bold')}`);
      console.log(`  Total validations: ${allResults.length}`);
      console.log(`  Passed: ${colorText(allResults.filter(r => r.success).length.toString(), 'success')}`);
      console.log(`  Failed: ${colorText(allResults.filter(r => !r.success).length.toString(), 'error')}`);
      break;
    }
  }
}

function printResult(result: { success: boolean; metrics: Record<string, number>; issues: string[] }): void {
  const icon = result.success ? colorText('✓', 'success') : colorText('✗', 'error');
  const status = result.success ? colorText('PASSED', 'success') : colorText('FAILED', 'error');
  console.log(`  ${icon} ${status}`);

  for (const [key, value] of Object.entries(result.metrics)) {
    console.log(`    ${colorText(key + ':', 'dim')} ${value}`);
  }

  if (result.issues.length > 0) {
    for (const issue of result.issues) {
      console.log(`    ${colorText('⚠', 'warning')} ${issue}`);
    }
  }
}

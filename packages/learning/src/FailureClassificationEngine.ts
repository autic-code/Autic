/**
 * FailureClassificationEngine — Enhanced failure classification building on the existing FailureClassifier.
 *
 * Adds:
 *   - Framework-aware classification (React, Next.js, Express, etc.)
 *   - Dependency failure classification (version conflicts, missing packages)
 *   - TypeScript/build/lint categorization with TS error codes
 *   - Provider/runtime failure categories
 *   - Retry analysis foundation
 *
 * All classification is deterministic — no ML or heuristics learning.
 */

import type { EnhancedFailureClassification, FailureCategory } from '@autic/shared';

interface FrameworkPattern {
  patterns: string[];
  framework: string;
}

interface DependencyPattern {
  patterns: string[];
  dependency: string;
  category: FailureCategory;
}

export class FailureClassificationEngine {
  private frameworkPatterns: FrameworkPattern[] = [
    { patterns: ['next/', 'next/navigation', 'next/link', 'getStaticProps'], framework: 'Next.js' },
    { patterns: ['react-', 'useState', 'useEffect', 'useRef', 'jsx', 'tsx'], framework: 'React' },
    { patterns: ['express', 'req.', 'res.', 'app.'], framework: 'Express' },
    { patterns: ['vue/', 'v-on:', 'v-bind:', 'v-model'], framework: 'Vue' },
    { patterns: ['@angular/', 'ng-', 'injectable', 'component'], framework: 'Angular' },
    { patterns: ['prisma/client', 'prisma generate', 'prisma schema'], framework: 'Prisma' },
    { patterns: ['trpc', 'tRPC'], framework: 'tRPC' },
    { patterns: ['zustand', 'redux', 'redux toolkit'], framework: 'Redux' },
    { patterns: ['tailwindcss', 'tailwind.config', '@tailwind'], framework: 'Tailwind CSS' },
    { patterns: ['jest.', 'describe(', 'it(', 'expect('], framework: 'Jest' },
    { patterns: ['vitest', 'vi.', 'test('], framework: 'Vitest' },
    { patterns: ['eslint', '.eslintrc'], framework: 'ESLint' },
    { patterns: ['prettier', '.prettierrc'], framework: 'Prettier' },
    { patterns: ['openrouter', '@openrouter'], framework: 'OpenRouter' },
    { patterns: ['ollama', '@ollama'], framework: 'Ollama' },
    { patterns: ['discord.js', 'discord-api'], framework: 'Discord.js' },
    { patterns: ['drizzle-', 'drizzleorm'], framework: 'Drizzle ORM' },
  ];

  private dependencyPatterns: DependencyPattern[] = [
    { patterns: ['cannot find module', 'module not found', 'import resolution'], dependency: 'import', category: 'dependency' },
    { patterns: ['peer dependency', 'version mismatch', 'incompatible'], dependency: 'peer_dependency', category: 'dependency' },
    { patterns: ['npm error', 'pnpm error', 'yarn error', 'install failed'], dependency: 'package_manager', category: 'dependency' },
    { patterns: ['enoent', 'no such file', 'does not exist'], dependency: 'file_system', category: 'dependency' },
    { patterns: ['ts2304', 'ts2322', 'ts6133', 'ts2352', 'ts6196', 'ts2345', 'ts2554'], dependency: 'typescript', category: 'compilation_error' },
    { patterns: ['ts18002', 'ts18003', 'ts18004'], dependency: 'typescript_config', category: 'compilation_error' },
    { patterns: ['@types/', 'missing type', 'type declaration'], dependency: 'type_definitions', category: 'dependency' },
    { patterns: ['polyfill', 'babel', 'esbuild', 'vite'], dependency: 'bundler', category: 'compilation_error' },
  ];

  private tsErrorCodes: Record<string, string> = {
    ts2304: 'Cannot find name — missing import or type definition',
    ts2322: 'Type not assignable — incorrect type annotation',
    ts2345: 'Argument of type is not assignable — wrong function parameter type',
    ts2352: 'Conversion of type may be a mistake — invalid type cast',
    ts2554: 'Expected X arguments but got Y — wrong number of function arguments',
    ts6133: 'Variable declared but never used',
    ts6196: 'Variable is declared but its value is never read',
    ts18002: 'The config file is not found',
    ts18003: 'No inputs were found in config file',
    ts18004: 'No value exists for this in the config',
  };

  classify(params: {
    error: string;
    stepType?: string;
    toolName?: string;
    exitCode?: number;
    durationMs?: number;
    framework?: string;
  }): EnhancedFailureClassification {
    const { error, stepType, toolName, durationMs } = params;
    const lower = error.toLowerCase();

    // Detect framework from error context
    const detectedFramework = params.framework || this.detectFramework(error);

    // Check for TS error codes
    const tsErrorCode = this.detectTsErrorCode(error);
    const isBuildError = this.matchesAny(lower, ['build failed', 'compilation', 'compile error', 'tsc exited', 'build error']);
    const isLintError = this.matchesAny(lower, ['lint error', 'eslint', 'prettier', 'linting']);
    const isTypeError = this.matchesAny(lower, ['type error', 'typeerror', 'is not assignable', 'is declared but', 'ts2304', 'ts2322', 'ts2345', 'ts2554', 'ts6133', 'ts6196']);
    const isProviderError = this.matchesAny(lower, ['provider', 'api key', 'openrouter', 'ollama', 'rate limit', 'model not found', 'insufficient quota', 'auth failed']);
    const isRuntimeError = this.matchesAny(lower, ['crash', 'segfault', 'segmentation fault', 'abort', 'panic', 'out of memory', 'runtime crash']);

    // Check dependency patterns
    const depMatch = this.dependencyPatterns.find((d) =>
      d.patterns.some((p) => lower.includes(p)),
    );

    // Existing FailureClassifier-style logic with enhancements
    if (isProviderError) return this.enhanced('provider_error', error, detectedFramework, depMatch?.dependency, undefined, false, true, isLintError, isTypeError, isProviderError, isRuntimeError);
    if (isBuildError) return this.enhanced('compilation_error', error, detectedFramework, depMatch?.dependency, tsErrorCode, true, false, isLintError, isTypeError, isProviderError, isRuntimeError);
    if (isTypeError) return this.enhanced('type_error', error, detectedFramework, depMatch?.dependency, tsErrorCode, false, false, isLintError, isTypeError, isProviderError, isRuntimeError);
    if (isLintError) return this.enhanced('compilation_error', error, detectedFramework, depMatch?.dependency, undefined, true, false, isLintError, isTypeError, isProviderError, isRuntimeError);
    if (depMatch) return this.enhanced(depMatch.category, error, detectedFramework, depMatch.dependency, tsErrorCode, false, false, isLintError, isTypeError, isProviderError, isRuntimeError);

    // Tool errors
    if (toolName) return this.enhanced('tool_error', error, detectedFramework, undefined, undefined, false, true, isLintError, isTypeError, isProviderError, isRuntimeError);

    // Timeout
    if (this.matchesAny(lower, ['timeout', 'timed out', 'etimedout', 'econnrefused']) || (durationMs && durationMs > 60_000)) {
      return this.enhanced('timeout', error, detectedFramework, undefined, undefined, false, true, isLintError, isTypeError, isProviderError, isRuntimeError);
    }

    // Permission
    if (this.matchesAny(lower, ['permission denied', 'eacces', 'eprem', 'forbidden'])) {
      return this.enhanced('permission_denied', error, detectedFramework, undefined, undefined, false, false, isLintError, isTypeError, isProviderError, isRuntimeError);
    }

    // Verification
    if (stepType === 'verify' || this.matchesAny(lower, ['verification failed', 'test failed'])) {
      return this.enhanced('verification_failed', error, detectedFramework, undefined, undefined, false, false, isLintError, isTypeError, isProviderError, isRuntimeError);
    }

    // Runtime crash
    if (isRuntimeError) return this.enhanced('runtime_crash', error, detectedFramework, undefined, undefined, false, false, isLintError, isTypeError, isProviderError, isRuntimeError);

    // Default
    return this.enhanced('unknown', error, detectedFramework, undefined, tsErrorCode, false, true, isLintError, isTypeError, isProviderError, isRuntimeError);
  }

  private enhanced(
    category: FailureCategory,
    error: string,
    framework: string | undefined,
    dependency: string | undefined,
    tsErrorCode: string | undefined,
    isBuildError: boolean,
    isRetryable: boolean,
    isLintError: boolean,
    isTypeError: boolean,
    isProviderError: boolean,
    isRuntimeError: boolean,
  ): EnhancedFailureClassification {
    return {
      category,
      severity: category === 'runtime_crash' || category === 'permission_denied' ? 'high' : isRetryable ? 'medium' : 'low',
      retryable: isRetryable,
      retryStrategy: isRetryable ? 'backoff' : 'skip_step',
      description: error.slice(0, 200),
      framework,
      dependency,
      tsErrorCode,
      isBuildError,
      isLintError,
      isTypeError,
      isProviderError,
      isRuntimeError,
    };
  }

  private detectFramework(text: string): string | undefined {
    for (const fp of this.frameworkPatterns) {
      if (fp.patterns.some((p) => text.includes(p))) {
        return fp.framework;
      }
    }
    return undefined;
  }

  private detectTsErrorCode(text: string): string | undefined {
    const match = text.match(/ts\d{5}/i);
    if (match) {
      const code = match[0].toLowerCase();
      return this.tsErrorCodes[code] ? `${code}: ${this.tsErrorCodes[code]}` : code;
    }
    return undefined;
  }

  private matchesAny(text: string, patterns: string[]): boolean {
    return patterns.some((p) => text.includes(p));
  }
}

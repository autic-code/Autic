/**
 * Template Registry — manages reusable workspace templates
 * for scaffolding new Autic projects.
 */

import { EventEmitter } from 'events';


/**
 * Template metadata
 */
export interface Template {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template version */
  version: string;
  /** Human-readable description */
  description: string;
  /** Template category */
  category: 'starter' | 'example' | 'official' | 'community';
  /** Comma-separated tags */
  tags: string[];
  /** File structure definition */
  structure: TemplateFile[];
  /** Prerequisites description */
  prerequisites?: string;
  /** Post-scaffold instructions */
  nextSteps?: string[];
}

/**
 * Template file definition
 */
export interface TemplateFile {
  /** File path relative to project root */
  path: string;
  /** File content (template syntax with variables) */
  content: string;
  /** Whether this file is required */
  required: boolean;
  /** File description */
  description?: string;
}

/**
 * Template scaffolding options
 */
export interface ScaffoldOptions {
  /** Target directory */
  targetDir: string;
  /** Variable substitutions */
  variables: Record<string, string>;
  /** Whether to overwrite existing files */
  overwrite: boolean;
}

/**
 * Scaffolding result
 */
export interface ScaffoldResult {
  /** Whether scaffolding succeeded */
  success: boolean;
  /** Created files */
  createdFiles: string[];
  /** Errors encountered */
  errors: Array<{ path: string; error: string }>;
  /** Warnings */
  warnings: string[];
}

/**
 * Template Registry
 */
export class TemplateRegistry extends EventEmitter {
  private templates: Map<string, Template> = new Map();

  constructor() {
    super();
    this.registerDefaults();
  }

  /**
   * Register a template
   */
  register(template: Template): void {
    if (this.templates.has(template.id)) {
      throw new Error(`Template already registered: ${template.id}`);
    }
    this.templates.set(template.id, template);
    this.emit('registered', { id: template.id, name: template.name });
  }

  /**
   * Get a template by ID
   */
  get(id: string): Template | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all templates
   */
  getAll(): Template[] {
    return Array.from(this.templates.values());
  }

  /**
   * Find templates by category
   */
  findByCategory(category: Template['category']): Template[] {
    return this.getAll().filter((t) => t.category === category);
  }

  /**
   * Find templates by tag
   */
  findByTag(tag: string): Template[] {
    return this.getAll().filter((t) => t.tags.includes(tag));
  }

  /**
   * Search templates
   */
  search(query: string): Template[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.tags.some((tag) => tag.toLowerCase().includes(lower)),
    );
  }

  /**
   * Scaffold a project from a template
   */
  async scaffold(
    templateId: string,
    options: ScaffoldOptions,
  ): Promise<ScaffoldResult> {
    const template = this.templates.get(templateId);
    if (!template) {
      return {
        success: false,
        createdFiles: [],
        errors: [{ path: '', error: `Template not found: ${templateId}` }],
        warnings: [],
      };
    }

    const createdFiles: string[] = [];
    const errors: Array<{ path: string; error: string }> = [];
    const warnings: string[] = [];
    const fs = await import('node:fs');
    const path = await import('node:path');

    // Create target directory
    if (!fs.existsSync(options.targetDir)) {
      fs.mkdirSync(options.targetDir, { recursive: true });
    }

    // Process each template file
    for (const file of template.structure) {
      const fullPath = path.join(options.targetDir, file.path);
      const dir = path.dirname(fullPath);

      try {
        // Check if file exists
        if (fs.existsSync(fullPath) && !options.overwrite) {
          warnings.push(`Skipping existing file: ${file.path}`);
          continue;
        }

        // Create directory structure
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Apply variable substitution
        let content = file.content;
        for (const [key, value] of Object.entries(options.variables)) {
          content = content.replaceAll(`{{${key}}}`, value);
        }

        // Write file
        fs.writeFileSync(fullPath, content, 'utf-8');
        createdFiles.push(file.path);
      } catch (err) {
        errors.push({
          path: file.path,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const success = errors.length === 0;

    this.emit('scaffolded', {
      templateId,
      targetDir: options.targetDir,
      success,
      createdFiles: createdFiles.length,
      errors: errors.length,
    });

    return { success, createdFiles, errors, warnings };
  }

  /**
   * Register default built-in templates
   */
  private registerDefaults(): void {
    // SaaS starter template
    this.register({
      id: 'saas-starter',
      name: 'SaaS Starter',
      version: '1.0.0',
      description: 'Full-stack SaaS application starter with Autic integration',
      category: 'starter',
      tags: ['saas', 'web', 'full-stack', 'starter'],
      structure: [
        {
          path: 'package.json',
          content: `{
  "name": "{{project_name}}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "echo 'Starting development server...'",
    "build": "echo 'Building project...'",
    "start": "echo 'Starting production server...'"
  },
  "dependencies": {}
}
`,
          required: true,
          description: 'Project package.json',
        },
        {
          path: 'README.md',
          content: `# {{project_name}}

{{description}}

## Getting Started

1. Install dependencies: \`npm install\`
2. Start development: \`npm run dev\`
3. Build for production: \`npm run build\`

## Autic Integration

This project is Autic-ready. Use \`autic run\`, \`autic fix\`, or \`autic chat\` for AI-assisted development.
`,
          required: true,
          description: 'Project README',
        },
        {
          path: '.gitignore',
          content: `node_modules/
dist/
.env
*.log
`,
          required: true,
          description: 'Git ignore rules',
        },
        {
          path: 'src/index.ts',
          content: `/**
 * {{project_name}}
 * {{description}}
 */

console.log('Hello from {{project_name}}!');
`,
          required: true,
          description: 'Main entry point',
        },
        {
          path: 'tsconfig.json',
          content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
`,
          required: true,
          description: 'TypeScript configuration',
        },
      ],
      prerequisites: 'Node.js 20+ and npm/pnpm',
      nextSteps: [
        'Run `npm install` to install dependencies',
        'Edit `src/index.ts` to add your application logic',
        'Use `autic run` to execute tasks with AI assistance',
      ],
    });

    // CLI starter template
    this.register({
      id: 'cli-starter',
      name: 'CLI Starter',
      version: '1.0.0',
      description: 'Command-line tool starter with Autic integration',
      category: 'starter',
      tags: ['cli', 'terminal', 'starter'],
      structure: [
        {
          path: 'package.json',
          content: `{
  "name": "{{project_name}}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "{{cli_name}}": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^20.0.0"
  }
}
`,
          required: true,
        },
        {
          path: 'src/index.ts',
          content: `#!/usr/bin/env node

/**
 * {{project_name}}
 * {{description}}
 */

import { Command } from 'commander';

const program = new Command();

program
  .name('{{cli_name}}')
  .version('0.1.0')
  .description('{{description}}');

program
  .command('hello')
  .description('Say hello')
  .action(() => {
    console.log('Hello from {{project_name}}!');
  });

program.parse(process.argv);
`,
          required: true,
        },
        {
          path: 'tsconfig.json',
          content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
`,
          required: true,
        },
        {
          path: 'README.md',
          content: `# {{project_name}}

{{description}}

## Usage

\`\`\`bash
{{cli_name}} hello
\`\`\`

## Autic Integration

Use \`autic run\` to execute CLI tasks with AI assistance.
`,
          required: true,
        },
      ],
      prerequisites: 'Node.js 20+',
      nextSteps: [
        'Run `npm install` to install dependencies',
        'Run `npm run build` to build the CLI',
        'Run `{{cli_name}} hello` to test the CLI',
      ],
    });

    // API starter template
    this.register({
      id: 'api-starter',
      name: 'API Starter',
      version: '1.0.0',
      description: 'REST API server starter with TypeScript',
      category: 'starter',
      tags: ['api', 'rest', 'server', 'starter'],
      structure: [
        {
          path: 'package.json',
          content: `{
  "name": "{{project_name}}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0"
  }
}
`,
          required: true,
        },
        {
          path: 'src/index.ts',
          content: `/**
 * {{project_name}} — {{description}}
 */

import { createServer } from 'node:http';

const PORT = process.env.PORT ?? 3000;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Hello from {{project_name}}!' }));
});

server.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
`,
          required: true,
        },
        {
          path: 'tsconfig.json',
          content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
`,
          required: true,
        },
        {
          path: 'README.md',
          content: `# {{project_name}}

{{description}}

## Usage

\`\`\`bash
npm run dev
# Server running on http://localhost:3000
\`\`\`

## Autic Integration

Use \`autic chat\` or \`autic run\` for AI-assisted API development.
`,
          required: true,
        },
      ],
      prerequisites: 'Node.js 20+',
      nextSteps: [
        'Run `npm install` to install dependencies',
        'Run `npm run dev` to start development server',
        'Add endpoints and business logic',
      ],
    });

    // AI tool starter template
    this.register({
      id: 'ai-tool-starter',
      name: 'AI Tool Starter',
      version: '1.0.0',
      description: 'AI-powered tool starter with Autic provider integration',
      category: 'starter',
      tags: ['ai', 'tool', 'llm', 'starter'],
      structure: [
        {
          path: 'package.json',
          content: `{
  "name": "{{project_name}}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0"
  }
}
`,
          required: true,
        },
        {
          path: 'src/index.ts',
          content: `/**
 * {{project_name}} — {{description}}
 *
 * AI-powered tool using Autic for LLM provider access.
 * Uses Autic providers via environment configuration.
 */

async function main() {
  const input = process.argv.slice(2).join(' ');
  console.log(\`{{project_name}} processing: "\${input}"\`);
  console.log('Use autic run to execute this with AI assistance.');
}

main().catch(console.error);
`,
          required: true,
        },
        {
          path: 'src/tool.ts',
          content: `/**
 * Tool definition for Autic provider integration
 */

export interface ToolConfig {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const tool: ToolConfig = {
  name: '{{tool_name}}',
  description: '{{description}}',
  parameters: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input to process',
      },
    },
  },
};
`,
          required: true,
        },
        {
          path: 'tsconfig.json',
          content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
`,
          required: true,
        },
      ],
      prerequisites: 'Node.js 20+, Autic configured with an LLM provider',
      nextSteps: [
        'Configure an Autic provider with `autic providers add`',
        'Run `autic chat` to interact with your tool',
        'Build custom tool integrations using the AI Tool pattern',
      ],
    });
  }
}

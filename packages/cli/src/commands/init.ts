/**
 * Init Command
 * Initialize a new OxygenClaw project
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';

export async function initCommand(options: {
  dir: string;
  template?: string;
}): Promise<void> {
  const targetDir = path.resolve(options.dir);
  const template = options.template || await promptTemplate();

  console.log(chalk.cyan(`\n🔧 Initializing OxygenClaw project in ${targetDir}`));
  console.log(chalk.gray(`Template: ${template}\n`));

  const spinner = ora('Creating project structure...').start();

  try {
    // Create directories
    await fs.ensureDir(targetDir);
    await fs.ensureDir(path.join(targetDir, 'src'));
    await fs.ensureDir(path.join(targetDir, 'config'));
    await fs.ensureDir(path.join(targetDir, 'data'));
    await fs.ensureDir(path.join(targetDir, 'logs'));

    // Create oxygen-claw.json config
    const config = generateConfig(template);
    await fs.writeJSON(path.join(targetDir, 'oxygen-claw.json'), config, { spaces: 2 });

    // Create package.json
    const pkg = {
      name: path.basename(targetDir),
      version: '26.0.0-alpha.1',
      dependencies: {
        '@oxygen-claw/core': '26.0.0-alpha.1'
      }
    };
    await fs.writeJSON(path.join(targetDir, 'package.json'), pkg, { spaces: 2 });

    // Create README
    await fs.writeFile(path.join(targetDir, 'README.md'), generateReadme(template));

    // Create .gitignore
    await fs.writeFile(path.join(targetDir, '.gitignore'), generateGitignore());

    spinner.succeed(chalk.green('Project structure created!'));

    // Print next steps
    console.log(chalk.cyan('\n📦 Next steps:'));
    console.log(`  cd ${path.basename(targetDir)}`);
    console.log(`  npm install`);
    console.log(`  oxygen-claw config --set mode=expert`);
    console.log(`  oxygen-claw run "Your first task"\n`);

  } catch (error) {
    spinner.fail(chalk.red('Failed to initialize project'));
    console.error(error);
    process.exit(1);
  }
}

async function promptTemplate(): Promise<string> {
  const { template } = await inquirer.prompt([
    {
      type: 'list',
      name: 'template',
      message: 'Select a template:',
      choices: [
        { name: 'Basic - Simple agent with default settings', value: 'basic' },
        { name: 'Advanced - Multi-agent with MCP and container support', value: 'advanced' },
        { name: 'GUI - Desktop automation with computer use', value: 'gui' },
        { name: 'Cloud - StepClaw-style cloud deployment', value: 'cloud' }
      ]
    }
  ]);
  return template;
}

function generateConfig(template: string): Record<string, unknown> {
  const baseConfig = {
    agent: {
      mode: 'expert',
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'YOUR_API_KEY'
      }
    },
    mcp: {
      servers: []
    },
    memory: {
      maxShortTermPages: 50,
      maxLongTermPages: 500
    },
    gateway: {
      port: 3000,
      apiKeys: []
    }
  };

  switch (template) {
    case 'advanced':
      return {
        ...baseConfig,
        agent: {
          ...baseConfig.agent,
          mode: 'task',
          enableMoA: true,
          maxAgents: 4
        },
        mcp: {
          servers: [
            {
              id: 'filesystem',
              transport: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed']
            }
          ]
        }
      };

    case 'gui':
      return {
        ...baseConfig,
        agent: {
          ...baseConfig.agent,
          mode: 'task',
          enableGUI: true,
          enableContainers: true
        },
        gui: {
          screenshotInterval: 1000,
          accessibilityTree: true
        }
      };

    case 'cloud':
      return {
        ...baseConfig,
        agent: {
          ...baseConfig.agent,
          mode: 'quick'
        },
        cloud: {
          endpoint: 'https://api.stepfun.com',
          deployTarget: 'cloud'
        }
      };

    default:
      return baseConfig;
  }
}

function generateReadme(template: string): string {
  return `# OxygenClaw Project

Generated with template: ${template}

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Configure
oxygen-claw config --set agent.model.apiKey=YOUR_KEY

# Run your first task
oxygen-claw run "Hello, OxygenClaw!"
\`\`\`

## Configuration

Edit \`oxygen-claw.json\` to customize your agent.

## Modes

- **quick**: Fast responses, 1 web search
- **expert**: Deep thinking, 10 web searches  
- **task**: Multi-agent MoA, L4-L5 reasoning

## Documentation

See https://github.com/oxygen-claw/docs
`;
}

function generateGitignore(): string {
  return `# Dependencies
node_modules/

# Build
dist/
build/

# Logs
logs/
*.log

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Secrets
.env
.env.local
*.key
`;
}

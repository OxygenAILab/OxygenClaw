/**
 * Config Command
 * Manage OxygenClaw configuration
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export async function configCommand(options: {
  list?: boolean;
  set?: string;
  get?: string;
  reset?: boolean;
}): Promise<void> {
  const configPath = getConfigPath();

  if (options.reset) {
    console.log(chalk.yellow('Resetting config to defaults...'));
    await fs.remove(configPath);
    console.log(chalk.green('Config reset complete.'));
    return;
  }

  if (options.list) {
    await listConfig(configPath);
    return;
  }

  if (options.get) {
    await getConfigValue(configPath, options.get);
    return;
  }

  if (options.set) {
    await setConfigValue(configPath, options.set);
    return;
  }

  // Interactive config
  await interactiveConfig(configPath);
}

async function listConfig(configPath: string): Promise<void> {
  if (!(await fs.pathExists(configPath))) {
    console.log(chalk.yellow('No config file found. Run init first.'));
    return;
  }

  const config = await fs.readJSON(configPath);
  console.log(chalk.cyan('\n📋 Current Configuration:\n'));

  function printConfig(obj: Record<string, unknown>, indent = 0): void {
    for (const [key, value] of Object.entries(obj)) {
      const prefix = '  '.repeat(indent);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        console.log(`${prefix}${chalk.cyan(key)}:`);
        printConfig(value as Record<string, unknown>, indent + 1);
      } else {
        const displayValue = typeof value === 'string' && value.length > 50 
          ? value.slice(0, 50) + '...' 
          : value;
        console.log(`${prefix}${chalk.white(key)} = ${chalk.yellow(String(displayValue))}`);
      }
    }
  }

  printConfig(config);
  console.log();
}

async function getConfigValue(configPath: string, key: string): Promise<void> {
  if (!(await fs.pathExists(configPath))) {
    console.log(chalk.yellow('No config file found.'));
    return;
  }

  const config = await fs.readJSON(configPath);
  const keys = key.split('.');
  let value: unknown = config;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      console.log(chalk.red(`Key not found: ${key}`));
      return;
    }
  }

  console.log(chalk.white(`${key} = ${chalk.yellow(String(value))}`));
}

async function setConfigValue(configPath: string, setStr: string): Promise<void> {
  let config: Record<string, unknown> = {};

  if (await fs.pathExists(configPath)) {
    config = await fs.readJSON(configPath);
  }

  const [key, value] = setStr.split('=');
  if (!key || value === undefined) {
    console.log(chalk.red('Invalid format. Use: key=value'));
    return;
  }

  const keys = key.split('.');
  let current = config;

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!(k in current) || typeof current[k] !== 'object') {
      current[k] = {};
    }
    current = current[k] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = parseValue(value);

  await fs.writeJSON(configPath, config, { spaces: 2 });
  console.log(chalk.green(`Set ${key} = ${value}`));
}

async function interactiveConfig(configPath: string): Promise<void> {
  console.log(chalk.cyan('\n⚙️  Interactive Configuration\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Default agent mode:',
      choices: ['quick', 'expert', 'task'],
      default: 'expert'
    },
    {
      type: 'input',
      name: 'model',
      message: 'Default model provider:',
      default: 'openai'
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key (leave empty to use env var):',
      default: ''
    },
    {
      type: 'confirm',
      name: 'enableMCP',
      message: 'Enable MCP support?',
      default: true
    },
    {
      type: 'confirm',
      name: 'enableGUI',
      message: 'Enable GUI control?',
      default: false
    }
  ]);

  const config: Record<string, unknown> = {
    agent: {
      mode: answers.mode,
      model: {
        provider: answers.model,
        apiKey: answers.apiKey || '${OPENAI_API_KEY}'
      }
    },
    mcp: {
      enabled: answers.enableMCP,
      servers: []
    },
    gui: {
      enabled: answers.enableGUI
    }
  };

  await fs.ensureDir(path.dirname(configPath));
  await fs.writeJSON(configPath, config, { spaces: 2 });

  console.log(chalk.green('\n✅ Configuration saved!'));
}

function parseValue(value: string): unknown {
  // Try to parse as JSON
  try {
    return JSON.parse(value);
  } catch {
    // Return as string
    return value;
  }
}

function getConfigPath(): string {
  return path.join(os.homedir(), '.oxygen-claw', 'config.json');
}

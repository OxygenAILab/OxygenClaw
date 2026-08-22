#!/usr/bin/env node
/**
 * OxygenClaw CLI
 * Main entry point with commander
 * Enhanced with model switching support
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { initCommand } from './commands/init';
import { runCommand } from './commands/run';
import { configCommand } from './commands/config';
import { mcpCommand } from './commands/mcp';
import { modelsCommand } from './commands/models';
import { gatewayCommand } from './commands/gateway';

const program = new Command();
const PACKAGE_VERSION = '26.0.0-alpha.1';
const DISPLAY_VERSION = 'v26.0 Alpha 1';

// CLI banner
const banner = gradient.pastel.multiline(`
  ____  _   _  ____   _____ _     _____ ____  
 |  _ \\| | | |/ ___| |  ___| |   | ____|  _ \\ 
 | |_) | | | | |  _  | |_  | |   |  _| | | | |
 |  __/| |_| | |_| | |  _| | |___| |___| |_| |
 |_|    \\___/ \\____| |_|   |_____|_____|____/
                                              
 Next-gen AI Agent Platform
 ${DISPLAY_VERSION} - Multi-Model Support
`);

program
  .name('oxygen-claw')
  .description('OxygenClaw - Integrated AI Agent Platform with MCP support and multi-model switching')
  .version(PACKAGE_VERSION);

program
  .command('init')
  .description('Initialize a new OxygenClaw project')
  .option('-d, --dir <path>', 'Project directory', './oxygen-claw-project')
  .option('--template <name>', 'Template to use (basic, advanced, gui)')
  .action(initCommand);

program
  .command('run <task>')
  .description('Run a task with the agent')
  .option('-m, --mode <mode>', 'Agent mode (quick, expert, task)', 'expert')
  .option('--model <id>', 'Model ID to use')
  .option('--switch-model <name>', 'Switch to model by name (e.g., gpt-4o, claude-3.5-sonnet)')
  .option('--max-searches <n>', 'Max web searches (expert mode)', '10')
  .option('--gui', 'Enable GUI control')
  .action(runCommand);

program
  .command('config')
  .description('Manage configuration')
  .option('--list', 'List current config')
  .option('--set <key=value>', 'Set config value')
  .option('--get <key>', 'Get config value')
  .option('--reset', 'Reset to defaults')
  .action(configCommand);

program
  .command('mcp')
  .description('Manage MCP servers')
  .option('--list', 'List connected MCP servers')
  .option('--add <config>', 'Add MCP server (JSON config)')
  .option('--remove <id>', 'Remove MCP server')
  .option('--connect <id>', 'Connect to MCP server')
  .option('--disconnect <id>', 'Disconnect from MCP server')
  .option('--tools <id>', 'List tools from MCP server')
  .action(mcpCommand);

program
  .command('models')
  .description('Manage LLM models')
  .option('--list', 'List available models')
  .option('--switch <name>', 'Switch to model by name (e.g., gpt-4o, claude)')
  .option('--current', 'Show current active model')
  .option('--history', 'Show model usage history')
  .option('--groups', 'Show model groups')
  .option('--import <file>', 'Import models from JSON file')
  .option('--add <json>', 'Add model from JSON')
  .option('--remove <id>', 'Remove model')
  .option('--match <keywords>', 'Find model by keywords')
  .action(modelsCommand);

program
  .command('gateway')
  .description('Manage the gateway server')
  .option('--start', 'Start gateway server')
  .option('--stop', 'Stop gateway server')
  .option('--status', 'Check gateway status')
  .option('--stats', 'Show gateway statistics')
  .option('--keys', 'Manage API keys')
  .action(gatewayCommand);

// Help text
program.addHelpText('after', `

${chalk.cyan('Examples:')}
  ${chalk.gray('# Run task with specific model')}
  oxygen-claw run "Analyze data" --switch-model gpt-4o

  ${chalk.gray('# Run with Claude')}
  oxygen-claw run "Write code" --switch-model claude-3.5-sonnet --mode expert

  ${chalk.gray('# Switch model interactively')}
  oxygen-claw models --switch gpt-4o

  ${chalk.gray('# List all models')}
  oxygen-claw models --list

  ${chalk.gray('# Show current model')}
  oxygen-claw models --current

  ${chalk.gray('# Find model by keywords')}
  oxygen-claw models --match "vision coding"

  ${chalk.gray('# Import models from JSON')}
  oxygen-claw models --import models.json

${chalk.cyan('Standard Model Names:')}
  OpenAI:    gpt-4o, gpt-4-turbo, gpt-4, gpt-3.5-turbo
  Anthropic: claude-3.5-sonnet, claude-3-opus, claude-3-haiku
  Google:    gemini-2.5-pro, gemini-2.5-flash, gemini-1.5-pro
  StepFun:   step-3.5-flash, step-2-16k
  DeepSeek:  deepseek-v3, deepseek-r1, deepseek-chat
  Alibaba:   qwen-2.5-72b, qwen-turbo, qwen-plus
  Meta:      llama-3.1-405b, llama-3.1-70b, llama-3
  Mistral:   mistral-large, mistral-medium, codestral

${chalk.cyan('Model Aliases:')}
  gpt-4o: gpt4o, gpt-4
  claude-3.5-sonnet: claude-3-5-sonnet, claude-sonnet
  gemini-2.5-pro: gemini-2.5, gemini-pro
  step-3.5-flash: step-3.5, stepfun-3.5
  deepseek-v3: deepseek-3
  qwen-2.5-72b: qwen-2.5, qwen-turbo
  llama-3.1-405b: llama-3.1, llama3
  mistral-large: mistral-large-latest

${chalk.cyan('Modes:')}
  quick   - Fast response, 1 web search, L1 thinking
  expert  - Deep thinking, 10 web searches, L3 thinking
  task    - MoA enabled, 4 agents max, L4-L5 thinking

${chalk.cyan('Docs:')} https://github.com/oxygen-claw/docs
`);

// Parse arguments
program.parse(process.argv);

// Show banner if no args
if (!process.argv.slice(2).length) {
  console.log(banner);
  console.log(boxen('Run oxygen-claw --help to see available commands', { padding: 1, borderColor: 'cyan' }));
}

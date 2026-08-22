/**
 * Models Command
 * Manage LLM models - with multi-model switching support
 */

import chalk from 'chalk';
import { ModelRegistry, createModelRegistry, normalizeModelName, suggestModelNames } from '@oxygen-claw/core';
import { ModelConfig } from '@oxygen-claw/core';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import path from 'path';
import os from 'os';

// Global model registry instance
let registry: ModelRegistry;

export async function modelsCommand(options: {
  list?: boolean;
  import?: string;
  add?: string;
  remove?: string;
  match?: string;
  switch?: string;
  current?: boolean;
  history?: boolean;
  groups?: boolean;
}): Promise<void> {
  // Initialize model registry
  registry = createModelRegistry();

  if (options.list) {
    await listModels(options);
    return;
  }

  if (options.import) {
    await importModels(options.import);
    return;
  }

  if (options.add) {
    await addModel(options.add);
    return;
  }

  if (options.remove) {
    await removeModel(options.remove);
    return;
  }

  if (options.match) {
    await matchModel(options.match);
    return;
  }

  if (options.switch) {
    await switchModel(options.switch);
    return;
  }

  if (options.current) {
    await showCurrentModel();
    return;
  }

  if (options.history) {
    await showModelHistory();
    return;
  }

  if (options.groups) {
    await listModelGroups();
    return;
  }

  // Interactive mode
  await interactiveModels();
}

async function listModels(options: { match?: string }): Promise<void> {
  let models = registry.listModels();

  // Filter if match provided
  if (options.match) {
    const lowerMatch = options.match.toLowerCase();
    models = models.filter((m: ModelConfig) =>
      m.name.toLowerCase().includes(lowerMatch) ||
      m.displayName.toLowerCase().includes(lowerMatch) ||
      m.keywords.some((k: string) => k.toLowerCase().includes(lowerMatch)) ||
      m.provider.toLowerCase().includes(lowerMatch)
    );
  }

  const activeModel = registry.getActiveModel();

  console.log(chalk.cyan('\n🤖 Available Models:\n'));

  // Group by provider
  const grouped = models.reduce((acc: Record<string, ModelConfig[]>, model: ModelConfig) => {
    const provider = model.provider;
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(model);
    return acc;
  }, {});

  for (const [provider, providerModels] of Object.entries(grouped)) {
    console.log(chalk.gray(`\n${provider}:`));
    
    for (const model of providerModels) {
      const isActive = activeModel?.id === model.id;
      const activeMarker = isActive ? chalk.green(' ● ACTIVE') : '';
      const deprecatedMarker = model.deprecated ? chalk.red(' ⚠ DEPRECATED') : '';
      
      console.log(`  ${model.icon} ${chalk.white(model.displayName)} ${chalk.gray(`(${model.name})`)}${activeMarker}${deprecatedMarker}`);
      console.log(chalk.gray(`     Provider: ${model.provider} | Context: ${(model.maxTokens / 1000).toFixed(0)}K | Vision: ${model.supportsVision ? '✓' : '✗'} | Tools: ${model.supportsTools ? '✓' : '✗'}`));
      if (model.aliases && model.aliases.length > 0) {
        console.log(chalk.gray(`     Aliases: ${model.aliases.slice(0, 5).join(', ')}`));
      }
    }
  }

  console.log(chalk.cyan('\n💡 Tip: Use --switch <model-name> to switch models'));
  console.log(chalk.gray('   Example: oxygen-claw models --switch gpt-4o\n'));
}

async function switchModel(modelName: string): Promise<void> {
  console.log(chalk.cyan(`\n🔄 Switching to model: ${chalk.white(modelName)}`));

  // Normalize model name
  const normalizedName = normalizeModelName(modelName);
  if (normalizedName !== modelName.toLowerCase()) {
    console.log(chalk.gray(`   Normalized to: ${normalizedName}`));
  }

  const result = registry.switchModel({ modelName: normalizedName });

  if (result) {
    console.log(chalk.green('\n✅ Model switched successfully!'));
    console.log(chalk.white(`   Model: ${result.displayName}`));
    console.log(chalk.gray(`   ID: ${result.id}`));
    console.log(chalk.gray(`   Provider: ${result.provider}`));
    console.log(chalk.gray(`   Context: ${(result.maxTokens / 1000).toFixed(0)}K tokens`));
    console.log(chalk.gray(`   Vision: ${result.supportsVision ? 'Supported' : 'Not supported'}`));
    console.log(chalk.gray(`   Tools: ${result.supportsTools ? 'Supported' : 'Not supported'}`));
  } else {
    console.log(chalk.red(`\n❌ Failed to switch: Model "${modelName}" not found`));
    
    // Suggest alternatives
    const suggestions = suggestModelNames(modelName);
    if (suggestions.length > 0) {
      console.log(chalk.gray(`\n   Did you mean?`));
      suggestions.forEach(s => console.log(chalk.gray(`     - ${s}`)));
    }
  }
}

async function showCurrentModel(): Promise<void> {
  const model = registry.getActiveModel();
  
  console.log(chalk.cyan('\n🎯 Current Active Model:\n'));
  
  if (!model) {
    console.log(chalk.yellow('No model selected. Use --switch <model-name> to select one.'));
    return;
  }

  console.log(chalk.white(`  Name: ${model.displayName}`));
  console.log(chalk.gray(`  ID: ${model.id}`));
  console.log(chalk.gray(`  Provider: ${model.provider}`));
  console.log(chalk.gray(`  Standard Name: ${model.name}`));
  console.log(chalk.gray(`  Context: ${(model.maxTokens / 1000).toFixed(0)}K tokens`));
  console.log(chalk.gray(`  Cost: $${model.costPer1KInput}/1K input, $${model.costPer1KOutput}/1K output`));
  console.log(chalk.gray(`  Vision: ${model.supportsVision ? '✓' : '✗'} | Tools: ${model.supportsTools ? '✓' : '✗'}`));
  
  if (model.aliases && model.aliases.length > 0) {
    console.log(chalk.gray(`  Aliases: ${model.aliases.join(', ')}`));
  }
}

async function showModelHistory(): Promise<void> {
  const history = registry.getHistory();
  
  console.log(chalk.cyan('\n📜 Model Usage History:\n'));
  
  if (history.length === 0) {
    console.log(chalk.gray('No models used yet.'));
    return;
  }

  for (let i = 0; i < history.length; i++) {
    const model = history[i];
    console.log(`  ${i + 1}. ${model.icon} ${chalk.white(model.displayName)} ${chalk.gray(`(${model.provider})`)}`);
  }
}

async function listModelGroups(): Promise<void> {
  console.log(chalk.cyan('\n📦 Model Groups:\n'));
  
  // Pre-defined groups
  const groups = [
    {
      name: 'Reasoning',
      description: 'Models optimized for reasoning and analysis',
      models: ['gpt-4o', 'claude-3.5-sonnet', 'deepseek-r1', 'gemini-2.5-pro']
    },
    {
      name: 'Coding',
      description: 'Models optimized for code generation',
      models: ['claude-3.5-sonnet', 'deepseek-v3', 'codestral']
    },
    {
      name: 'Fast',
      description: 'Fast and cost-effective models',
      models: ['gpt-4o-mini', 'claude-3-haiku', 'gemini-1.5-flash', 'step-3.5-flash']
    },
    {
      name: 'Vision',
      description: 'Models with vision capabilities',
      models: ['gpt-4o', 'claude-3.5-sonnet', 'gemini-2.5-pro', 'llama-3.1-405b']
    },
    {
      name: 'Chinese',
      description: 'Models optimized for Chinese language',
      models: ['qwen-2.5-72b', 'deepseek-v3', 'step-3.5-flash', 'yi-1.5-34b']
    }
  ];

  for (const group of groups) {
    console.log(chalk.white(`  ${group.name}:`));
    console.log(chalk.gray(`    ${group.description}`));
    console.log(chalk.gray(`    Models: ${group.models.join(', ')}`));
    console.log();
  }
}

async function importModels(filePath: string): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const result = registry.registerModelsFromJSON(content);

    console.log(chalk.cyan('\n📥 Importing Models:\n'));
    console.log(chalk.green(`  ✓ Registered: ${result.registered} models`));

    if (result.errors.length > 0) {
      console.log(chalk.red(`  ✗ Errors: ${result.errors.length}`));
      result.errors.forEach((e: string) => console.log(chalk.gray(`    - ${e}`)));
    }

    if (result.registered > 0) {
      console.log(chalk.gray('\n  Use --list to see all models'));
    }
  } catch (error) {
    console.log(chalk.red(`\n❌ Failed to import: ${error}`));
  }
}

async function addModel(modelJson: string): Promise<void> {
  try {
    const result = registry.registerModelsFromJSON(`[${modelJson}]`);
    console.log(chalk.green(`\n✅ Model added! (${result.registered} registered)`));
  } catch (error) {
    console.log(chalk.red(`\n❌ Invalid JSON: ${error}`));
  }
}

async function removeModel(modelName: string): Promise<void> {
  const model = registry.getModel(modelName);
  if (!model) {
    console.log(chalk.red(`\n❌ Model "${modelName}" not found.`));
    return;
  }

  const success = registry.removeModel(model.id);
  if (success) {
    console.log(chalk.green(`\n✅ Model "${model.displayName}" removed successfully.`));
  } else {
    console.log(chalk.red(`\n❌ Failed to remove model "${model.displayName}".`));
  }
}

async function matchModel(keywords: string): Promise<void> {
  const suggestions = suggestModelNames(keywords);

  console.log(chalk.cyan(`\n🔍 Matching models for "${keywords}":\n`));

  if (suggestions.length === 0) {
    console.log(chalk.gray('No matches found.'));
    console.log(chalk.gray('Try using standard names like: gpt-4o, claude-3.5-sonnet, gemini-2.5-pro'));
    return;
  }

  for (const name of suggestions) {
    const model = registry.getModel(name);
    if (model) {
      console.log(`  ${model.icon} ${chalk.white(model.displayName)} ${chalk.gray(`(${model.name})`)}`);
      console.log(chalk.gray(`     Provider: ${model.provider}`));
      console.log(chalk.gray(`     Context: ${(model.maxTokens / 1000).toFixed(0)}K tokens`));
      console.log(chalk.gray(`     Use: oxygen-claw models --switch ${model.name}`));
      console.log();
    }
  }
}

async function interactiveModels(): Promise<void> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Model action:',
      choices: [
        { name: 'List all models', value: 'list' },
        { name: 'Switch model', value: 'switch' },
        { name: 'Show current model', value: 'current' },
        { name: 'Show usage history', value: 'history' },
        { name: 'Import from JSON', value: 'import' },
        { name: 'Find model by keywords', value: 'match' },
        { name: 'Show model groups', value: 'groups' }
      ]
    }
  ]);

  switch (action) {
    case 'list':
      await listModels({});
      break;
    case 'switch':
      const { modelName } = await inquirer.prompt([
        { type: 'input', name: 'modelName', message: 'Enter model name to switch to:' }
      ]);
      await switchModel(modelName);
      break;
    case 'current':
      await showCurrentModel();
      break;
    case 'history':
      await showModelHistory();
      break;
    case 'import':
      const { file } = await inquirer.prompt([
        { type: 'input', name: 'file', message: 'JSON file path:' }
      ]);
      await importModels(file);
      break;
    case 'match':
      const { keywords } = await inquirer.prompt([
        { type: 'input', name: 'keywords', message: 'Enter keywords to search:' }
      ]);
      await matchModel(keywords);
      break;
    case 'groups':
      await listModelGroups();
      break;
  }
}

function getConfigPath(): string {
  return path.join(os.homedir(), '.oxygen-claw', 'config.json');
}

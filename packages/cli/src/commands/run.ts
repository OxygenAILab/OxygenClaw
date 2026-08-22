/**
 * Run Command
 * Execute tasks with the agent - with model switching support
 */

import chalk from 'chalk';
import ora from 'ora';
import { createAgent, createModelRegistry, normalizeModelName, suggestModelNames } from '@oxygen-claw/core';
import { CapabilityMode, MODE_CONFIGS, ModelConfig } from '@oxygen-claw/core';

export async function runCommand(task: string, options: {
  mode: string;
  model?: string;
  maxSearches?: string;
  gui?: boolean;
  switchModel?: string;
}): Promise<void> {
  const mode = (options.mode || 'expert') as CapabilityMode;
  const modeConfig = MODE_CONFIGS[mode];
  const taskModeConfig = modeConfig.task;
  
  // Initialize model registry
  const modelRegistry = createModelRegistry();
  
  // Handle model switching
  let selectedModel: ModelConfig | undefined;
  if (options.switchModel) {
    const normalizedName = normalizeModelName(options.switchModel);
    selectedModel = modelRegistry.getModel(normalizedName);
    if (!selectedModel) {
      const suggestions = suggestModelNames(options.switchModel);
      console.log(chalk.red(`\n❌ Model "${options.switchModel}" not found.`));
      console.log(chalk.gray(`Did you mean: ${suggestions.join(', ')}?`));
      process.exit(1);
    }
  } else if (options.model) {
    selectedModel = modelRegistry.getModel(options.model);
  } else {
    const activeModel = modelRegistry.getActiveModel();
    selectedModel = activeModel || undefined;
  }

  const modelName = selectedModel?.name || options.model || 'default';
  const modelDisplayName = selectedModel?.displayName || modelName;

  console.log(chalk.cyan(`\n🤖 OxygenClaw [${mode.toUpperCase()} mode]`));
  console.log(chalk.gray(`Task: ${task}`));
  console.log(chalk.gray(`Model: ${modelDisplayName} (${modelName})`));
  console.log(chalk.gray(`Max web searches: ${options.maxSearches || taskModeConfig.maxWebSearches}`));
  console.log(chalk.gray(`MoA enabled: ${taskModeConfig.enableMoA}\n`));

  const spinner = ora('Initializing agent...').start();

  try {
    // Create agent config
    const config = {
      mode,
      interactionMode: 'task' as const,
      model: selectedModel || {
        id: modelName,
        name: modelName,
        displayName: modelDisplayName,
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY || '',
        baseUrl: 'https://api.openai.com/v1',
        maxTokens: 4096,
        supportsVision: false,
        supportsTools: true,
        costPer1KInput: 0.01,
        costPer1KOutput: 0.03,
        keywords: ['gpt', 'openai']
      } as ModelConfig,
      mcpServers: [],
      enableGUI: options.gui || false,
      modelRegistry
    };

    // Create and initialize agent
    const agent = createAgent(config);
    await agent.initialize();

    spinner.succeed(chalk.green('Agent initialized!'));

    // Execute task
    console.log(chalk.cyan('\n💭 Thinking...\n'));
    const result = await agent.executeTask(task);

    // Display results
    console.log(chalk.green('\n✅ Task completed!\n'));
    console.log(chalk.white('Steps:'));
    
    for (const step of result.steps) {
      const icon = getStepIcon(step.type);
      console.log(`  ${icon} ${chalk.gray(step.type)}: ${step.content}`);
    }

    console.log(chalk.cyan('\n📊 Stats:'));
    console.log(`  Model: ${chalk.white(result.modelName)}`);
    console.log(`  Mode: ${result.mode}`);
    console.log(`  Web searches used: ${result.webSearchesUsed}/${taskModeConfig.maxWebSearches}`);
    console.log(`  Steps taken: ${result.steps.length}`);
    console.log(`  Status: ${result.status}`);

    if (result.result) {
      console.log(chalk.green('\n📝 Result:'));
      console.log(chalk.white(result.result));
    }

    // Show switch history if any
    const switchHistory = agent.getSwitchHistory();
    if (switchHistory.length > 0) {
      console.log(chalk.cyan('\n🔄 Model Switches:'));
      for (const event of switchHistory) {
        console.log(chalk.gray(`  ${event.fromModelName} → ${event.toModelName}`));
      }
    }

    // Cleanup
    await agent.cleanup();

  } catch (error) {
    spinner.fail(chalk.red('Task failed'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

function getStepIcon(type: string): string {
  switch (type) {
    case 'think': return '💭';
    case 'search': return '🔍';
    case 'tool': return '🔧';
    case 'code': return '💻';
    case 'output': return '📤';
    case 'model_switch': return '🔄';
    default: return '•';
  }
}

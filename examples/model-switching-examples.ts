/**
 * OxygenClaw Multi-Model Switching Examples
 * 
 * This file demonstrates various ways to switch between models
 * using standard names, aliases, and groups.
 */

import { 
  createModelRegistry, 
  normalizeModelName, 
  suggestModelNames,
  STANDARD_MODEL_NAMES 
} from '@oxygen-claw/core';

// ============================================
// Example 1: Basic Model Registration
// ============================================
function example1_basicRegistration() {
  const registry = createModelRegistry();

  // Register a model with standard name and aliases
  registry.registerModel({
    id: 'gpt-4o',
    name: 'gpt-4o',              // Standard name
    displayName: 'GPT-4o',
    provider: 'OpenAI',
    apiKey: 'sk-...',
    baseUrl: 'https://api.openai.com/v1',
    maxTokens: 128000,
    supportsVision: true,
    supportsTools: true,
    costPer1KInput: 0.005,
    costPer1KOutput: 0.015,
    icon: '🟢',
    keywords: ['gpt', 'openai', '4o'],
    aliases: ['gpt4o', 'gpt-4', 'gpt4']  // Alternative names
  });

  // Switch using standard name
  registry.switchModel({ modelName: 'gpt-4o' });

  // Switch using alias
  registry.switchModel({ modelName: 'gpt4o' });
  registry.switchModel({ modelName: 'gpt-4' });
}

// ============================================
// Example 2: Import Multiple Models from JSON
// ============================================
function example2_importFromJSON() {
  const registry = createModelRegistry();

  const modelsJSON = `[
    {
      "id": "gpt-4o",
      "name": "gpt-4o",
      "displayName": "GPT-4o",
      "provider": "OpenAI",
      "apiKey": "sk-...",
      "baseUrl": "https://api.openai.com/v1",
      "maxTokens": 128000,
      "supportsVision": true,
      "supportsTools": true,
      "costPer1KInput": 0.005,
      "costPer1KOutput": 0.015,
      "icon": "🟢",
      "keywords": ["gpt", "openai", "4o"],
      "aliases": ["gpt4o", "gpt-4"]
    },
    {
      "id": "claude-3.5-sonnet",
      "name": "claude-3.5-sonnet",
      "displayName": "Claude 3.5 Sonnet",
      "provider": "Anthropic",
      "apiKey": "sk-ant-...",
      "baseUrl": "https://api.anthropic.com/v1",
      "maxTokens": 200000,
      "supportsVision": true,
      "supportsTools": true,
      "costPer1KInput": 0.003,
      "costPer1KOutput": 0.015,
      "icon": "🟠",
      "keywords": ["claude", "anthropic"],
      "aliases": ["claude-3-5-sonnet", "claude-sonnet"]
    },
    {
      "id": "step-3.5-flash",
      "name": "step-3.5-flash",
      "displayName": "Step 3.5 Flash",
      "provider": "StepFun",
      "apiKey": "...",
      "baseUrl": "https://api.stepfun.com/v1",
      "maxTokens": 128000,
      "supportsVision": true,
      "supportsTools": true,
      "costPer1KInput": 0.0001,
      "costPer1KOutput": 0.0004,
      "icon": "⚪",
      "keywords": ["step", "stepfun", "阶跃"],
      "aliases": ["step-3.5", "stepfun-3.5"]
    }
  ]`;

  const result = registry.registerModelsFromJSON(modelsJSON);
  console.log(`Imported ${result.imported} models`);
  console.log(`Errors: ${result.errors.length}`);
}

// ============================================
// Example 3: Fuzzy Model Search
// ============================================
function example3_fuzzySearch() {
  const registry = createModelRegistry();

  // Get suggestions for partial input
  const suggestions = suggestModelNames('gpt');
  console.log('Suggestions for "gpt":', suggestions);
  // ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo']

  const claudeSuggestions = suggestModelNames('claude');
  console.log('Suggestions for "claude":', claudeSuggestions);
  // ['claude-3.5-sonnet', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']

  const stepSuggestions = suggestModelNames('step');
  console.log('Suggestions for "step":', stepSuggestions);
  // ['step-3.5-flash', 'step-2-16k']

  // Normalize model name
  console.log(normalizeModelName('gpt4o'));      // 'gpt-4o'
  console.log(normalizeModelName('gpt-4'));      // 'gpt-4'
  console.log(normalizeModelName('claude-sonnet')); // 'claude-3.5-sonnet'
}

// ============================================
// Example 4: Model Switching with Events
// ============================================
function example4_switchingWithEvents() {
  const registry = createModelRegistry();

  // Switch from default to GPT-4o
  const result1 = registry.switchModel({ modelName: 'gpt-4o' });
  console.log(`Switched to: ${result1?.displayName}`);

  // Switch to Claude
  const result2 = registry.switchModel({ modelName: 'claude-3.5-sonnet' });
  console.log(`Switched to: ${result2?.displayName}`);

  // Get switch history
  const history = registry.getSwitchHistory();
  console.log('Switch history:', history);
  /*
  [
    {
      fromModelId: 'default',
      fromModelName: 'default',
      toModelId: 'gpt-4o',
      toModelName: 'gpt-4o',
      reason: 'Switched to gpt-4o',
      timestamp: 2024-01-15T10:00:00.000Z
    },
    {
      fromModelId: 'gpt-4o',
      fromModelName: 'gpt-4o',
      toModelId: 'claude-3.5-sonnet',
      toModelName: 'claude-3.5-sonnet',
      reason: 'Switched to claude-3.5-sonnet',
      timestamp: 2024-01-15T10:05:00.000Z
    }
  ]
  */
}

// ============================================
// Example 5: Model Groups
// ============================================
function example5_modelGroups() {
  const registry = createModelRegistry();

  // Pre-defined groups
  const groups = {
    reasoning: ['gpt-4o', 'claude-3.5-sonnet', 'deepseek-r1', 'gemini-2.5-pro'],
    coding: ['claude-3.5-sonnet', 'deepseek-v3', 'codestral'],
    fast: ['gpt-4o-mini', 'claude-3-haiku', 'gemini-1.5-flash', 'step-3.5-flash'],
    vision: ['gpt-4o', 'claude-3.5-sonnet', 'gemini-2.5-pro', 'llama-3.1-405b'],
    chinese: ['qwen-2.5-72b', 'deepseek-v3', 'step-3.5-flash', 'yi-1.5-34b']
  };

  // Switch to best reasoning model
  registry.switchModel({ modelName: groups.reasoning[0] });

  // Switch to fast model for simple tasks
  registry.switchModel({ modelName: groups.fast[3] });  // step-3.5-flash
}

// ============================================
// Example 6: Dynamic Model Selection
// ============================================
function example6_dynamicSelection() {
  const registry = createModelRegistry();

  // Select model based on task requirements
  function selectModelForTask(task: {
    requiresVision: boolean;
    requiresTools: boolean;
    complexity: 'simple' | 'medium' | 'complex';
    budget?: number;
  }) {
    const models = registry.listModels();
    
    // Filter by capabilities
    let candidates = models.filter(m => {
      if (task.requiresVision && !m.supportsVision) return false;
      if (task.requiresTools && !m.supportsTools) return false;
      return true;
    });

    // Filter by budget
    if (task.budget) {
      candidates = candidates.filter(m => {
        const estimatedCost = (task.budget / 1000) * m.costPer1KInput;
        return estimatedCost <= 0.01;  // Max $0.01 per 1K tokens
      });
    }

    // Select by complexity
    if (task.complexity === 'simple') {
      // Prefer cheaper models
      candidates.sort((a, b) => a.costPer1KInput - b.costPer1KInput);
    } else if (task.complexity === 'complex') {
      // Prefer models with larger context
      candidates.sort((a, b) => b.maxTokens - a.maxTokens);
    }

    return candidates[0];
  }

  // Example usage
  const simpleModel = selectModelForTask({
    requiresVision: false,
    requiresTools: true,
    complexity: 'simple'
  });
  // Result: step-3.5-flash (cheapest)

  const visionModel = selectModelForTask({
    requiresVision: true,
    requiresTools: true,
    complexity: 'complex',
    budget: 10000
  });
  // Result: gpt-4o (vision + large context)
}

// ============================================
// Example 7: Export/Import Configuration
// ============================================
function example7_exportImport() {
  const registry = createModelRegistry();

  // Export current configuration
  const config = registry.exportConfig();
  console.log('Exported config:', config);

  // Save to file
  require('fs').writeFileSync('model-config.json', config);

  // Import configuration
  const importedConfig = require('fs').readFileSync('model-config.json', 'utf-8');
  const result = registry.importConfig(importedConfig);
  console.log(`Imported ${result.imported} models`);
}

// ============================================
// Example 8: CLI Integration
// ============================================
function example8_cliIntegration() {
  // This is how the CLI uses the model registry
  
  // 1. Parse command line arguments
  const args = process.argv.slice(2);
  const modelName = args[args.indexOf('--switch-model') + 1];

  // 2. Create registry
  const registry = createModelRegistry();

  // 3. Switch model
  if (modelName) {
    const result = registry.switchModel({ modelName });
    if (result) {
      console.log(`Switched to: ${result.displayName}`);
    } else {
      const suggestions = suggestModelNames(modelName);
      console.log(`Model not found. Did you mean: ${suggestions.join(', ')}?`);
    }
  }

  // 4. Run task with selected model
  const activeModel = registry.getActiveModel();
  console.log(`Running task with: ${activeModel?.displayName}`);
}

// ============================================
// Example 9: WebUI Integration
// ============================================
function example9_webuiIntegration() {
  // This is how the WebUI uses the model registry
  
  // 1. User types in search box
  const searchQuery = 'gpt';

  // 2. Get suggestions
  const suggestions = suggestModelNames(searchQuery, 5);
  
  // 3. Show in dropdown
  console.log('Dropdown suggestions:', suggestions);

  // 4. User selects a model
  const selectedModelName = suggestions[0];  // 'gpt-4o'

  // 5. Switch model
  const registry = createModelRegistry();
  const result = registry.switchModel({ modelName: selectedModelName });

  // 6. Update UI
  if (result) {
    console.log(`UI updated: Active model is now ${result.displayName}`);
  }
}

// ============================================
// Example 10: Custom Model Definition
// ============================================
function example10_customModel() {
  const registry = createModelRegistry();

  // Define a custom model with multiple aliases
  const customModel = {
    id: 'my-custom-model',
    name: 'gpt-4o',                    // Standard name for switching
    displayName: 'My Custom GPT-4o',   // Display name in UI
    provider: 'OpenAI',
    apiKey: 'sk-my-custom-key',
    baseUrl: 'https://my-proxy.com/v1',
    maxTokens: 128000,
    supportsVision: true,
    supportsTools: true,
    costPer1KInput: 0.005,
    costPer1KOutput: 0.015,
    icon: '🟢',
    keywords: ['gpt', 'openai', 'custom', 'proxy'],
    aliases: [
      'gpt-4o',           // Standard name
      'gpt4o',            // Alias without dash
      'gpt-4',            // Alias without 'o'
      'gpt4',             // Short alias
      'custom-gpt',       // Custom alias
      'my-gpt'            // Another custom alias
    ]
  };

  registry.registerModel(customModel);

  // All of these switch to the same model:
  registry.switchModel({ modelName: 'gpt-4o' });
  registry.switchModel({ modelName: 'gpt4o' });
  registry.switchModel({ modelName: 'gpt-4' });
  registry.switchModel({ modelName: 'custom-gpt' });
  registry.switchModel({ modelName: 'my-gpt' });
}

// Run examples
export {
  example1_basicRegistration,
  example2_importFromJSON,
  example3_fuzzySearch,
  example4_switchingWithEvents,
  example5_modelGroups,
  example6_dynamicSelection,
  example7_exportImport,
  example8_cliIntegration,
  example9_webuiIntegration,
  example10_customModel
};

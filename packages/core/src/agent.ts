/**
 * Agent Orchestrator
 * Main agent runtime integrating all OxygenClaw components
 * Enhanced with multi-model switching support and MoA (Mixture of Agents)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CapabilityMode,
  InteractionMode,
  MODE_CONFIGS,
  AgentTask,
  AgentStep,
  AgentMemory,
  ModelConfig,
  MCPServerConfig,
  DataSensitivity,
  EdgeCloudPolicy,
  ModelSwitchOptions,
  ModelSwitchEvent
} from './types';
import type { GUIAction, GUIContext } from './computeruse/types';
import { ODCEngine, createODCEngine, TaskStep as ODCTaskStep } from './cognition/odc';
import { OMMManager, createMemoryManager } from './memory/omm';
import { MCPClientManager, MCPToolWrapper, OxygenMCPClient } from './mcp/client';
import { ContainerManager } from './containers/manager';
import { ModelRegistry, createModelRegistry, normalizeModelName, suggestModelNames } from './models/registry';
import { callLLM } from './llm/provider';
import { webSearch } from './utils/web-search';

// ============================================
// Agent Configuration
// ============================================
export interface AgentConfig {
  mode: CapabilityMode;
  interactionMode: InteractionMode;
  model: ModelConfig;
  mcpServers: MCPServerConfig[];
  edgeCloudPolicy?: EdgeCloudPolicy;
  enableContainers?: boolean;
  enableGUI?: boolean;
  modelRegistry?: ModelRegistry;
  maxAgents?: number;
  enableMoA?: boolean;
}

export interface MoASubAgent {
  id: string;
  role: string;
  model: ModelConfig;
  tasks: ODCTaskStep[];
  results?: unknown[];
  status: 'idle' | 'running' | 'completed' | 'failed';
}

export interface MoACoordination {
  strategy: 'sequential' | 'parallel' | 'hierarchical';
  agents: MoASubAgent[];
  coordinatorModel: ModelConfig;
}

// ============================================
// OxygenClaw Agent
// ============================================
export class OxygenAgent {
  private id: string;
  private config: AgentConfig;
  private memory: OMMManager;
  private cognition: ODCEngine;
  private mcpManager: MCPClientManager;
  private containerManager: ContainerManager;
  private modelRegistry: ModelRegistry;
  private currentTask?: AgentTask;
  private webSearchCount = 0;
  private switchEvents: ModelSwitchEvent[] = [];
  private mcpToolWrappers: Map<string, MCPToolWrapper> = new Map();
  private moaCoordinator?: MoACoordination;
  private cancelled = false;
  private abortController?: AbortController;

  constructor(config: AgentConfig) {
    this.id = uuidv4();
    this.config = config;
    this.memory = createMemoryManager();
    this.cognition = createODCEngine(config.mode, config.interactionMode || 'task');
    this.mcpManager = new MCPClientManager();
    this.containerManager = new ContainerManager();
    this.modelRegistry = config.modelRegistry || createModelRegistry();
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    for (const server of this.config.mcpServers) {
      await this.mcpManager.register(server);
      await this.mcpManager.connect(server.id);

      const client = this.mcpManager.getClient(server.id);
      if (client && client.isConnected()) {
        const wrapper = new MCPToolWrapper(client);
        await wrapper.refreshTools();
        this.mcpToolWrappers.set(server.id, wrapper);
      }
    }

    if (this.config.enableContainers) {
      await this.containerManager.createAgentContainer({
        image: 'oxygen-claw/agent:latest'
      });
    }

    if (!this.modelRegistry.getModel(this.config.model.id)) {
      this.modelRegistry.registerModel(this.config.model);
    }
    this.modelRegistry.switchModel({ modelName: this.config.model.name });

    const modeConfig = MODE_CONFIGS[this.config.mode];
    if (modeConfig.task.enableMoA) {
      await this.initializeMoACoordinator();
    }

    this.memory.store(
      `Agent ${this.id} initialized in ${this.config.mode} mode with model ${this.config.model.name}`,
      ['init', this.config.mode, 'model'],
      []
    );
  }

  /**
   * Initialize MoA coordinator for task mode
   */
  private async initializeMoACoordinator(): Promise<void> {
    const modeConfig = MODE_CONFIGS[this.config.mode];
    const taskConfig = modeConfig.task;
    const availableModels = this.modelRegistry.listModels();

    const reasoningModels = availableModels.filter(m => 
      m.supportsTools && m.maxTokens >= 32000
    );
    
    const fastModels = availableModels.filter(m => 
      m.maxTokens >= 8000 && m.costPer1KInput < 0.001
    );

    const coordinatorModel = reasoningModels.length > 0 
      ? reasoningModels[0] 
      : this.config.model;

    this.moaCoordinator = {
      strategy: taskConfig.maxAgents > 2 ? 'parallel' : 'sequential',
      agents: [],
      coordinatorModel
    };
  }

  /**
   * Switch model by standard name or alias
   */
  async switchModel(modelName: string): Promise<{
    success: boolean;
    model?: ModelConfig;
    error?: string;
    previousModel?: ModelConfig;
  }> {
    const previousModel = this.modelRegistry.getActiveModel();
    const normalizedName = normalizeModelName(modelName);

    const options: ModelSwitchOptions = {
      modelName: normalizedName,
      preserveContext: true,
      migrateMemory: true
    };

    const result = this.modelRegistry.switchModel(options);

    if (result) {
      this.switchEvents.push({
        fromModelId: previousModel?.id || '',
        fromModelName: previousModel?.name || 'none',
        toModelId: result.id,
        toModelName: result.name,
        reason: `Switched to ${normalizedName}`,
        timestamp: new Date(),
        taskId: this.currentTask?.id
      });

      this.config.model = result;

      if (this.currentTask) {
        this.addStep(this.currentTask, 'model_switch', 
          `Switched from ${previousModel?.displayName || 'none'} to ${result.displayName}`);
      }

      this.memory.store(
        `Model switched to ${result.displayName} (${result.name})`,
        ['model', 'switch', result.provider.toLowerCase()],
        []
      );

      const modeConfig2 = MODE_CONFIGS[this.config.mode];
      if (modeConfig2.task.enableMoA) {
        await this.updateMoACoordinatorModel(result);
      }

      return {
        success: true,
        model: result,
        previousModel: previousModel || undefined
      };
    }

    const suggestions = suggestModelNames(modelName);

    return {
      success: false,
      error: `Model "${modelName}" not found. Did you mean: ${suggestions.join(', ')}?`
    };
  }

  /**
   * Update MoA coordinator model
   */
  private async updateMoACoordinatorModel(model: ModelConfig): Promise<void> {
    if (this.moaCoordinator) {
      this.moaCoordinator.coordinatorModel = model;
    }
  }

  /**
   * Get current active model
   */
  getCurrentModel(): ModelConfig | null {
    return this.modelRegistry.getActiveModel();
  }

  /**
   * List all available models
   */
  listAvailableModels(): ModelConfig[] {
    return this.modelRegistry.listModels();
  }

  /**
   * Get model by name or ID
   */
  getModel(nameOrId: string): ModelConfig | undefined {
    return this.modelRegistry.getModel(nameOrId);
  }

  /**
   * Get model switch history
   */
  getSwitchHistory(): ModelSwitchEvent[] {
    return [...this.switchEvents];
  }

  /**
   * Get model registry
   */
  getModelRegistry(): ModelRegistry {
    return this.modelRegistry;
  }

  /**
   * Execute a task with current model
   */
  async executeTask(prompt: string): Promise<AgentTask> {
    const modeConfig = MODE_CONFIGS[this.config.mode];
    const activeConfig = this.config.interactionMode === 'chat' ? modeConfig.chat : modeConfig.task;
    const currentModel = this.getCurrentModel();

    const task: AgentTask = {
      id: uuidv4(),
      prompt,
      mode: this.config.mode,
      interactionMode: this.config.interactionMode,
      modelId: currentModel?.id || this.config.model.id,
      modelName: currentModel?.displayName || this.config.model.displayName,
      status: 'running',
      createdAt: new Date(),
      steps: [],
      webSearchesUsed: 0
    };

    this.currentTask = task;
    this.webSearchCount = 0;
    this.cancelled = false;
    this.abortController = new AbortController();

    try {
      // Store task in memory with model info
      this.memory.store(
        `Task [${task.mode}]: ${prompt} (Model: ${task.modelName})`,
        ['task', this.config.mode, 'model', task.modelId],
        [task.id]
      );

      // Execute cognition loop
      await this.runCognitionLoop(task);

      task.status = 'completed';
      task.completedAt = new Date();
    } catch (error) {
      task.status = 'failed';
      task.error = String(error);
      task.completedAt = new Date();
    }

    return task;
  }

  /**
   * Run cognition loop
   */
  private async runCognitionLoop(task: AgentTask): Promise<void> {
    const modeConfig = MODE_CONFIGS[task.mode];
    const activeConfig = task.interactionMode === 'chat' ? modeConfig.chat : modeConfig.task;
    let context: any = { 
      task: task.prompt, 
      mode: task.mode,
      interactionMode: task.interactionMode,
      model: task.modelName
    };

    while (task.status === 'running' && !this.cancelled) {
      // Check web search limit (-1 means unlimited)
      if (activeConfig.maxWebSearches !== -1 && this.webSearchCount >= activeConfig.maxWebSearches) {
        await this.addStep(task, 'output', 'Web search limit reached, proceeding with available information');
        break;
      }

      // Run ODC cognition
      const result = await this.cognition.think(
        task.prompt,
        context,
        this.getAvailableTools()
      );

      await this.addStep(task, 'think', `[${result.level}] ${result.reasoning}`);

      // Execute based on next action
      switch (result.nextAction) {
        case 'search':
          if (activeConfig.maxWebSearches === -1 || this.webSearchCount < activeConfig.maxWebSearches) {
            await this.performWebSearch(task);
            this.webSearchCount++;
          }
          break;

        case 'tool':
          await this.executeTools(task);
          break;

        case 'delegate':
          await this.delegateToAgents(task, result.agentsToSpawn || 1);
          break;

        case 'output':
          await this.generateOutput(task);
          break;

        default:
          await this.generateOutput(task);
      }

      // Update context
      (context as any).reasoning = this.cognition.getReasoningHistory().join('\n');
    }

    if (this.cancelled) {
      task.status = 'failed';
      task.error = 'Task cancelled by user';
      await this.addStep(task, 'output', 'Task cancelled by user');
    }
  }

  /**
   * Perform web search
   */
  private async performWebSearch(task: AgentTask): Promise<void> {
    await this.addStep(task, 'search', `Searching: "${task.prompt}"`);
    try {
      const results = await webSearch(task.prompt);
      if (results.length === 0) {
        await this.addStep(task, 'search', 'No results found.');
        return;
      }
      const summary = results.slice(0, 5).map((r, i) => `${i + 1}. [${r.title}](${r.url})\n   ${r.snippet}`).join('\n\n');
      await this.addStep(task, 'search', summary);
      task.searchResults = (task.searchResults || []).concat(results);
    } catch (err: any) {
      await this.addStep(task, 'search', `Search failed: ${err.message || String(err)}`);
    }
  }

  /**
   * Execute available tools via MCP
   */
  private async executeTools(task: AgentTask): Promise<void> {
    const tools = await this.getMCPTools();
    if (tools.length === 0) {
      await this.addStep(task, 'tool', 'No MCP tools available');
      return;
    }

    for (const tool of tools.slice(0, 3)) {
      await this.addStep(task, 'tool', `Executing tool: ${tool.name}`);
      
      const result = await this.mcpManager.callToolAnywhere(tool.name, {});
      if (result.success) {
        await this.addStep(task, 'tool', `Tool ${tool.name} succeeded: ${JSON.stringify(result.result).slice(0, 200)}`);
      } else {
        await this.addStep(task, 'tool', `Tool ${tool.name} failed: ${result.error}`);
      }
    }
  }

  /**
   * Delegate to sub-agents (MoA)
   */
  private async delegateToAgents(task: AgentTask, count: number): Promise<void> {
    if (!this.moaCoordinator) {
      await this.addStep(task, 'think', 'MoA coordinator not initialized');
      return;
    }

    await this.addStep(task, 'think', `Delegating to ${count} sub-agents (MoA mode)`);

    const availableModels = this.modelRegistry.listModels();
    const reasoningModels = availableModels.filter(m => 
      m.supportsTools && m.maxTokens >= 32000
    );
    
    const agents: MoASubAgent[] = [];
    const roles = ['Researcher', 'Analyst', 'Executor', 'Validator'];
    
    for (let i = 0; i < Math.min(count, roles.length); i++) {
      const model = reasoningModels[i % reasoningModels.length] || this.config.model;
      agents.push({
        id: uuidv4(),
        role: roles[i],
        model,
        tasks: [],
        status: 'idle'
      });
    }

    this.moaCoordinator.agents = agents;

    if (this.moaCoordinator.strategy === 'parallel') {
      await this.executeMoAParallel(task, agents);
    } else {
      await this.executeMoASequential(task, agents);
    }

    const results = agents.filter(a => a.status === 'completed' && a.results);
    const mergedResult = this.mergeMoAResults(results);
    
    await this.addStep(task, 'output', `MoA completed with ${results.length}/${agents.length} agents succeeded`);
    task.result = mergedResult;
  }

  /**
   * Execute MoA agents in parallel
   */
  private async executeMoAParallel(task: AgentTask, agents: MoASubAgent[]): Promise<void> {
    await this.addStep(task, 'think', 'Executing MoA agents in parallel');
    
    const promises = agents.map(async (agent) => {
      agent.status = 'running';
      await this.addStep(task, 'think', `Agent ${agent.role} starting...`);
      
      try {
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        agent.results = [`${agent.role} completed task analysis`];
        agent.status = 'completed';
        await this.addStep(task, 'think', `Agent ${agent.role} completed`);
      } catch {
        agent.status = 'failed';
        await this.addStep(task, 'think', `Agent ${agent.role} failed`);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Execute MoA agents sequentially
   */
  private async executeMoASequential(task: AgentTask, agents: MoASubAgent[]): Promise<void> {
    await this.addStep(task, 'think', 'Executing MoA agents sequentially');
    
    for (const agent of agents) {
      agent.status = 'running';
      await this.addStep(task, 'think', `Agent ${agent.role} starting...`);
      
      try {
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
        agent.results = [`${agent.role} completed task analysis`];
        agent.status = 'completed';
        await this.addStep(task, 'think', `Agent ${agent.role} completed`);
      } catch {
        agent.status = 'failed';
        await this.addStep(task, 'think', `Agent ${agent.role} failed`);
        break;
      }
    }
  }

  /**
   * Merge MoA results
   */
  private mergeMoAResults(agents: MoASubAgent[]): string {
    if (agents.length === 0) return 'No results to merge';
    
    const results = agents.flatMap(a => a.results || []);
    return `MoA Results:\n- ${results.join('\n- ')}`;
  }

  /**
   * Generate final output
   */
  private async generateOutput(task: AgentTask): Promise<void> {
    const currentModel = this.getCurrentModel();
    if (!currentModel) {
      throw new Error('No active model available');
    }

    const systemPrompt = this.buildSystemPrompt(task);
    const messages = this.buildMessages(task, systemPrompt);

    const modeConfig = MODE_CONFIGS[task.mode];
    const activeConfig = task.interactionMode === 'chat' ? modeConfig.chat : modeConfig.task;

    try {
      const response = await callLLM(currentModel, messages, {
        temperature: activeConfig.temperature,
        maxTokens: currentModel.maxTokens,
        signal: this.abortController?.signal,
      });

      task.result = response.content;
      await this.addStep(task, 'output', response.content);
      task.status = 'completed';

      this.memory.store(
        `Task output generated (${response.usage.totalTokens} tokens)`,
        ['output', task.mode, task.modelId],
        [task.id]
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      task.status = 'failed';
      task.error = `LLM generation failed: ${errorMessage}`;
      await this.addStep(task, 'output', `Error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Build system prompt based on task mode
   */
  private buildSystemPrompt(task: AgentTask): string {
    const modeConfig = MODE_CONFIGS[task.mode];
    const modeLabel = modeConfig.label;
    
    let prompt = `You are OxygenClaw AI assistant running in ${modeLabel} mode.\n`;
    prompt += `You are helpful, concise, and accurate.\n`;
    
    if (modeConfig.chat.deliverMarkdown || task.mode === 'research' || task.mode === 'moa') {
      prompt += `Format your response using Markdown for better readability.\n`;
    }
    
    if (modeConfig.chat.enableCoT) {
      prompt += `Think step by step before providing your final answer.\n`;
    }
    
    return prompt;
  }

  /**
   * Build messages array for LLM call
   */
  private buildMessages(task: AgentTask, systemPrompt: string): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    const thinkSteps = task.steps.filter(s => s.type === 'think');
    const searchSteps = task.steps.filter(s => s.type === 'search');
    const toolSteps = task.steps.filter(s => s.type === 'tool');

    let contextContent = '';
    
    if (thinkSteps.length > 0) {
      contextContent += '## Previous Reasoning\n';
      thinkSteps.forEach((step, i) => {
        contextContent += `${i + 1}. ${step.content}\n`;
      });
      contextContent += '\n';
    }
    
    if (searchSteps.length > 0) {
      contextContent += '## Search Results\n';
      searchSteps.forEach((step, i) => {
        contextContent += `${i + 1}. ${step.content}\n`;
      });
      contextContent += '\n';
    }
    
    if (toolSteps.length > 0) {
      contextContent += '## Tool Results\n';
      toolSteps.forEach((step, i) => {
        contextContent += `${i + 1}. ${step.content}\n`;
      });
      contextContent += '\n';
    }

    if (contextContent) {
      messages.push({
        role: 'system',
        content: `Context from previous steps:\n${contextContent}`
      });
    }

    messages.push({ role: 'user', content: task.prompt });

    return messages;
  }

  /**
   * Add step to task
   */
  private async addStep(task: AgentTask, type: AgentStep['type'], content: string): Promise<void> {
    task.steps.push({
      id: uuidv4(),
      type,
      content,
      timestamp: new Date()
    });
  }

  /**
   * Get available tools
   */
  private getAvailableTools(): string[] {
    const tools: string[] = [];
    for (const serverId of this.mcpManager.listServers()) {
      const client = this.mcpManager.getClient(serverId);
      if (client) {
        // Tools would be retrieved here
      }
    }
    return tools;
  }

  /**
   * Get MCP tools
   */
  private async getMCPTools() {
    const tools: any[] = [];
    for (const serverId of this.mcpManager.listServers()) {
      const client = this.mcpManager.getClient(serverId);
      if (client && client.isConnected()) {
        const serverTools = await client.listTools();
        tools.push(...serverTools);
      }
    }
    return tools;
  }

  /**
   * Execute GUI action
   */
  async executeGUI(action: GUIAction): Promise<boolean> {
    if (!this.config.enableGUI) return false;
    // Get container ID and execute
    const containers = this.containerManager.listContainers();
    if (containers.length === 0) return false;
    return this.containerManager.executeGUIAction(containers[0], action);
  }

  /**
   * Get GUI context
   */
  async getGUIContext(): Promise<GUIContext | null> {
    if (!this.config.enableGUI) return null;
    const containers = this.containerManager.listContainers();
    if (containers.length === 0) return null;
    return this.containerManager.getGUIContext(containers[0]);
  }

  /**
   * Get memory
   */
  getMemory(): AgentMemory {
    return {
      shortTerm: this.memory['shortTerm'],
      longTerm: this.memory['longTerm'],
      workingMemory: new Map()
    };
  }

  /**
   * Search memory
   */
  searchMemory(query: string, tags?: string[]): any[] {
    return this.memory.recall(query, tags);
  }

  /**
   * Store in memory
   */
  storeMemory(content: string, tags: string[] = []): void {
    this.memory.store(content, tags);
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get current task
   */
  getCurrentTask(): AgentTask | undefined {
    return this.currentTask;
  }

  /**
   * Cancel current task
   */
  cancel(): void {
    this.cancelled = true;
    this.abortController?.abort();
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    for (const serverId of this.mcpManager.listServers()) {
      await this.mcpManager.disconnect(serverId);
    }
    await this.containerManager.cleanup();
    this.memory.destroy();
  }
}

// ============================================
// Agent Factory
// ============================================
export function createAgent(config: AgentConfig): OxygenAgent {
  return new OxygenAgent(config);
}

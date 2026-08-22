/**
 * Agent Orchestrator
 * Main agent runtime integrating all OxygenClaw components
 * Enhanced with multi-model switching support and MoA (Mixture of Agents)
 */
import { CapabilityMode, InteractionMode, AgentTask, AgentMemory, ModelConfig, MCPServerConfig, EdgeCloudPolicy, ModelSwitchEvent } from './types';
import type { GUIAction, GUIContext } from './computeruse/types';
import { TaskStep as ODCTaskStep } from './cognition/odc';
import { ModelRegistry } from './models/registry';
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
export declare class OxygenAgent {
    private id;
    private config;
    private memory;
    private cognition;
    private mcpManager;
    private containerManager;
    private modelRegistry;
    private currentTask?;
    private webSearchCount;
    private switchEvents;
    private mcpToolWrappers;
    private moaCoordinator?;
    private cancelled;
    constructor(config: AgentConfig);
    /**
     * Initialize the agent
     */
    initialize(): Promise<void>;
    /**
     * Initialize MoA coordinator for task mode
     */
    private initializeMoACoordinator;
    /**
     * Switch model by standard name or alias
     */
    switchModel(modelName: string): Promise<{
        success: boolean;
        model?: ModelConfig;
        error?: string;
        previousModel?: ModelConfig;
    }>;
    /**
     * Update MoA coordinator model
     */
    private updateMoACoordinatorModel;
    /**
     * Get current active model
     */
    getCurrentModel(): ModelConfig | null;
    /**
     * List all available models
     */
    listAvailableModels(): ModelConfig[];
    /**
     * Get model by name or ID
     */
    getModel(nameOrId: string): ModelConfig | undefined;
    /**
     * Get model switch history
     */
    getSwitchHistory(): ModelSwitchEvent[];
    /**
     * Get model registry
     */
    getModelRegistry(): ModelRegistry;
    /**
     * Execute a task with current model
     */
    executeTask(prompt: string): Promise<AgentTask>;
    /**
     * Run cognition loop
     */
    private runCognitionLoop;
    /**
     * Perform web search
     */
    private performWebSearch;
    /**
     * Execute available tools via MCP
     */
    private executeTools;
    /**
     * Delegate to sub-agents (MoA)
     */
    private delegateToAgents;
    /**
     * Execute MoA agents in parallel
     */
    private executeMoAParallel;
    /**
     * Execute MoA agents sequentially
     */
    private executeMoASequential;
    /**
     * Merge MoA results
     */
    private mergeMoAResults;
    /**
     * Generate final output
     */
    private generateOutput;
    /**
     * Build system prompt based on task mode
     */
    private buildSystemPrompt;
    /**
     * Build messages array for LLM call
     */
    private buildMessages;
    /**
     * Add step to task
     */
    private addStep;
    /**
     * Get available tools
     */
    private getAvailableTools;
    /**
     * Get MCP tools
     */
    private getMCPTools;
    /**
     * Execute GUI action
     */
    executeGUI(action: GUIAction): Promise<boolean>;
    /**
     * Get GUI context
     */
    getGUIContext(): Promise<GUIContext | null>;
    /**
     * Get memory
     */
    getMemory(): AgentMemory;
    /**
     * Search memory
     */
    searchMemory(query: string, tags?: string[]): any[];
    /**
     * Store in memory
     */
    storeMemory(content: string, tags?: string[]): void;
    /**
     * Get agent ID
     */
    getId(): string;
    /**
     * Get current task
     */
    getCurrentTask(): AgentTask | undefined;
    /**
     * Cancel current task
     */
    cancel(): void;
    /**
     * Cleanup
     */
    cleanup(): Promise<void>;
}
export declare function createAgent(config: AgentConfig): OxygenAgent;
//# sourceMappingURL=agent.d.ts.map
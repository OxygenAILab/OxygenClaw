/**
 * OxygenClaw Core Types
 * Integrated from: TinyClaw, EdgeClaw, NanoClaw, StepClaw, OpenHands, UI-TARS
 * Enhanced with multi-model switching capability
 */
export type InteractionMode = 'chat' | 'task';
export type CapabilityMode = 'fast' | 'think' | 'expert' | 'research' | 'moa';
export interface ModeConfig {
    mode: CapabilityMode;
    label: string;
    description: string;
    icon: string;
    color: string;
    chat: {
        maxWebSearches: number;
        thinkingDepth: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
        enableCoT: boolean;
        enableCrossValidation: boolean;
        temperature: number;
        contextBudget: number;
        deliverMarkdown: boolean;
    };
    task: {
        maxWebSearches: number;
        thinkingDepth: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
        enableDynamicCognition: boolean;
        enableMoA: boolean;
        maxAgents: number;
        autoSelectModel: boolean;
        temperature: number;
        contextBudget: number;
        frameworkPatterns?: AgentFrameworkPattern[];
        defaultPattern?: AgentFrameworkPattern;
        votingStrategy?: 'majority' | 'weighted' | 'best-of-n' | 'consensus';
    };
}
export declare const MODE_CONFIGS: Record<CapabilityMode, ModeConfig>;
export interface ModelConfig {
    id: string;
    name: string;
    displayName: string;
    provider: string;
    apiKey: string;
    baseUrl: string;
    maxTokens: number;
    supportsVision: boolean;
    supportsTools: boolean;
    costPer1KInput: number;
    costPer1KOutput: number;
    icon?: string;
    keywords: string[];
    aliases?: string[];
    version?: string;
    deprecated?: boolean;
}
export interface ModelProvider {
    id: string;
    name: string;
    baseUrl: string;
    apiKeyEnv?: string;
    models: ModelConfig[];
    priority: number;
}
export interface ModelRegistry {
    models: Map<string, ModelConfig>;
    nameIndex: Map<string, ModelConfig>;
    aliasIndex: Map<string, ModelConfig[]>;
    providers: Map<string, ModelProvider>;
    activeModelId: string | null;
    modelHistory: string[];
}
export interface ModelSwitchOptions {
    modelName: string;
    preserveContext?: boolean;
    migrateMemory?: boolean;
}
export interface ModelGroup {
    id: string;
    name: string;
    description?: string;
    modelIds: string[];
    defaultModelId?: string;
}
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
export interface MCPResource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}
export interface MCPServerConfig {
    id: string;
    name: string;
    transport: 'stdio' | 'streamable-http' | 'sse';
    command?: string;
    args?: string[];
    url?: string;
    headers?: Record<string, string>;
    env?: Record<string, string>;
}
export interface MCPClient {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    listTools(): Promise<MCPTool[]>;
    callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
    listResources(): Promise<MCPResource[]>;
    readResource(uri: string): Promise<string>;
}
export interface AgentContext {
    task: string;
    mode: CapabilityMode;
    interactionMode: InteractionMode;
    model: string;
    reasoning?: string;
}
export interface AgentTask {
    id: string;
    prompt: string;
    mode: CapabilityMode;
    interactionMode: InteractionMode;
    modelId: string;
    modelName: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    createdAt: Date;
    completedAt?: Date;
    result?: string;
    error?: string;
    steps: AgentStep[];
    webSearchesUsed: number;
    searchResults?: Array<{
        title: string;
        url: string;
        snippet: string;
    }>;
}
export interface AgentStep {
    id: string;
    type: 'think' | 'search' | 'tool' | 'code' | 'output' | 'model_switch';
    content: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}
export interface AgentMemory {
    shortTerm: MemoryPage[];
    longTerm: MemoryPage[];
    workingMemory: Map<string, unknown>;
    modelContext?: ModelContext;
}
export interface MemoryPage {
    id: string;
    content: string;
    embedding?: number[];
    createdAt: Date;
    lastAccessed: Date;
    accessCount: number;
    tags: string[];
    pointers: string[];
    sourceModel?: string;
}
export interface ModelContext {
    previousModelId: string;
    previousModelName: string;
    contextSummary: string;
    migratedAt: Date;
}
export interface ContainerConfig {
    id: string;
    image: string;
    workingDir?: string;
    envVars?: Record<string, string>;
    mounts?: MountConfig[];
    resourceLimits?: ResourceLimits;
    networkMode?: 'bridge' | 'host' | 'none';
}
export interface MountConfig {
    source: string;
    target: string;
    readOnly: boolean;
}
export interface ResourceLimits {
    cpu: string;
    memory: string;
    pids: number;
}
export type DataSensitivity = 'S1' | 'S2' | 'S3';
export interface EdgeCloudPolicy {
    localProcessing: DataSensitivity[];
    cloudProcessing: DataSensitivity[];
    fallbackBehavior: 'local' | 'cloud' | 'hybrid';
}
export interface GatewayConfig {
    port: number;
    apiKeys: string[];
    rateLimits: RateLimitConfig;
    billing: BillingConfig;
    defaultModelId?: string;
}
export interface RateLimitConfig {
    requestsPerMinute: number;
    tokensPerMinute: number;
    maxConcurrent: number;
}
export interface BillingConfig {
    enabled: boolean;
    currency: string;
    freeQuota: number;
}
export interface DashboardStats {
    totalTasks: number;
    activeAgents: number;
    apiCallsToday: number;
    tokensUsedToday: number;
    costToday: number;
}
export interface ModelSwitchEvent {
    fromModelId: string;
    fromModelName: string;
    toModelId: string;
    toModelName: string;
    reason: string;
    timestamp: Date;
    taskId?: string;
}
export type AgentFrameworkPattern = 'mixture-of-agents' | 'graph-of-agents' | 'swarm' | 'pipeline' | 'adversarial' | 'moe' | 'group-chat' | 'ultra-moe' | 'debate' | 'reflection' | 'plan-and-execute' | 'reAct';
export interface FrameworkPatternConfig {
    pattern: AgentFrameworkPattern;
    agentCount: number;
    maxRounds: number;
    votingStrategy: 'majority' | 'weighted' | 'best-of-n' | 'consensus';
    aggregationMethod: 'concatenate' | 'summarize' | 'select-best' | 'merge';
    enableReflection: boolean;
    enableCrossValidation: boolean;
    expertRouting?: {
        enabled: boolean;
        routingModel?: string;
        topKExperts: number;
    };
    graphTopology?: {
        nodes: string[];
        edges: Array<{
            from: string;
            to: string;
            weight?: number;
        }>;
    };
    pipelineStages?: string[];
}
export interface AgentMessage {
    id: string;
    fromAgent: string;
    toAgent: string | 'broadcast';
    content: string;
    type: 'task' | 'result' | 'feedback' | 'query' | 'vote' | 'handoff';
    timestamp: number;
    metadata?: Record<string, any>;
}
export interface AgentVote {
    agentId: string;
    candidate: string;
    score: number;
    reasoning?: string;
}
export interface AgentConsensus {
    agreement: boolean;
    finalAnswer: string;
    votes: AgentVote[];
    confidence: number;
}
export interface EnhancedAgentTask extends AgentTask {
    frameworkPattern?: AgentFrameworkPattern;
    patternConfig?: FrameworkPatternConfig;
    subtasks?: EnhancedAgentTask[];
    agentMessages?: AgentMessage[];
    consensus?: AgentConsensus;
    reflectionLog?: Array<{
        round: number;
        agentId: string;
        evaluation: string;
        improvement: string;
    }>;
}
export interface ModelRoutingConfig {
    enabled: boolean;
    strategy: 'capability-based' | 'load-balanced' | 'cost-optimized' | 'latency-optimized';
    fallbackModel?: string;
    routes: Array<{
        taskType: string;
        preferredModels: string[];
        priority: number;
    }>;
}
export interface DashboardDataSource {
    id: string;
    name: string;
    url: string;
    type: 'newapi' | 'one-api' | 'custom';
    syncInterval: number;
    lastSync?: number;
    status: 'connected' | 'disconnected' | 'error' | 'syncing';
    mappingMethod: 'direct' | 'llm-assisted';
    authToken?: string;
}
export interface DashboardMetrics {
    account: {
        balance: number;
        historicalUsage: Array<{
            date: number;
            cost: number;
        }>;
    };
    usage: {
        totalRequests: number;
        totalStatistics: number;
        requestsByDay: Array<{
            date: number;
            count: number;
        }>;
    };
    resources: {
        quotaTotal: number;
        quotaUsed: number;
        totalTokens: {
            input: number;
            output: number;
        };
        tokensByDay: Array<{
            date: number;
            input: number;
            output: number;
        }>;
    };
    performance: {
        avgRPM: number;
        avgTPM: number;
        peakTPS: number;
        peakConcurrency: number;
    };
    modelAnalysis: {
        consumptionByModel: Array<{
            model: string;
            cost: number;
        }>;
        callTrendByModel: Array<{
            model: string;
            data: Array<{
                date: number;
                calls: number;
            }>;
        }>;
        callDistribution: Array<{
            model: string;
            percentage: number;
        }>;
        callRanking: Array<{
            model: string;
            calls: number;
        }>;
    };
}
export interface ProviderBillingConfig {
    tokenName: string;
    connectInfo: {
        type: string;
        key: string;
        url: string;
    };
    models: string[];
    billingMultiplier: string;
}
//# sourceMappingURL=types.d.ts.map
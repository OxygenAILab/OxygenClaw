/**
 * OxygenClaw Core Types
 * Integrated from: TinyClaw, EdgeClaw, NanoClaw, StepClaw, OpenHands, UI-TARS
 * Enhanced with multi-model switching capability
 */

// ============================================
// Interaction Modes (Chat / Task)
// ============================================
export type InteractionMode = 'chat' | 'task';

// ============================================
// Agent Capability Modes (Fast / Think / Expert / Research / MoA)
// ============================================
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

export const MODE_CONFIGS: Record<CapabilityMode, ModeConfig> = {
  fast: {
    mode: 'fast',
    label: 'Fast',
    description: 'Almost no thinking, 1 web search. Quick response.',
    icon: 'Zap',
    color: 'success',
    chat: {
      maxWebSearches: 1,
      thinkingDepth: 'L1',
      enableCoT: false,
      enableCrossValidation: false,
      temperature: 0.3,
      contextBudget: 8000,
      deliverMarkdown: false
    },
    task: {
      maxWebSearches: 1,
      thinkingDepth: 'L1',
      enableDynamicCognition: false,
      enableMoA: false,
      maxAgents: 1,
      autoSelectModel: false,
      temperature: 0.3,
      contextBudget: 8000
    }
  },
  think: {
    mode: 'think',
    label: 'Think',
    description: 'Moderate thinking depth, multi-round web search.',
    icon: 'Brain',
    color: 'primary',
    chat: {
      maxWebSearches: 5,
      thinkingDepth: 'L2',
      enableCoT: false,
      enableCrossValidation: false,
      temperature: 0.6,
      contextBudget: 16000,
      deliverMarkdown: false
    },
    task: {
      maxWebSearches: 5,
      thinkingDepth: 'L3',
      enableDynamicCognition: true,
      enableMoA: false,
      maxAgents: 1,
      autoSelectModel: false,
      temperature: 0.5,
      contextBudget: 32000
    }
  },
  expert: {
    mode: 'expert',
    label: 'Expert',
    description: 'CoT thinking for chat, dynamic cognition for task. Multi-round web search.',
    icon: 'Award',
    color: 'tertiary',
    chat: {
      maxWebSearches: 10,
      thinkingDepth: 'L3',
      enableCoT: true,
      enableCrossValidation: false,
      temperature: 0.7,
      contextBudget: 32000,
      deliverMarkdown: false
    },
    task: {
      maxWebSearches: 10,
      thinkingDepth: 'L4',
      enableDynamicCognition: true,
      enableMoA: false,
      maxAgents: 1,
      autoSelectModel: false,
      temperature: 0.6,
      contextBudget: 64000
    }
  },
  research: {
    mode: 'research',
    label: 'Research',
    description: 'Max thinking depth, cross-validation, unlimited search. Delivers markdown document.',
    icon: 'BookOpen',
    color: 'secondary',
    chat: {
      maxWebSearches: -1,
      thinkingDepth: 'L5',
      enableCoT: true,
      enableCrossValidation: true,
      temperature: 0.8,
      contextBudget: 128000,
      deliverMarkdown: true
    },
    task: {
      maxWebSearches: -1,
      thinkingDepth: 'L5',
      enableDynamicCognition: true,
      enableMoA: false,
      maxAgents: 1,
      autoSelectModel: true,
      temperature: 0.7,
      contextBudget: 128000
    }
  },
  moa: {
    mode: 'moa',
    label: 'MoA',
    description: 'Ultra-MoE, GroupChat. Dynamic cognition召集 models, collaborative thinking. Voting and markdown delivery.',
    icon: 'Users',
    color: 'error',
    chat: {
      maxWebSearches: -1,
      thinkingDepth: 'L5',
      enableCoT: true,
      enableCrossValidation: true,
      temperature: 0.7,
      contextBudget: 128000,
      deliverMarkdown: true
    },
    task: {
      maxWebSearches: -1,
      thinkingDepth: 'L5',
      enableDynamicCognition: true,
      enableMoA: true,
      maxAgents: 7,
      autoSelectModel: true,
      temperature: 0.6,
      contextBudget: 256000,
      frameworkPatterns: ['mixture-of-agents', 'ultra-moe', 'group-chat', 'debate'] as AgentFrameworkPattern[],
      defaultPattern: 'mixture-of-agents' as AgentFrameworkPattern,
      votingStrategy: 'weighted'
    }
  }
};

// ============================================
// LLM Model Configuration
// ============================================
export interface ModelConfig {
  id: string;
  name: string;              // Standard model name for switching (e.g., "gpt-4o", "claude-3.5-sonnet")
  displayName: string;       // Human-readable name
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
  aliases?: string[];        // Alternative names for switching
  version?: string;
  deprecated?: boolean;
}

export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyEnv?: string;
  models: ModelConfig[];
  priority: number;          // Lower = higher priority for auto-selection
}

// ============================================
// Model Registry - Multi-model switching
// ============================================
export interface ModelRegistry {
  models: Map<string, ModelConfig>;           // id -> model
  nameIndex: Map<string, ModelConfig>;        // standard name -> model (for switching)
  aliasIndex: Map<string, ModelConfig[]>;     // alias -> [models]
  providers: Map<string, ModelProvider>;
  activeModelId: string | null;
  modelHistory: string[];                     // Recently used model IDs
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

// ============================================
// MCP Protocol Types
// ============================================
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

// ============================================
// Agent Runtime Types
// ============================================
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
  searchResults?: Array<{ title: string; url: string; snippet: string }>;
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
  modelContext?: ModelContext;  // Context from previous model
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
  sourceModel?: string;       // Which model created this memory
}

export interface ModelContext {
  previousModelId: string;
  previousModelName: string;
  contextSummary: string;
  migratedAt: Date;
}

// ============================================
// Container Types (NanoClaw-inspired)
// ============================================
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

// ============================================
// Edge-Cloud Collaboration (EdgeClaw-inspired)
// ============================================
export type DataSensitivity = 'S1' | 'S2' | 'S3';

export interface EdgeCloudPolicy {
  localProcessing: DataSensitivity[];
  cloudProcessing: DataSensitivity[];
  fallbackBehavior: 'local' | 'cloud' | 'hybrid';
}

// ============================================
// GUI Agent Types (UI-TARS-inspired)
// ============================================
// 注意：GUIAction / GUIContext 的权威定义在 computeruse/types.ts 中
// 此处为兼容保留类型引用，避免与 computeruse 模块导出冲突

// ============================================
// Gateway Types (NewAPI-inspired)
// ============================================
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

// ============================================
// WebUI Types
// ============================================
export interface DashboardStats {
  totalTasks: number;
  activeAgents: number;
  apiCallsToday: number;
  tokensUsedToday: number;
  costToday: number;
}

// ============================================
// Model Switching Events
// ============================================
export interface ModelSwitchEvent {
  fromModelId: string;
  fromModelName: string;
  toModelId: string;
  toModelName: string;
  reason: string;
  timestamp: Date;
  taskId?: string;
}

// ============================================
// Agent Framework Patterns - inspired by GoA, MMoA, Swarm, etc.
// ============================================
export type AgentFrameworkPattern =
  | 'mixture-of-agents'    // MoA: multiple agents generate, aggregate, refine
  | 'graph-of-agents'      // GoA: graph-based message passing between agents
  | 'swarm'                // Decentralized coordination with handoffs
  | 'pipeline'             // Sequential processing stages
  | 'adversarial'          // Generator-critic quality assurance
  | 'moe'                  // Mixture of Experts: route to specialized agents
  | 'group-chat'           // Multi-agent discussion with moderator
  | 'ultra-moe'            // Enhanced MoE with dynamic expert selection
  | 'debate'               // Agents argue different positions, vote on outcome
  | 'reflection'           // Agent self-evaluates and iterates
  | 'plan-and-execute'     // Planning agent + execution agent
  | 'reAct';               // Reasoning + Acting interleaved

export interface FrameworkPatternConfig {
  pattern: AgentFrameworkPattern;
  agentCount: number;           // Number of agents to involve
  maxRounds: number;            // Maximum interaction rounds
  votingStrategy: 'majority' | 'weighted' | 'best-of-n' | 'consensus';
  aggregationMethod: 'concatenate' | 'summarize' | 'select-best' | 'merge';
  enableReflection: boolean;    // Self-evaluation after each round
  enableCrossValidation: boolean;
  expertRouting?: {             // For MoE patterns
    enabled: boolean;
    routingModel?: string;
    topKExperts: number;
  };
  graphTopology?: {             // For GoA pattern
    nodes: string[];
    edges: Array<{ from: string; to: string; weight?: number }>;
  };
  pipelineStages?: string[];    // For pipeline pattern
}

// ============================================
// Agent Coordination Types
// ============================================
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

// ============================================
// Enhanced Task Types (framework-pattern aware)
// ============================================
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

// ============================================
// Model Routing Config (for MoE patterns)
// ============================================
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

// ============================================
// Dashboard Data Sync Types
// ============================================
export interface DashboardDataSource {
  id: string;
  name: string;
  url: string;
  type: 'newapi' | 'one-api' | 'custom';
  syncInterval: number;  // seconds
  lastSync?: number;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  mappingMethod: 'direct' | 'llm-assisted';
  authToken?: string;
}

export interface DashboardMetrics {
  account: {
    balance: number;
    historicalUsage: Array<{ date: number; cost: number }>;
  };
  usage: {
    totalRequests: number;
    totalStatistics: number;
    requestsByDay: Array<{ date: number; count: number }>;
  };
  resources: {
    quotaTotal: number;
    quotaUsed: number;
    totalTokens: { input: number; output: number };
    tokensByDay: Array<{ date: number; input: number; output: number }>;
  };
  performance: {
    avgRPM: number;
    avgTPM: number;
    peakTPS: number;
    peakConcurrency: number;
  };
  modelAnalysis: {
    consumptionByModel: Array<{ model: string; cost: number }>;
    callTrendByModel: Array<{ model: string; data: Array<{ date: number; calls: number }> }>;
    callDistribution: Array<{ model: string; percentage: number }>;
    callRanking: Array<{ model: string; calls: number }>;
  };
}

// ============================================
// Provider Billing Multiplier Support
// ============================================
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

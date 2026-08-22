/**
 * OxygenClaw Backend API Types
 * Generated from BACKEND_*_SPEC.md
 */

// ============================================================================
// Common Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ============================================================================
// Health & System
// ============================================================================

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
  displayVersion: string;
}

// ============================================================================
// Models
// ============================================================================

export interface Model {
  id: string;                    // providerId:modelName
  name: string;
  displayName: string;
  provider: string;
  maxTokens?: number;
  supportsVision: boolean;
  supportsTools: boolean;
  costPer1KInput?: number;
  costPer1KOutput?: number;
  enabled: boolean;
}

export interface ModelsResponse {
  models: Model[];
}

// ============================================================================
// Conversations
// ============================================================================

export type ConversationMode = 'chat' | 'task' | 'computeruse';
export type ConversationCapability = 'fast' | 'think' | 'expert' | 'research' | 'moa';

export interface Conversation {
  id: string;
  title: string;
  mode: ConversationMode;
  capability: ConversationCapability;
  modelId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  metadata?: {
    tags?: string[];
    pinned?: boolean;
    archived?: boolean;
    color?: string;
  };
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'url' | 'base64';
    url?: string;
    media_type?: string;
    data?: string;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string | ContentBlock[];
  timestamp: string;
  createdAt: string;
  metadata?: {
    model?: string;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
    thinkingContent?: string;
    toolCalls?: ToolCall[];
    attachments?: Attachment[];
    feedback?: 'like' | 'dislike';
    regenerated?: boolean;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio';
  name: string;
  size: number;
  url: string;
  mimeType: string;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: Message[];
}

export interface ConversationsListResponse {
  conversations: Conversation[];
  pagination: Pagination;
}

export interface CreateConversationRequest {
  title?: string;
  mode: ConversationMode;
  capability: ConversationCapability;
  modelId: string;
  metadata?: Conversation['metadata'];
}

export interface SendMessageRequest {
  content?: string;
  role?: MessageRole;
  modelId?: string;
  generate?: boolean;
}

export interface SendMessageResponse {
  taskId: string;
  workerRunId: string;
  status: 'pending';
  eventsUrl: string;
}

// ============================================================================
// Runtime Tasks
// ============================================================================

export type RuntimeTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type RuntimeTaskKind = 'agent' | 'computeruse' | 'chat';

export interface RuntimeTask {
  id: string;
  userId?: string;
  conversationId?: string;
  kind: RuntimeTaskKind;
  prompt: string;
  task: string;
  mode: string;
  capability: string;
  modelId?: string;
  status: RuntimeTaskStatus;
  result?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  updatedAt: number;
  completedAt?: number;
  cancelledAt?: number;
  metadata?: Record<string, unknown>;
}

export interface RuntimeTaskWithEvents extends RuntimeTask {
  events: RuntimeEvent[];
  workerRuns: WorkerRun[];
  steps: RuntimeStep[];
}

export interface RuntimeEvent {
  id: string;
  taskId: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface RuntimeStep {
  type: string;
  content?: string;
  action?: string;
  timestamp?: number;
  [key: string]: unknown;
}

export interface WorkerRun {
  id: string;
  taskId: string;
  workerType: string;
  status: RuntimeTaskStatus;
  startedAt: number;
  heartbeatAt: number;
  completedAt?: number;
  exitReason?: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeTasksResponse {
  tasks: RuntimeTask[];
}

export interface RuntimeTaskDetailResponse {
  task: RuntimeTaskWithEvents;
}

export interface RuntimeEventsResponse {
  taskId: string;
  events: RuntimeEvent[];
}

export interface StartAgentTaskRequest {
  prompt: string;
  mode?: string;
  capability?: string;
  modelId: string;
  workerType?: 'local-agent' | 'container-agent';
}

export interface StartAgentTaskResponse {
  taskId: string;
  workerRunId: string;
  workerType: string;
  status: 'pending';
  eventsUrl: string;
}

export interface StartComputerUseRequest {
  task: string;
  modelId: string;
}

export interface WorkerManagerStats {
  maxConcurrency: number;
  queued: number;
  running: number;
  adapters: string[];
  tasks: {
    queued: Array<{ taskId: string; workerType: string; enqueuedAt: number }>;
    running: Array<{ taskId: string; workerType: string; startedAt: number; heartbeatAt: number; cancelled: boolean }>;
  };
}

export interface WorkerCapability {
  type: string;
  label: string;
  available: boolean;
  default: boolean;
  isolation: 'process' | 'container' | 'remote';
  supportsCancel: boolean;
  supportsHeartbeat: boolean;
  supportsArtifacts: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Settings
// ============================================================================

export interface Settings {
  // Appearance
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  fontSize?: 'small' | 'normal' | 'large' | 'xlarge';
  sidebarDensity?: 'compact' | 'normal' | 'comfortable';
  showMessageTime?: boolean;
  showAvatar?: boolean;
  animations?: boolean;
  reduceMotion?: boolean;
  showSidebar?: boolean;
  sidebarIconSize?: 'small' | 'medium' | 'large';
  sidebarPosition?: 'left' | 'right';
  zoomLevel?: string;

  // Model Defaults
  defaultModel?: string;
  defaultMode?: 'chat' | 'task';
  defaultCapability?: 'fast' | 'think' | 'expert' | 'research' | 'moa';
  temperature?: number;
  maxTokens?: number;
  topP?: number;

  // Chat Behavior
  autoScroll?: boolean;
  autoSaveDraft?: boolean;
  streamOutput?: boolean;
  showThinking?: boolean;

  // Notifications
  notificationsEnabled?: boolean;
  soundEnabled?: boolean;
  taskRemindersEnabled?: boolean;
  dndEnabled?: boolean;
  dndStart?: string;
  dndEnd?: string;

  // System
  workspaceDir?: string;
  autoStart?: boolean;
  startMinimized?: boolean;
  disableGpuAccel?: boolean;
  hotkey?: string;
  maxCacheSize?: number;

  // Data Sources
  dataSourceUrl?: string;
  dataSourceEnabled?: boolean;

  // Multimodal - Vision
  visionApiKey?: string;
  visionBaseUrl?: string;
  visionModel?: string;
  visionEnabled?: boolean;

  // Multimodal - ASR
  asrApiKey?: string;
  asrBaseUrl?: string;
  asrModel?: string;
  asrEnabled?: boolean;

  // Multimodal - TTS
  ttsApiKey?: string;
  ttsBaseUrl?: string;
  ttsModel?: string;
  ttsVoice?: string;
  ttsSpeed?: number;
  ttsEnabled?: boolean;
  voiceInputEnabled?: boolean;
  voiceOutputEnabled?: boolean;

  // Image Generation
  imageGenApiKey?: string;
  imageGenBaseUrl?: string;
  imageGenModel?: string;
  imageGenDefaultModel?: string;
  imageGenDefaultSize?: string;
  imageGenDefaultQuality?: string;
  imageGenDefaultSteps?: number;
  imageGenDefaultCfgScale?: number;
  imageGenSaveHistory?: boolean;
  imageGenEnabled?: boolean;

  // Dashboard API
  dashboardApiUrl?: string;
  dashboardApiKey?: string;
  dashboardApiEnabled?: boolean;
  dashboardApiUseProxy?: boolean;

  // Advanced
  directModelAccess?: boolean;

  [key: string]: unknown;
}

export interface SettingsResponse {
  [key: string]: unknown;
}

export interface SettingsSchemaResponse {
  version: number;
  fields: string[];
  externalFields: string[];
  sensitiveFields: string[];
  booleanFields: string[];
  numberFields: string[];
  selectOptions: Record<string, unknown[]>;
  numberRanges: Record<string, { min: number; max: number }>;
}

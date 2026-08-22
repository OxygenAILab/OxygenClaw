/**
 * OxygenClaw Constants
 */

export const VERSION = '26.0.0-alpha.1';
export const DISPLAY_VERSION = 'v26.0 Alpha 1';

export const AGENT_MODES = {
  QUICK: 'quick',
  EXPERT: 'expert',
  TASK: 'task',
} as const;

export const DEFAULT_CONFIG = {
  port: 3000,
  host: 'localhost',
  contextWindow: 128000,
  maxRetries: 3,
  timeout: 30000,
};

export const INTEGRATED_PROJECTS = [
  { name: 'TinyClaw', description: 'Lightweight CLI agent', url: 'https://github.com/mrcloudchase/tinyclaw' },
  { name: 'EdgeClaw', description: 'Edge-Cloud collaborative agent', url: 'https://github.com/OpenBMB/EdgeClaw' },
  { name: 'NanoClaw', description: 'Container-isolated agent', url: 'https://github.com/nanocoai/nanoclaw' },
  { name: 'StepClaw', description: 'Cloud deployment by StepFun', url: 'https://stepfun.com' },
  { name: 'OpenHands', description: 'Multi-platform agent framework', url: 'https://github.com/OpenHands/openhands' },
  { name: 'UI-TARS', description: 'GUI agent by ByteDance', url: 'https://github.com/bytedance/ui-tars-desktop' },
];

export const COGNITIVE_LEVELS = {
  L1: 'Fast Response',
  L2: 'Step-by-Step',
  L3: 'Reflective',
  L4: 'Multi-Path',
  L5: 'Collaborative',
} as const;

export const MCP_TRANSPORTS = {
  STDIO: 'stdio',
  STREAMABLE_HTTP: 'streamable-http',
  SSE: 'sse',
} as const;

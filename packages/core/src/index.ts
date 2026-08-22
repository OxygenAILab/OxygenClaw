/**
 * OxygenClaw Core - Main Entry Point
 * Exports all core modules
 */

// Types
export * from './types';

// Cognition
export * from './cognition/odc';

// Memory
export * from './memory/omm';

// Models
export * from './models/registry';

// MCP
export * from './mcp/client';
export * from './mcp/server';

// LLM
export * from './llm/provider';

// Containers
export * from './containers/manager';

// Edge-Cloud
export * from './edge/cloud';

// Agent
export * from './agent';

// ComputerUse
export * from './computeruse';

// Utils
export { webSearch } from './utils/web-search';
export type { WebSearchResult, WebSearchOptions } from './utils/web-search';

// Import commonly used classes for convenience
export { ODCEngine, createODCEngine } from './cognition/odc';
export { OMMManager, createMemoryManager } from './memory/omm';
export { 
  ModelRegistry, 
  createModelRegistry, 
  normalizeModelName, 
  suggestModelNames, 
  STANDARD_MODEL_NAMES 
} from './models/registry';
export { MCPClientManager, MCPToolWrapper } from './mcp/client';
export { OxygenMCPServer, createMCPServer } from './mcp/server';
export { ContainerManager } from './containers/manager';
export { EdgeCloudManager, createEdgeCloudManager } from './edge/cloud';
export { OxygenAgent, createAgent, MoASubAgent, MoACoordination } from './agent';
export { ComputerUseAgent, createComputerUseAgent, VisionComputerUseAgent, createVisionComputerUseAgent } from './computeruse';
export { WindowsGUIOperator, createWindowsOperator } from './computeruse';
// export { SmartRouter, createGateway, createDefaultGatewayConfig } from '../../gateway/router';

"use strict";
/**
 * OxygenClaw Core - Main Entry Point
 * Exports all core modules
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWindowsOperator = exports.WindowsGUIOperator = exports.createVisionComputerUseAgent = exports.VisionComputerUseAgent = exports.createComputerUseAgent = exports.ComputerUseAgent = exports.createAgent = exports.OxygenAgent = exports.createEdgeCloudManager = exports.EdgeCloudManager = exports.ContainerManager = exports.createMCPServer = exports.OxygenMCPServer = exports.MCPToolWrapper = exports.MCPClientManager = exports.STANDARD_MODEL_NAMES = exports.suggestModelNames = exports.normalizeModelName = exports.createModelRegistry = exports.ModelRegistry = exports.createMemoryManager = exports.OMMManager = exports.createODCEngine = exports.ODCEngine = exports.webSearch = void 0;
// Types
__exportStar(require("./types"), exports);
// Cognition
__exportStar(require("./cognition/odc"), exports);
// Memory
__exportStar(require("./memory/omm"), exports);
// Models
__exportStar(require("./models/registry"), exports);
// MCP
__exportStar(require("./mcp/client"), exports);
__exportStar(require("./mcp/server"), exports);
// LLM
__exportStar(require("./llm/provider"), exports);
// Containers
__exportStar(require("./containers/manager"), exports);
// Edge-Cloud
__exportStar(require("./edge/cloud"), exports);
// Agent
__exportStar(require("./agent"), exports);
// ComputerUse
__exportStar(require("./computeruse"), exports);
// Utils
var web_search_1 = require("./utils/web-search");
Object.defineProperty(exports, "webSearch", { enumerable: true, get: function () { return web_search_1.webSearch; } });
// Import commonly used classes for convenience
var odc_1 = require("./cognition/odc");
Object.defineProperty(exports, "ODCEngine", { enumerable: true, get: function () { return odc_1.ODCEngine; } });
Object.defineProperty(exports, "createODCEngine", { enumerable: true, get: function () { return odc_1.createODCEngine; } });
var omm_1 = require("./memory/omm");
Object.defineProperty(exports, "OMMManager", { enumerable: true, get: function () { return omm_1.OMMManager; } });
Object.defineProperty(exports, "createMemoryManager", { enumerable: true, get: function () { return omm_1.createMemoryManager; } });
var registry_1 = require("./models/registry");
Object.defineProperty(exports, "ModelRegistry", { enumerable: true, get: function () { return registry_1.ModelRegistry; } });
Object.defineProperty(exports, "createModelRegistry", { enumerable: true, get: function () { return registry_1.createModelRegistry; } });
Object.defineProperty(exports, "normalizeModelName", { enumerable: true, get: function () { return registry_1.normalizeModelName; } });
Object.defineProperty(exports, "suggestModelNames", { enumerable: true, get: function () { return registry_1.suggestModelNames; } });
Object.defineProperty(exports, "STANDARD_MODEL_NAMES", { enumerable: true, get: function () { return registry_1.STANDARD_MODEL_NAMES; } });
var client_1 = require("./mcp/client");
Object.defineProperty(exports, "MCPClientManager", { enumerable: true, get: function () { return client_1.MCPClientManager; } });
Object.defineProperty(exports, "MCPToolWrapper", { enumerable: true, get: function () { return client_1.MCPToolWrapper; } });
var server_1 = require("./mcp/server");
Object.defineProperty(exports, "OxygenMCPServer", { enumerable: true, get: function () { return server_1.OxygenMCPServer; } });
Object.defineProperty(exports, "createMCPServer", { enumerable: true, get: function () { return server_1.createMCPServer; } });
var manager_1 = require("./containers/manager");
Object.defineProperty(exports, "ContainerManager", { enumerable: true, get: function () { return manager_1.ContainerManager; } });
var cloud_1 = require("./edge/cloud");
Object.defineProperty(exports, "EdgeCloudManager", { enumerable: true, get: function () { return cloud_1.EdgeCloudManager; } });
Object.defineProperty(exports, "createEdgeCloudManager", { enumerable: true, get: function () { return cloud_1.createEdgeCloudManager; } });
var agent_1 = require("./agent");
Object.defineProperty(exports, "OxygenAgent", { enumerable: true, get: function () { return agent_1.OxygenAgent; } });
Object.defineProperty(exports, "createAgent", { enumerable: true, get: function () { return agent_1.createAgent; } });
var computeruse_1 = require("./computeruse");
Object.defineProperty(exports, "ComputerUseAgent", { enumerable: true, get: function () { return computeruse_1.ComputerUseAgent; } });
Object.defineProperty(exports, "createComputerUseAgent", { enumerable: true, get: function () { return computeruse_1.createComputerUseAgent; } });
Object.defineProperty(exports, "VisionComputerUseAgent", { enumerable: true, get: function () { return computeruse_1.VisionComputerUseAgent; } });
Object.defineProperty(exports, "createVisionComputerUseAgent", { enumerable: true, get: function () { return computeruse_1.createVisionComputerUseAgent; } });
var computeruse_2 = require("./computeruse");
Object.defineProperty(exports, "WindowsGUIOperator", { enumerable: true, get: function () { return computeruse_2.WindowsGUIOperator; } });
Object.defineProperty(exports, "createWindowsOperator", { enumerable: true, get: function () { return computeruse_2.createWindowsOperator; } });
// export { SmartRouter, createGateway, createDefaultGatewayConfig } from '../../gateway/router';
//# sourceMappingURL=index.js.map
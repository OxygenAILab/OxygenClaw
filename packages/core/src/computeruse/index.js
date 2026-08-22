"use strict";
/**
 * OxygenClaw ComputerUse Module
 * GUI Agent framework based on UI-TARS and OpenClaw patterns
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
exports.formatGUIAction = exports.parseGUIAction = exports.createWindowsOperator = exports.WindowsGUIOperator = exports.createMockOperator = exports.MockGUIOperator = exports.createVisionComputerUseAgent = exports.VisionComputerUseAgent = exports.createComputerUseAgent = exports.ComputerUseAgent = void 0;
__exportStar(require("./types"), exports);
__exportStar(require("./agent"), exports);
__exportStar(require("./vision-agent"), exports);
__exportStar(require("./action-parser"), exports);
__exportStar(require("./mock-operator"), exports);
__exportStar(require("./windows-operator"), exports);
var agent_1 = require("./agent");
Object.defineProperty(exports, "ComputerUseAgent", { enumerable: true, get: function () { return agent_1.ComputerUseAgent; } });
Object.defineProperty(exports, "createComputerUseAgent", { enumerable: true, get: function () { return agent_1.createComputerUseAgent; } });
var vision_agent_1 = require("./vision-agent");
Object.defineProperty(exports, "VisionComputerUseAgent", { enumerable: true, get: function () { return vision_agent_1.VisionComputerUseAgent; } });
Object.defineProperty(exports, "createVisionComputerUseAgent", { enumerable: true, get: function () { return vision_agent_1.createVisionComputerUseAgent; } });
var mock_operator_1 = require("./mock-operator");
Object.defineProperty(exports, "MockGUIOperator", { enumerable: true, get: function () { return mock_operator_1.MockGUIOperator; } });
Object.defineProperty(exports, "createMockOperator", { enumerable: true, get: function () { return mock_operator_1.createMockOperator; } });
var windows_operator_1 = require("./windows-operator");
Object.defineProperty(exports, "WindowsGUIOperator", { enumerable: true, get: function () { return windows_operator_1.WindowsGUIOperator; } });
Object.defineProperty(exports, "createWindowsOperator", { enumerable: true, get: function () { return windows_operator_1.createWindowsOperator; } });
var action_parser_1 = require("./action-parser");
Object.defineProperty(exports, "parseGUIAction", { enumerable: true, get: function () { return action_parser_1.parseGUIAction; } });
Object.defineProperty(exports, "formatGUIAction", { enumerable: true, get: function () { return action_parser_1.formatGUIAction; } });
//# sourceMappingURL=index.js.map
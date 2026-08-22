"use strict";
/**
 * Mock GUI Operator for testing and development
 * Simulates GUI actions without actually controlling the screen
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockGUIOperator = void 0;
exports.createMockOperator = createMockOperator;
class MockGUIOperator {
    name = 'mock';
    config;
    actionHistory = [];
    stepCount = 0;
    constructor(config = {}) {
        this.config = {
            operatorType: 'mock',
            screenshotQuality: 75,
            waitTimeAfterAction: 500,
            maxRetries: 3,
            enableVision: false,
            browserMode: false,
            ...config,
        };
    }
    async initialize() {
        this.actionHistory = [];
        this.stepCount = 0;
    }
    async screenshot() {
        const width = 1920;
        const height = 1080;
        return {
            base64: '',
            scaleFactor: 1,
            width,
            height,
        };
    }
    async execute(action) {
        this.stepCount++;
        const result = {
            success: true,
            action,
            observation: `Mock execution of ${action.type}`,
            timestamp: Date.now(),
        };
        this.actionHistory.push(result);
        return result;
    }
    async getContext() {
        const screenshot = await this.screenshot();
        return {
            screenshot,
            activeWindow: 'Mock Window',
            clipboard: '',
            accessibilityTree: undefined,
        };
    }
    async cleanup() {
        this.actionHistory = [];
        this.stepCount = 0;
    }
    getActionHistory() {
        return [...this.actionHistory];
    }
    getStepCount() {
        return this.stepCount;
    }
}
exports.MockGUIOperator = MockGUIOperator;
function createMockOperator(config) {
    return new MockGUIOperator(config);
}
//# sourceMappingURL=mock-operator.js.map
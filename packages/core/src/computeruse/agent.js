"use strict";
/**
 * ComputerUse Agent
 * Core agent loop for GUI automation
 * Based on UI-TARS-desktop architecture and OpenClaw agent pattern
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComputerUseAgent = void 0;
exports.createComputerUseAgent = createComputerUseAgent;
const uuid_1 = require("uuid");
const types_1 = require("./types");
const mock_operator_1 = require("./mock-operator");
const action_parser_1 = require("./action-parser");
const provider_1 = require("../llm/provider");
class ComputerUseAgent {
    id;
    model;
    operator;
    config;
    maxSteps;
    initialContext;
    currentTask;
    stepCount = 0;
    stopped = false;
    constructor(options) {
        this.id = (0, uuid_1.v4)();
        this.model = options.model;
        this.operator = options.operator || (0, mock_operator_1.createMockOperator)();
        this.config = {
            operatorType: 'mock',
            screenshotQuality: 75,
            waitTimeAfterAction: 500,
            maxRetries: 3,
            enableVision: false,
            browserMode: false,
            ...options.config,
        };
        this.maxSteps = options.maxSteps || 50;
        this.initialContext = options.initialContext || '';
    }
    async initialize() {
        await this.operator.initialize();
    }
    async executeTask(goal) {
        const task = {
            id: (0, uuid_1.v4)(),
            goal,
            status: 'running',
            steps: [],
            createdAt: new Date(),
        };
        this.currentTask = task;
        this.stepCount = 0;
        this.stopped = false;
        try {
            await this.runAgentLoop(task);
            task.status = 'completed';
            task.completedAt = new Date();
            task.result = `Task completed in ${task.steps.length} steps`;
        }
        catch (error) {
            task.status = 'failed';
            task.error = error instanceof Error ? error.message : String(error);
            task.completedAt = new Date();
        }
        return task;
    }
    async runAgentLoop(task) {
        let conversationHistory = [];
        const systemPrompt = this.buildSystemPrompt();
        conversationHistory.push({ role: 'system', content: systemPrompt });
        const userPrompt = this.buildUserPrompt(task.goal);
        conversationHistory.push({ role: 'user', content: userPrompt });
        this.addStep(task, 'think', `Starting task: ${task.goal}`);
        while (this.stepCount < this.maxSteps && task.status === 'running' && !this.stopped) {
            this.stepCount++;
            try {
                const screenshot = await this.operator.screenshot();
                this.addStep(task, 'screenshot', `Screenshot captured (${screenshot.width}x${screenshot.height})`);
                const screenMessage = this.buildScreenMessage(task.goal, screenshot);
                const messages = [...conversationHistory, { role: 'user', content: screenMessage }];
                const response = await (0, provider_1.callLLM)(this.model, messages, {
                    temperature: 0.2,
                    maxTokens: 2048,
                });
                const assistantContent = response.content;
                conversationHistory.push({ role: 'user', content: `Current screen captured at ${screenshot.width}x${screenshot.height}.` });
                conversationHistory.push({ role: 'assistant', content: assistantContent });
                const action = (0, action_parser_1.parseGUIAction)(assistantContent);
                if (!action) {
                    this.addStep(task, 'think', `Failed to parse action from response. Attempting to continue...`);
                    conversationHistory.push({
                        role: 'user',
                        content: 'I could not parse your action. Please respond with a valid action in the format: <action>action_name(params)</action>',
                    });
                    continue;
                }
                this.addStep(task, 'action', `Executing: ${action.type}`, action);
                if (action.type === 'finished') {
                    this.addStep(task, 'think', 'Task completed successfully');
                    break;
                }
                if (action.type === 'call_user') {
                    this.addStep(task, 'think', 'Agent requested user assistance');
                    break;
                }
                const result = await this.operator.execute(action);
                this.addStep(task, 'observation', result.observation || `Action ${action.type} executed`, undefined, result);
                if (!result.success) {
                    conversationHistory.push({
                        role: 'user',
                        content: `Action failed: ${result.error || 'Unknown error'}. Please try again or adjust your approach.`,
                    });
                }
                else {
                    conversationHistory.push({
                        role: 'user',
                        content: `Action executed successfully. Observation: ${result.observation || 'No additional observation'}`,
                    });
                }
                if (this.config.waitTimeAfterAction && this.config.waitTimeAfterAction > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.config.waitTimeAfterAction));
                }
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                this.addStep(task, 'observation', `Error: ${errorMsg}`);
                conversationHistory.push({
                    role: 'user',
                    content: `An error occurred: ${errorMsg}. Please try again or adjust your approach.`,
                });
            }
        }
        if (this.stepCount >= this.maxSteps) {
            this.addStep(task, 'think', `Max steps (${this.maxSteps}) reached`);
        }
        if (this.stopped) {
            task.status = 'failed';
            task.error = 'Task stopped by user';
            this.addStep(task, 'think', 'Task stopped by user');
        }
    }
    buildSystemPrompt() {
        let prompt = types_1.COMPUTERUSE_SYSTEM_PROMPT;
        if (this.initialContext) {
            prompt += `\n\n## Initial Context\n${this.initialContext}`;
        }
        if (this.config.browserMode) {
            prompt += `\n\n## Browser Mode\nYou are operating in a browser environment. Use navigate() to visit URLs and navigate_back() to go back.`;
        }
        return prompt;
    }
    buildUserPrompt(goal) {
        return `Your task is: ${goal}

Please observe the screen and complete the task step by step. Start by taking stock of what's currently on screen, then plan your approach.`;
    }
    buildScreenMessage(goal, screenshot) {
        const text = `Goal: ${goal}\n\nObserve the current screenshot and choose exactly one next GUI action. Use absolute pixel coordinates based on this screenshot size: ${screenshot.width}x${screenshot.height}.`;
        if (this.model.supportsVision && screenshot.base64) {
            return [
                { type: 'text', text },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshot.base64}` } },
            ];
        }
        return `${text}\n\nScreenshot image is not available to the model. If you cannot safely infer the next action, use call_user().`;
    }
    addStep(task, type, content, action, result) {
        task.steps.push({
            id: (0, uuid_1.v4)(),
            stepNumber: task.steps.length + 1,
            type,
            content,
            action,
            result,
            timestamp: new Date(),
        });
    }
    getCurrentTask() {
        return this.currentTask;
    }
    getStepCount() {
        return this.stepCount;
    }
    getId() {
        return this.id;
    }
    stop() {
        this.stopped = true;
    }
    async cleanup() {
        await this.operator.cleanup();
    }
}
exports.ComputerUseAgent = ComputerUseAgent;
function createComputerUseAgent(options) {
    return new ComputerUseAgent(options);
}
//# sourceMappingURL=agent.js.map
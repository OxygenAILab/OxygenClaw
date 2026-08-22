"use strict";
/**
 * Vision-enabled ComputerUse Agent
 * Uses dedicated vision API for screenshot analysis with resolution-aware coordinate conversion
 *
 * Key features:
 * - Separate vision model for screenshot analysis
 * - Resolution mismatch detection and coordinate conversion
 * - Coordinate reference system (top-left corner as origin)
 * - Asks vision model about image resolution first before analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionComputerUseAgent = void 0;
exports.createVisionComputerUseAgent = createVisionComputerUseAgent;
const uuid_1 = require("uuid");
const mock_operator_1 = require("./mock-operator");
const action_parser_1 = require("./action-parser");
const provider_1 = require("../llm/provider");
const VISION_SYSTEM_PROMPT = `You are a GUI analysis assistant. You analyze screenshots of computer screens and describe what you see.

## Important: Image Resolution Awareness

You MUST first identify the resolution of the image you are analyzing. The image may be:
- The original screenshot resolution (1:1 with the actual screen)
- Downscaled for faster processing
- Upscaled for detail analysis

## Coordinate Reference System

All coordinates in your responses should be based on the image's top-left corner as the origin (0,0):
- X-axis: from left (0) to right (image width)
- Y-axis: from top (0) to bottom (image height)

## Your Response Format

First, answer these questions about the image:
1. 图片的分辨率如何？(What is the resolution of the image?)
2. 图片的宽高比是多少？(What is the aspect ratio?)
3. 图片中主要显示了什么内容？(What is the main content displayed?)

Then, if asked to identify UI elements or click positions, provide coordinates in normalized [0-1] range format [x, y] where:
- x = pixel_x / image_width
- y = pixel_y / image_height

Also provide the pixel coordinates for reference.

## Analysis Guidelines
- Be precise about element positions
- Describe button states, text content, and visual hierarchy
- Note any interactive elements (buttons, inputs, links, menus)
- Identify window boundaries and UI frameworks if visible`;
class VisionComputerUseAgent {
    id;
    model;
    visionModel;
    operator;
    config;
    maxSteps;
    initialContext;
    coordinateSystem;
    currentTask;
    stepCount = 0;
    coordTransform;
    stopped = false;
    constructor(options) {
        this.id = (0, uuid_1.v4)();
        this.model = options.model;
        this.visionModel = options.visionModel;
        this.operator = options.operator || (0, mock_operator_1.createMockOperator)();
        this.config = {
            operatorType: 'mock',
            screenshotQuality: 75,
            waitTimeAfterAction: 500,
            maxRetries: 3,
            enableVision: true,
            browserMode: false,
            ...options.config,
        };
        this.maxSteps = options.maxSteps || 50;
        this.initialContext = options.initialContext || '';
        this.coordinateSystem = options.coordinateSystem || 'top-left';
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
        this.addStep(task, 'think', `Starting task with vision model: ${this.visionModel.name}`);
        while (this.stepCount < this.maxSteps && task.status === 'running' && !this.stopped) {
            this.stepCount++;
            try {
                const screenshot = await this.operator.screenshot();
                this.addStep(task, 'screenshot', `Screenshot captured (${screenshot.width}x${screenshot.height})`);
                const visionAnalysis = await this.analyzeScreenshot(screenshot);
                this.addStep(task, 'think', `Vision analysis: ${visionAnalysis.summary}`);
                this.coordTransform = this.buildCoordinateTransform(visionAnalysis.imageWidth, visionAnalysis.imageHeight, screenshot.width, screenshot.height);
                const userMessage = this.buildVisionUserMessage(screenshot, visionAnalysis);
                const visionHistory = [...conversationHistory, { role: 'user', content: userMessage }];
                const response = await (0, provider_1.callLLM)(this.model, visionHistory, {
                    temperature: 0.2,
                    maxTokens: 2048,
                });
                const assistantContent = response.content;
                conversationHistory.push({ role: 'assistant', content: assistantContent });
                const action = (0, action_parser_1.parseGUIAction)(assistantContent);
                if (!action) {
                    this.addStep(task, 'think', 'Failed to parse action from response. Attempting to continue...');
                    conversationHistory.push({
                        role: 'user',
                        content: 'I could not parse your action. Please respond with a valid action in the format: <action>action_name(params)</action>',
                    });
                    continue;
                }
                const convertedAction = this.convertActionCoordinates(action);
                this.addStep(task, 'action', `Executing: ${convertedAction.type}`, convertedAction);
                if (action.type === 'finished') {
                    this.addStep(task, 'think', 'Task completed successfully');
                    break;
                }
                if (action.type === 'call_user') {
                    this.addStep(task, 'think', 'Agent requested user assistance');
                    break;
                }
                const result = await this.operator.execute(convertedAction);
                this.addStep(task, 'observation', result.observation || `Action ${convertedAction.type} executed`, undefined, result);
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
    async analyzeScreenshot(screenshot) {
        const visionMessages = [
            { role: 'system', content: VISION_SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `请分析这张截图，并回答以下问题：
1. 图片的分辨率如何？请给出精确的像素宽高。
2. 图片中主要显示了什么内容？
3. 请列出你看到的所有可交互元素（按钮、输入框、链接、菜单等），并给出它们在图片中的位置坐标（以左上角为原点）。
坐标格式请使用归一化的 [x, y]，范围 0-1，同时也给出像素坐标。`
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: screenshot.base64.startsWith('data:')
                                ? screenshot.base64
                                : `data:image/png;base64,${screenshot.base64}`,
                            detail: 'high'
                        }
                    }
                ]
            }
        ];
        try {
            const response = await (0, provider_1.callLLM)(this.visionModel, visionMessages, {
                temperature: 0.1,
                maxTokens: 1024,
            });
            const content = response.content;
            const widthMatch = content.match(/(\d+)\s*[x×*]\s*(\d+)/i) || content.match(/宽度[：:]\s*(\d+)[\s\S]*?高度[：:]\s*(\d+)/i);
            const imageWidth = widthMatch ? parseInt(widthMatch[1]) : screenshot.width;
            const imageHeight = widthMatch ? parseInt(widthMatch[2]) : screenshot.height;
            return {
                summary: content.substring(0, 500),
                imageWidth,
                imageHeight,
                elements: []
            };
        }
        catch (error) {
            console.warn('[VisionAgent] Vision analysis failed, using screen dimensions:', error);
            return {
                summary: 'Vision analysis unavailable, using raw screenshot',
                imageWidth: screenshot.width,
                imageHeight: screenshot.height,
                elements: []
            };
        }
    }
    buildCoordinateTransform(imageWidth, imageHeight, screenWidth, screenHeight) {
        return {
            imageWidth,
            imageHeight,
            screenWidth,
            screenHeight,
            scaleX: screenWidth / imageWidth,
            scaleY: screenHeight / imageHeight,
            referenceOrigin: this.coordinateSystem,
        };
    }
    convertActionCoordinates(action) {
        if (!this.coordTransform) {
            return action;
        }
        const { scaleX, scaleY, screenWidth, screenHeight, imageWidth, imageHeight } = this.coordTransform;
        const converted = { ...action, inputs: { ...action.inputs } };
        if (converted.inputs.startX !== undefined && converted.inputs.startY !== undefined) {
            let x = converted.inputs.startX;
            let y = converted.inputs.startY;
            if (x <= 1 && y <= 1) {
                x = x * screenWidth;
                y = y * screenHeight;
            }
            else {
                x = x * scaleX;
                y = y * scaleY;
            }
            converted.inputs.startX = Math.max(0, Math.min(screenWidth - 1, x));
            converted.inputs.startY = Math.max(0, Math.min(screenHeight - 1, y));
        }
        if (converted.inputs.endX !== undefined && converted.inputs.endY !== undefined) {
            let x = converted.inputs.endX;
            let y = converted.inputs.endY;
            if (x <= 1 && y <= 1) {
                x = x * screenWidth;
                y = y * screenHeight;
            }
            else {
                x = x * scaleX;
                y = y * scaleY;
            }
            converted.inputs.endX = Math.max(0, Math.min(screenWidth - 1, x));
            converted.inputs.endY = Math.max(0, Math.min(screenHeight - 1, y));
        }
        if (converted.inputs.start_box) {
            const boxMatch = converted.inputs.start_box.match(/\[([\d.]+),\s*([\d.]+)/);
            if (boxMatch) {
                let x = parseFloat(boxMatch[1]);
                let y = parseFloat(boxMatch[2]);
                if (x <= 1 && y <= 1) {
                    x = x * screenWidth;
                    y = y * screenHeight;
                }
                else {
                    x = x * scaleX;
                    y = y * scaleY;
                }
                converted.inputs.start_box = `[${x.toFixed(2)}, ${y.toFixed(2)}]`;
            }
        }
        if (converted.inputs.end_box) {
            const boxMatch = converted.inputs.end_box.match(/\[([\d.]+),\s*([\d.]+)/);
            if (boxMatch) {
                let x = parseFloat(boxMatch[1]);
                let y = parseFloat(boxMatch[2]);
                if (x <= 1 && y <= 1) {
                    x = x * screenWidth;
                    y = y * screenHeight;
                }
                else {
                    x = x * scaleX;
                    y = y * scaleY;
                }
                converted.inputs.end_box = `[${x.toFixed(2)}, ${y.toFixed(2)}]`;
            }
        }
        return converted;
    }
    buildVisionUserMessage(screenshot, visionAnalysis) {
        const { imageWidth, imageHeight } = visionAnalysis;
        const mismatch = imageWidth !== screenshot.width || imageHeight !== screenshot.height;
        const contextText = `## 截图分析结果

视觉模型检测到的图片分辨率: ${imageWidth} x ${imageHeight}
实际屏幕分辨率: ${screenshot.width} x ${screenshot.height}
${mismatch ? `⚠️ 注意：检测到分辨率不匹配！坐标将自动进行缩放转换。` : '✅ 分辨率匹配'}

坐标参考系: 左上角为原点 (0,0)
- X轴: 从左到右
- Y轴: 从上到下

## 视觉分析摘要
${visionAnalysis.summary}

## 任务目标
请基于以上截图和分析，执行以下任务并返回下一步动作。`;
        return [
            {
                type: 'text',
                text: contextText
            },
            {
                type: 'image_url',
                image_url: {
                    url: screenshot.base64.startsWith('data:')
                        ? screenshot.base64
                        : `data:image/png;base64,${screenshot.base64}`,
                    detail: 'high'
                }
            }
        ];
    }
    buildSystemPrompt() {
        let prompt = `You are a GUI agent that can control a computer screen. Your task is to complete the user's goal by performing actions on the screen.

## Important: Vision Model Integration

You work together with a dedicated vision model that analyzes screenshots. The vision model will:
1. First identify the image resolution (图片的分辨率如何？)
2. Describe what's on the screen
3. Identify UI elements and their positions

All coordinates from the vision model use the top-left corner as origin (0,0).

## Coordinate Conversion

There might be a resolution mismatch between:
- The image resolution seen by the vision model
- The actual screen resolution where actions are executed

Coordinates will be automatically converted. You can use either:
- Normalized coordinates (0-1 range): [0.5, 0.3]
- Pixel coordinates (based on image resolution): [960, 324]

The system will automatically scale them to the actual screen resolution.

## Available Actions
${this.getActionList()}

## Guidelines
1. Read the vision analysis carefully to understand the screen state.
2. Plan your next action based on the task goal and visual information.
3. Use precise coordinates - refer to the vision analysis for element positions.
4. After each action, wait for the next screenshot to verify the result.
5. When the task is complete, use the finished() action.
6. If you cannot complete the task or need user assistance, use call_user().

## Response Format
Respond with your thinking and then a single action. Format your response as:

<thinking>
Your analysis of the current state and plan for the next action.
</thinking>

<action>
action_name(param='value')
</action>`;
        if (this.initialContext) {
            prompt += `\n\n## Initial Context\n${this.initialContext}`;
        }
        if (this.config.browserMode) {
            prompt += `\n\n## Browser Mode\nYou are operating in a browser environment. Use navigate() to visit URLs and navigate_back() to go back.`;
        }
        return prompt;
    }
    getActionList() {
        const actions = [
            `click(start_box='[x, y]') - Click on the screen at position`,
            `left_double(start_box='[x, y]') - Double click`,
            `right_single(start_box='[x, y]') - Right click`,
            `drag(start_box='[x1, y1]', end_box='[x2, y2]') - Drag from one point to another`,
            `hotkey(key='key_combination') - Press keyboard shortcut`,
            `type(content='text') - Type text`,
            `scroll(start_box='[x, y]', direction='down|up|left|right') - Scroll`,
            `wait() - Wait for a moment`,
            `screenshot() - Take a new screenshot`,
            `navigate(url='https://...') - Navigate to URL (browser mode)`,
            `navigate_back() - Go back (browser mode)`,
            `finished() - Task is complete`,
            `call_user() - Request user assistance`,
        ];
        return actions.map(a => `- ${a}`).join('\n');
    }
    buildUserPrompt(goal) {
        return `Your task is: ${goal}

The vision model will provide screenshot analysis. Use that information to plan and execute your actions. Coordinates will be automatically converted between image resolution and screen resolution.`;
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
    getCoordinateTransform() {
        return this.coordTransform;
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
exports.VisionComputerUseAgent = VisionComputerUseAgent;
function createVisionComputerUseAgent(options) {
    return new VisionComputerUseAgent(options);
}
//# sourceMappingURL=vision-agent.js.map
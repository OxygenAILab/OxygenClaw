"use strict";
/**
 * OxygenClaw ComputerUse Types
 * Based on UI-TARS-desktop GUI Agent design
 * Reference: bytedance/UI-TARS-desktop
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPUTERUSE_SYSTEM_PROMPT = exports.ACTION_SPACES = void 0;
exports.ACTION_SPACES = [
    `click(start_box='[x1, y1, x2, y2]')`,
    `left_double(start_box='[x1, y1, x2, y2]')`,
    `right_single(start_box='[x1, y1, x2, y2]')`,
    `drag(start_box='[x1, y1, x2, y2]', end_box='[x3, y3, x4, y4]')`,
    `hotkey(key='key_combination')`,
    `type(content='text')`,
    `scroll(start_box='[x1, y1, x2, y2]', direction='down|up|left|right')`,
    `wait()`,
    `screenshot()`,
    `navigate(url='https://...')`,
    `navigate_back()`,
    `finished()`,
    `call_user()`,
];
exports.COMPUTERUSE_SYSTEM_PROMPT = `You are a GUI agent that can control a computer screen. Your task is to complete the user's goal by performing actions on the screen.

## Available Actions
${exports.ACTION_SPACES.map(a => `- ${a}`).join('\n')}

## Guidelines
1. First, carefully observe the screenshot to understand the current screen state.
2. Plan your next action based on the task goal.
3. Use percentage-based coordinates (0-1 range) for click positions.
4. After each action, wait and observe the result before taking the next step.
5. If you're unsure about the result, take a screenshot to verify.
6. When the task is complete, use the finished() action.
7. If you cannot complete the task or need user assistance, use call_user().

## Response Format
Respond with your thinking and then a single action. Format your response as:

<thinking>
Your analysis of the current state and plan for the next action.
</thinking>

<action>
action_name(param='value')
</action>
`;
//# sourceMappingURL=types.js.map
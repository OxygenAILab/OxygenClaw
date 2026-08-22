/**
 * OxygenClaw ComputerUse Types
 * Based on UI-TARS-desktop GUI Agent design
 * Reference: bytedance/UI-TARS-desktop
 */
export interface GUIAction {
    type: GUIActionType;
    inputs: GUIActionInputs;
    thought?: string;
    rawAction?: string;
}
export type GUIActionType = 'click' | 'left_double' | 'right_single' | 'drag' | 'type' | 'hotkey' | 'scroll' | 'wait' | 'navigate' | 'navigate_back' | 'screenshot' | 'finished' | 'call_user';
export interface GUIActionInputs {
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    start_box?: string;
    end_box?: string;
    content?: string;
    key?: string;
    direction?: 'up' | 'down' | 'left' | 'right';
    url?: string;
}
export interface ScreenshotOutput {
    base64: string;
    scaleFactor: number;
    width: number;
    height: number;
}
export interface GUIContext {
    screenshot: ScreenshotOutput;
    activeWindow?: string;
    clipboard?: string;
    accessibilityTree?: string;
}
export interface ActionResult {
    success: boolean;
    action: GUIAction;
    observation?: string;
    error?: string;
    timestamp: number;
}
export interface ComputerUseConfig {
    operatorType: 'nutjs' | 'playwright' | 'puppeteer' | 'mock';
    screenshotQuality?: number;
    waitTimeAfterAction?: number;
    maxRetries?: number;
    enableVision?: boolean;
    browserMode?: boolean;
}
export interface GUIOperator {
    name: string;
    initialize(): Promise<void>;
    screenshot(): Promise<ScreenshotOutput>;
    execute(action: GUIAction): Promise<ActionResult>;
    getContext(): Promise<GUIContext>;
    cleanup(): Promise<void>;
}
export declare const ACTION_SPACES: string[];
export declare const COMPUTERUSE_SYSTEM_PROMPT: string;
//# sourceMappingURL=types.d.ts.map
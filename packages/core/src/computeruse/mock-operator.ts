/**
 * Mock GUI Operator for testing and development
 * Simulates GUI actions without actually controlling the screen
 */

import {
  GUIOperator,
  GUIAction,
  ActionResult,
  ScreenshotOutput,
  GUIContext,
  ComputerUseConfig,
} from './types';

export class MockGUIOperator implements GUIOperator {
  name = 'mock';
  private config: ComputerUseConfig;
  private actionHistory: ActionResult[] = [];
  private stepCount = 0;

  constructor(config: Partial<ComputerUseConfig> = {}) {
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

  async initialize(): Promise<void> {
    this.actionHistory = [];
    this.stepCount = 0;
  }

  async screenshot(): Promise<ScreenshotOutput> {
    const width = 1920;
    const height = 1080;
    
    return {
      base64: '',
      scaleFactor: 1,
      width,
      height,
    };
  }

  async execute(action: GUIAction): Promise<ActionResult> {
    this.stepCount++;
    
    const result: ActionResult = {
      success: true,
      action,
      observation: `Mock execution of ${action.type}`,
      timestamp: Date.now(),
    };

    this.actionHistory.push(result);
    return result;
  }

  async getContext(): Promise<GUIContext> {
    const screenshot = await this.screenshot();
    return {
      screenshot,
      activeWindow: 'Mock Window',
      clipboard: '',
      accessibilityTree: undefined,
    };
  }

  async cleanup(): Promise<void> {
    this.actionHistory = [];
    this.stepCount = 0;
  }

  getActionHistory(): ActionResult[] {
    return [...this.actionHistory];
  }

  getStepCount(): number {
    return this.stepCount;
  }
}

export function createMockOperator(config?: Partial<ComputerUseConfig>): MockGUIOperator {
  return new MockGUIOperator(config);
}

/**
 * Mock GUI Operator for testing and development
 * Simulates GUI actions without actually controlling the screen
 */
import { GUIOperator, GUIAction, ActionResult, ScreenshotOutput, GUIContext, ComputerUseConfig } from './types';
export declare class MockGUIOperator implements GUIOperator {
    name: string;
    private config;
    private actionHistory;
    private stepCount;
    constructor(config?: Partial<ComputerUseConfig>);
    initialize(): Promise<void>;
    screenshot(): Promise<ScreenshotOutput>;
    execute(action: GUIAction): Promise<ActionResult>;
    getContext(): Promise<GUIContext>;
    cleanup(): Promise<void>;
    getActionHistory(): ActionResult[];
    getStepCount(): number;
}
export declare function createMockOperator(config?: Partial<ComputerUseConfig>): MockGUIOperator;
//# sourceMappingURL=mock-operator.d.ts.map
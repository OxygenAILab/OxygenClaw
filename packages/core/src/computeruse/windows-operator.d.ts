import { GUIAction, GUIOperator, ActionResult, GUIContext, ScreenshotOutput } from './types';
export declare class WindowsGUIOperator implements GUIOperator {
    name: string;
    private screenshotDir;
    initialize(): Promise<void>;
    screenshot(): Promise<ScreenshotOutput>;
    execute(action: GUIAction): Promise<ActionResult>;
    getContext(): Promise<GUIContext>;
    cleanup(): Promise<void>;
    private toSendKeys;
    private mousePrelude;
    private mouseScript;
    private dragScript;
    private scrollScript;
}
export declare function createWindowsOperator(): WindowsGUIOperator;
//# sourceMappingURL=windows-operator.d.ts.map
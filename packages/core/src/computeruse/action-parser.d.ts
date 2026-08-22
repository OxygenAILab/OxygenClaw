/**
 * GUI Action Parser
 * Parses model output into structured GUI actions
 * Based on UI-TARS action parsing pattern
 */
import { GUIAction } from './types';
export declare function parseGUIAction(modelOutput: string): GUIAction | null;
export declare function formatGUIAction(action: GUIAction): string;
//# sourceMappingURL=action-parser.d.ts.map
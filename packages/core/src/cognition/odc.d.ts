import { CapabilityMode, InteractionMode } from '../types';
export type CognitiveLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
export interface CognitionResult {
    level: CognitiveLevel;
    confidence: number;
    reasoning: string;
    shouldStop: boolean;
    nextAction?: 'continue' | 'search' | 'tool' | 'delegate' | 'output';
    agentsToSpawn?: number;
    taskDecomposition?: TaskStep[];
    toolRecommendation?: string;
    confidenceExplanation?: string;
}
export interface TaskStep {
    id: string;
    description: string;
    estimatedCost: number;
    requiredTools: string[];
    priority: 'high' | 'medium' | 'low';
}
export interface ODCOptions {
    mode: CapabilityMode;
    interactionMode: InteractionMode;
    maxIterations: number;
    confidenceThreshold: number;
    enableReflection: boolean;
    enableMultiPath: boolean;
    enableMoA: boolean;
}
export declare class ODCEngine {
    private mode;
    private interactionMode;
    private maxIterations;
    private confidenceThreshold;
    private enableReflection;
    private enableMultiPath;
    private enableMoA;
    private iterationCount;
    private reasoningHistory;
    private taskDecomposition;
    constructor(options?: Partial<ODCOptions>);
    think(prompt: string, context: Record<string, unknown>, availableTools: string[]): Promise<CognitionResult>;
    private getStartLevel;
    private reasonAtLevel;
    private l1FastResponse;
    private l2StepByStep;
    private l3Reflective;
    private l4MultiPath;
    private l5Collaborative;
    private upgradeCognition;
    private extractKeywords;
    private detectSearchNeed;
    private detectToolNeed;
    private decomposeTask;
    private performSelfAssessment;
    private exploreMultiplePaths;
    private assignAgents;
    private getCoordinationStrategy;
    getIterationCount(): number;
    getReasoningHistory(): string[];
    getTaskDecomposition(): TaskStep[];
}
export declare function createODCEngine(mode: CapabilityMode, interactionMode?: InteractionMode): ODCEngine;
//# sourceMappingURL=odc.d.ts.map
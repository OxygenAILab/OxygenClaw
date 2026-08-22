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
import { GUIOperator, ComputerUseConfig } from './types';
import { ModelConfig } from '../types';
import { ComputerUseTask } from './agent';
export interface VisionAgentOptions {
    model: ModelConfig;
    visionModel: ModelConfig;
    operator?: GUIOperator;
    config?: Partial<ComputerUseConfig>;
    maxSteps?: number;
    initialContext?: string;
    coordinateSystem?: 'top-left' | 'bottom-left' | 'center';
}
export interface CoordinateTransform {
    imageWidth: number;
    imageHeight: number;
    screenWidth: number;
    screenHeight: number;
    scaleX: number;
    scaleY: number;
    referenceOrigin: 'top-left' | 'bottom-left' | 'center';
}
export declare class VisionComputerUseAgent {
    private id;
    private model;
    private visionModel;
    private operator;
    private config;
    private maxSteps;
    private initialContext;
    private coordinateSystem;
    private currentTask?;
    private stepCount;
    private coordTransform?;
    private stopped;
    constructor(options: VisionAgentOptions);
    initialize(): Promise<void>;
    executeTask(goal: string): Promise<ComputerUseTask>;
    private runAgentLoop;
    private analyzeScreenshot;
    private buildCoordinateTransform;
    private convertActionCoordinates;
    private buildVisionUserMessage;
    private buildSystemPrompt;
    private getActionList;
    private buildUserPrompt;
    private addStep;
    getCurrentTask(): ComputerUseTask | undefined;
    getStepCount(): number;
    getCoordinateTransform(): CoordinateTransform | undefined;
    getId(): string;
    stop(): void;
    cleanup(): Promise<void>;
}
export declare function createVisionComputerUseAgent(options: VisionAgentOptions): VisionComputerUseAgent;
//# sourceMappingURL=vision-agent.d.ts.map
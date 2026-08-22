/**
 * ComputerUse Agent
 * Core agent loop for GUI automation
 * Based on UI-TARS-desktop architecture and OpenClaw agent pattern
 */
import { GUIAction, GUIOperator, ActionResult, ComputerUseConfig } from './types';
import { ModelConfig } from '../types';
export interface ComputerUseAgentOptions {
    model: ModelConfig;
    operator?: GUIOperator;
    config?: Partial<ComputerUseConfig>;
    maxSteps?: number;
    initialContext?: string;
}
export interface ComputerUseTask {
    id: string;
    goal: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    steps: ComputerUseStep[];
    createdAt: Date;
    completedAt?: Date;
    result?: string;
    error?: string;
}
export interface ComputerUseStep {
    id: string;
    stepNumber: number;
    type: 'think' | 'action' | 'observation' | 'screenshot';
    content: string;
    action?: GUIAction;
    result?: ActionResult;
    timestamp: Date;
}
export declare class ComputerUseAgent {
    private id;
    private model;
    private operator;
    private config;
    private maxSteps;
    private initialContext;
    private currentTask?;
    private stepCount;
    private stopped;
    constructor(options: ComputerUseAgentOptions);
    initialize(): Promise<void>;
    executeTask(goal: string): Promise<ComputerUseTask>;
    private runAgentLoop;
    private buildSystemPrompt;
    private buildUserPrompt;
    private buildScreenMessage;
    private addStep;
    getCurrentTask(): ComputerUseTask | undefined;
    getStepCount(): number;
    getId(): string;
    stop(): void;
    cleanup(): Promise<void>;
}
export declare function createComputerUseAgent(options: ComputerUseAgentOptions): ComputerUseAgent;
//# sourceMappingURL=agent.d.ts.map
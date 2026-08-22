/**
 * Edge-Cloud Collaboration Manager
 * Implements three-tier data security strategy (S1/S2/S3)
 * Integrated from: EdgeClaw architecture
 */
import { DataSensitivity, EdgeCloudPolicy, AgentTask } from '../types';
export declare class EdgeCloudManager {
    private policy;
    private localAgents;
    private cloudAgents;
    constructor(policy?: EdgeCloudPolicy);
    /**
     * Determine processing location based on data sensitivity
     */
    determineProcessingLocation(sensitivity: DataSensitivity): 'local' | 'cloud';
    /**
     * Classify task data sensitivity
     */
    classifyTask(task: AgentTask): DataSensitivity;
    /**
     * Route task to appropriate agent
     */
    routeTask(task: AgentTask): {
        location: 'local' | 'cloud';
        sensitivity: DataSensitivity;
        agentId?: string;
    };
    /**
     * Register local agent
     */
    registerLocalAgent(agentId: string, endpoint: string): void;
    /**
     * Register cloud agent
     */
    registerCloudAgent(agentId: string, endpoint: string): void;
    /**
     * Get available local agent
     */
    getAvailableLocalAgent(): string | undefined;
    /**
     * Get available cloud agent
     */
    getAvailableCloudAgent(): string | undefined;
    /**
     * Get all registered agents
     */
    listAgents(): {
        local: Array<{
            id: string;
            endpoint: string;
        }>;
        cloud: Array<{
            id: string;
            endpoint: string;
        }>;
    };
    /**
     * Update policy
     */
    updatePolicy(policy: EdgeCloudPolicy): void;
    /**
     * Get current policy
     */
    getPolicy(): EdgeCloudPolicy;
    /**
     * Check if data can be processed locally
     */
    canProcessLocally(sensitivity: DataSensitivity): boolean;
    /**
     * Check if data needs cloud processing
     */
    needsCloudProcessing(sensitivity: DataSensitivity): boolean;
}
export declare function createEdgeCloudManager(policy?: EdgeCloudPolicy): EdgeCloudManager;
//# sourceMappingURL=cloud.d.ts.map
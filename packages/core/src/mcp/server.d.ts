/**
 * MCP Server Module
 * OxygenClaw as MCP Server - allows external agents to connect
 * Supports main-agent and sub-agent identities with task delegation
 */
export type AgentRole = 'main-agent' | 'sub-agent';
export interface ConnectedAgent {
    id: string;
    role: AgentRole;
    mainAgentId?: string;
    name: string;
    connectedAt: Date;
    lastActive: Date;
    capabilities: string[];
    transport: 'stdio' | 'sse' | 'streamable-http';
    metadata: Record<string, any>;
}
export interface MCPServerAgentTask {
    id: string;
    mainAgentId: string;
    subAgentId: string;
    title: string;
    description: string;
    status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
    priority: 'low' | 'medium' | 'high';
    createdAt: Date;
    assignedAt?: Date;
    completedAt?: Date;
    deliverables?: {
        path: string;
        description: string;
        format: string;
    }[];
    result?: string;
    error?: string;
}
export interface MCPServerTaskQueue {
    pending: MCPServerAgentTask[];
    inProgress: MCPServerAgentTask[];
    completed: MCPServerAgentTask[];
    failed: MCPServerAgentTask[];
}
export declare class OxygenMCPServer {
    private agents;
    private mainAgents;
    private taskQueues;
    private waitingSubAgents;
    private taskCallbacks;
    constructor();
    /**
     * Register a new agent connection
     */
    registerAgent(config: {
        role: AgentRole;
        mainAgentId?: string;
        name: string;
        capabilities?: string[];
        transport?: 'stdio' | 'sse' | 'streamable-http';
        metadata?: Record<string, any>;
    }): ConnectedAgent;
    /**
     * Unregister an agent
     */
    unregisterAgent(agentId: string): boolean;
    /**
     * Get agent by ID
     */
    getAgent(agentId: string): ConnectedAgent | undefined;
    /**
     * List all connected agents
     */
    listAgents(role?: AgentRole): ConnectedAgent[];
    /**
     * Get sub-agents under a main agent
     */
    getSubAgents(mainAgentId: string): ConnectedAgent[];
    /**
     * Main agent assigns task to sub-agent
     */
    assignTask(config: {
        mainAgentId: string;
        subAgentId?: string;
        title: string;
        description: string;
        priority?: 'low' | 'medium' | 'high';
    }): MCPServerAgentTask | null;
    /**
     * Sub-agent waits for task (WaitTask request)
     */
    waitForTask(subAgentId: string, callback: (task: MCPServerAgentTask) => void): void;
    /**
     * Notify a waiting sub-agent of a new task
     */
    private notifyWaitingSubAgent;
    /**
     * Sub-agent completes task and delivers result
     */
    deliverTask(config: {
        subAgentId: string;
        taskId: string;
        result?: string;
        deliverables?: Array<{
            path: string;
            description: string;
            format: string;
        }>;
    }): {
        success: boolean;
        task?: MCPServerAgentTask;
        error?: string;
    };
    /**
     * Sub-agent reports task failure
     */
    failTask(config: {
        subAgentId: string;
        taskId: string;
        error: string;
    }): {
        success: boolean;
        task?: MCPServerAgentTask;
        error?: string;
    };
    /**
     * Get task queue for a main agent
     */
    getMCPServerTaskQueue(mainAgentId: string): MCPServerTaskQueue | undefined;
    /**
     * Get task by ID
     */
    getTask(mainAgentId: string, taskId: string): MCPServerAgentTask | undefined;
    /**
     * Update agent heartbeat
     */
    heartbeat(agentId: string): boolean;
    /**
     * Get server stats
     */
    getStats(): {
        connectedAgents: number;
        mainAgents: number;
        subAgents: number;
        totalTasks: number;
        pendingTasks: number;
        inProgressTasks: number;
        completedTasks: number;
        failedTasks: number;
    };
}
export declare function createMCPServer(): OxygenMCPServer;
//# sourceMappingURL=server.d.ts.map
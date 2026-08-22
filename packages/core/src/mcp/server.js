"use strict";
/**
 * MCP Server Module
 * OxygenClaw as MCP Server - allows external agents to connect
 * Supports main-agent and sub-agent identities with task delegation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OxygenMCPServer = void 0;
exports.createMCPServer = createMCPServer;
const uuid_1 = require("uuid");
class OxygenMCPServer {
    agents = new Map();
    mainAgents = new Map();
    taskQueues = new Map();
    waitingSubAgents = new Map();
    taskCallbacks = new Map();
    constructor() {
    }
    /**
     * Register a new agent connection
     */
    registerAgent(config) {
        const id = (0, uuid_1.v4)();
        const agent = {
            id,
            role: config.role,
            mainAgentId: config.mainAgentId,
            name: config.name,
            connectedAt: new Date(),
            lastActive: new Date(),
            capabilities: config.capabilities || [],
            transport: config.transport || 'stdio',
            metadata: config.metadata || {}
        };
        this.agents.set(id, agent);
        if (config.role === 'main-agent') {
            if (!this.mainAgents.has(id)) {
                this.mainAgents.set(id, new Set());
            }
            this.taskQueues.set(id, {
                pending: [],
                inProgress: [],
                completed: [],
                failed: []
            });
        }
        else if (config.role === 'sub-agent' && config.mainAgentId) {
            const mainAgentSet = this.mainAgents.get(config.mainAgentId);
            if (mainAgentSet) {
                mainAgentSet.add(id);
            }
        }
        return agent;
    }
    /**
     * Unregister an agent
     */
    unregisterAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent)
            return false;
        if (agent.role === 'main-agent') {
            this.mainAgents.delete(agentId);
            this.taskQueues.delete(agentId);
        }
        else if (agent.role === 'sub-agent' && agent.mainAgentId) {
            const mainAgentSet = this.mainAgents.get(agent.mainAgentId);
            if (mainAgentSet) {
                mainAgentSet.delete(agentId);
            }
        }
        this.agents.delete(agentId);
        return true;
    }
    /**
     * Get agent by ID
     */
    getAgent(agentId) {
        return this.agents.get(agentId);
    }
    /**
     * List all connected agents
     */
    listAgents(role) {
        const agents = Array.from(this.agents.values());
        if (role) {
            return agents.filter(a => a.role === role);
        }
        return agents;
    }
    /**
     * Get sub-agents under a main agent
     */
    getSubAgents(mainAgentId) {
        const subAgentIds = this.mainAgents.get(mainAgentId);
        if (!subAgentIds)
            return [];
        return Array.from(subAgentIds)
            .map(id => this.agents.get(id))
            .filter((a) => a !== undefined);
    }
    /**
     * Main agent assigns task to sub-agent
     */
    assignTask(config) {
        const mainAgent = this.agents.get(config.mainAgentId);
        if (!mainAgent || mainAgent.role !== 'main-agent') {
            return null;
        }
        let subAgentId = config.subAgentId;
        if (!subAgentId) {
            const subAgents = this.getSubAgents(config.mainAgentId);
            if (subAgents.length === 0)
                return null;
            const availableSubAgents = subAgents.filter(sa => {
                const queue = this.taskQueues.get(config.mainAgentId);
                if (!queue)
                    return true;
                return !queue.inProgress.some((t) => t.subAgentId === sa.id);
            });
            if (availableSubAgents.length > 0) {
                subAgentId = availableSubAgents[0].id;
            }
            else {
                subAgentId = subAgents[0].id;
            }
        }
        const task = {
            id: (0, uuid_1.v4)(),
            mainAgentId: config.mainAgentId,
            subAgentId: subAgentId,
            title: config.title,
            description: config.description,
            status: 'pending',
            priority: config.priority || 'medium',
            createdAt: new Date()
        };
        const queue = this.taskQueues.get(config.mainAgentId);
        if (queue) {
            queue.pending.push(task);
        }
        this.notifyWaitingSubAgent(subAgentId);
        return task;
    }
    /**
     * Sub-agent waits for task (WaitTask request)
     */
    waitForTask(subAgentId, callback) {
        const agent = this.agents.get(subAgentId);
        if (!agent || agent.role !== 'sub-agent' || !agent.mainAgentId) {
            return;
        }
        const queue = this.taskQueues.get(agent.mainAgentId);
        if (queue && queue.pending.length > 0) {
            const taskIndex = queue.pending.findIndex((t) => t.subAgentId === subAgentId);
            if (taskIndex !== -1) {
                const task = queue.pending[taskIndex];
                task.status = 'assigned';
                task.assignedAt = new Date();
                queue.pending.splice(taskIndex, 1);
                queue.inProgress.push(task);
                callback(task);
                return;
            }
        }
        if (!this.waitingSubAgents.has(subAgentId)) {
            this.waitingSubAgents.set(subAgentId, []);
        }
        this.taskCallbacks.set(subAgentId, callback);
    }
    /**
     * Notify a waiting sub-agent of a new task
     */
    notifyWaitingSubAgent(subAgentId) {
        const callback = this.taskCallbacks.get(subAgentId);
        const agent = this.agents.get(subAgentId);
        if (!callback || !agent || !agent.mainAgentId)
            return;
        const queue = this.taskQueues.get(agent.mainAgentId);
        if (!queue)
            return;
        const taskIndex = queue.pending.findIndex((t) => t.subAgentId === subAgentId);
        if (taskIndex === -1)
            return;
        const task = queue.pending[taskIndex];
        task.status = 'assigned';
        task.assignedAt = new Date();
        queue.pending.splice(taskIndex, 1);
        queue.inProgress.push(task);
        this.taskCallbacks.delete(subAgentId);
        callback(task);
    }
    /**
     * Sub-agent completes task and delivers result
     */
    deliverTask(config) {
        const agent = this.agents.get(config.subAgentId);
        if (!agent || agent.role !== 'sub-agent' || !agent.mainAgentId) {
            return { success: false, error: 'Invalid sub-agent' };
        }
        const queue = this.taskQueues.get(agent.mainAgentId);
        if (!queue) {
            return { success: false, error: 'Main agent queue not found' };
        }
        const taskIndex = queue.inProgress.findIndex((t) => t.id === config.taskId);
        if (taskIndex === -1) {
            return { success: false, error: 'Task not found or not in progress' };
        }
        const task = queue.inProgress[taskIndex];
        task.status = 'completed';
        task.completedAt = new Date();
        task.result = config.result;
        task.deliverables = config.deliverables;
        queue.inProgress.splice(taskIndex, 1);
        queue.completed.push(task);
        return { success: true, task };
    }
    /**
     * Sub-agent reports task failure
     */
    failTask(config) {
        const agent = this.agents.get(config.subAgentId);
        if (!agent || agent.role !== 'sub-agent' || !agent.mainAgentId) {
            return { success: false, error: 'Invalid sub-agent' };
        }
        const queue = this.taskQueues.get(agent.mainAgentId);
        if (!queue) {
            return { success: false, error: 'Main agent queue not found' };
        }
        const taskIndex = queue.inProgress.findIndex((t) => t.id === config.taskId);
        if (taskIndex === -1) {
            return { success: false, error: 'Task not found or not in progress' };
        }
        const task = queue.inProgress[taskIndex];
        task.status = 'failed';
        task.completedAt = new Date();
        task.error = config.error;
        queue.inProgress.splice(taskIndex, 1);
        queue.failed.push(task);
        return { success: true, task };
    }
    /**
     * Get task queue for a main agent
     */
    getMCPServerTaskQueue(mainAgentId) {
        return this.taskQueues.get(mainAgentId);
    }
    /**
     * Get task by ID
     */
    getTask(mainAgentId, taskId) {
        const queue = this.taskQueues.get(mainAgentId);
        if (!queue)
            return undefined;
        return [
            ...queue.pending,
            ...queue.inProgress,
            ...queue.completed,
            ...queue.failed
        ].find((t) => t.id === taskId);
    }
    /**
     * Update agent heartbeat
     */
    heartbeat(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent)
            return false;
        agent.lastActive = new Date();
        return true;
    }
    /**
     * Get server stats
     */
    getStats() {
        const mainAgents = this.listAgents('main-agent').length;
        const subAgents = this.listAgents('sub-agent').length;
        let totalTasks = 0;
        let pendingTasks = 0;
        let inProgressTasks = 0;
        let completedTasks = 0;
        let failedTasks = 0;
        for (const queue of this.taskQueues.values()) {
            pendingTasks += queue.pending.length;
            inProgressTasks += queue.inProgress.length;
            completedTasks += queue.completed.length;
            failedTasks += queue.failed.length;
            totalTasks += queue.pending.length + queue.inProgress.length + queue.completed.length + queue.failed.length;
        }
        return {
            connectedAgents: mainAgents + subAgents,
            mainAgents,
            subAgents,
            totalTasks,
            pendingTasks,
            inProgressTasks,
            completedTasks,
            failedTasks
        };
    }
}
exports.OxygenMCPServer = OxygenMCPServer;
function createMCPServer() {
    return new OxygenMCPServer();
}
//# sourceMappingURL=server.js.map
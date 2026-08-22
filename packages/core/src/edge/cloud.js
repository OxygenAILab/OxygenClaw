"use strict";
/**
 * Edge-Cloud Collaboration Manager
 * Implements three-tier data security strategy (S1/S2/S3)
 * Integrated from: EdgeClaw architecture
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EdgeCloudManager = void 0;
exports.createEdgeCloudManager = createEdgeCloudManager;
const DEFAULT_POLICY = {
    localProcessing: ['S1', 'S2'],
    cloudProcessing: ['S3'],
    fallbackBehavior: 'local'
};
class EdgeCloudManager {
    policy;
    localAgents = new Map();
    cloudAgents = new Map();
    constructor(policy) {
        this.policy = policy || DEFAULT_POLICY;
    }
    /**
     * Determine processing location based on data sensitivity
     */
    determineProcessingLocation(sensitivity) {
        if (this.policy.localProcessing.includes(sensitivity)) {
            return 'local';
        }
        if (this.policy.cloudProcessing.includes(sensitivity)) {
            return 'cloud';
        }
        return 'local';
    }
    /**
     * Classify task data sensitivity
     */
    classifyTask(task) {
        const prompt = task.prompt.toLowerCase();
        if (prompt.includes('password') ||
            prompt.includes('secret') ||
            prompt.includes('credential') ||
            prompt.includes('api key') ||
            prompt.includes('token') ||
            prompt.includes('credit card') ||
            prompt.includes('ssn') ||
            prompt.includes('身份证') ||
            prompt.includes('银行卡') ||
            prompt.includes('隐私') ||
            prompt.includes('机密')) {
            return 'S3';
        }
        if (prompt.includes('email') ||
            prompt.includes('phone') ||
            prompt.includes('address') ||
            prompt.includes('name') ||
            prompt.includes('contact') ||
            prompt.includes('个人信息') ||
            prompt.includes('用户数据')) {
            return 'S2';
        }
        return 'S1';
    }
    /**
     * Route task to appropriate agent
     */
    routeTask(task) {
        const sensitivity = this.classifyTask(task);
        const location = this.determineProcessingLocation(sensitivity);
        let agentId;
        if (location === 'local') {
            agentId = this.getAvailableLocalAgent();
        }
        else {
            agentId = this.getAvailableCloudAgent();
        }
        return { location, sensitivity, agentId };
    }
    /**
     * Register local agent
     */
    registerLocalAgent(agentId, endpoint) {
        this.localAgents.set(agentId, endpoint);
    }
    /**
     * Register cloud agent
     */
    registerCloudAgent(agentId, endpoint) {
        this.cloudAgents.set(agentId, endpoint);
    }
    /**
     * Get available local agent
     */
    getAvailableLocalAgent() {
        return Array.from(this.localAgents.keys())[0];
    }
    /**
     * Get available cloud agent
     */
    getAvailableCloudAgent() {
        return Array.from(this.cloudAgents.keys())[0];
    }
    /**
     * Get all registered agents
     */
    listAgents() {
        return {
            local: Array.from(this.localAgents.entries()).map(([id, endpoint]) => ({ id, endpoint })),
            cloud: Array.from(this.cloudAgents.entries()).map(([id, endpoint]) => ({ id, endpoint }))
        };
    }
    /**
     * Update policy
     */
    updatePolicy(policy) {
        this.policy = policy;
    }
    /**
     * Get current policy
     */
    getPolicy() {
        return { ...this.policy };
    }
    /**
     * Check if data can be processed locally
     */
    canProcessLocally(sensitivity) {
        return this.policy.localProcessing.includes(sensitivity);
    }
    /**
     * Check if data needs cloud processing
     */
    needsCloudProcessing(sensitivity) {
        return this.policy.cloudProcessing.includes(sensitivity);
    }
}
exports.EdgeCloudManager = EdgeCloudManager;
function createEdgeCloudManager(policy) {
    return new EdgeCloudManager(policy);
}
//# sourceMappingURL=cloud.js.map
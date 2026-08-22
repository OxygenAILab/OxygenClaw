/**
 * Edge-Cloud Collaboration Manager
 * Implements three-tier data security strategy (S1/S2/S3)
 * Integrated from: EdgeClaw architecture
 */

import { DataSensitivity, EdgeCloudPolicy, AgentTask } from '../types';

const DEFAULT_POLICY: EdgeCloudPolicy = {
  localProcessing: ['S1', 'S2'],
  cloudProcessing: ['S3'],
  fallbackBehavior: 'local'
};

export class EdgeCloudManager {
  private policy: EdgeCloudPolicy;
  private localAgents: Map<string, string> = new Map();
  private cloudAgents: Map<string, string> = new Map();

  constructor(policy?: EdgeCloudPolicy) {
    this.policy = policy || DEFAULT_POLICY;
  }

  /**
   * Determine processing location based on data sensitivity
   */
  determineProcessingLocation(sensitivity: DataSensitivity): 'local' | 'cloud' {
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
  classifyTask(task: AgentTask): DataSensitivity {
    const prompt = task.prompt.toLowerCase();
    
    if (
      prompt.includes('password') ||
      prompt.includes('secret') ||
      prompt.includes('credential') ||
      prompt.includes('api key') ||
      prompt.includes('token') ||
      prompt.includes('credit card') ||
      prompt.includes('ssn') ||
      prompt.includes('身份证') ||
      prompt.includes('银行卡') ||
      prompt.includes('隐私') ||
      prompt.includes('机密')
    ) {
      return 'S3';
    }

    if (
      prompt.includes('email') ||
      prompt.includes('phone') ||
      prompt.includes('address') ||
      prompt.includes('name') ||
      prompt.includes('contact') ||
      prompt.includes('个人信息') ||
      prompt.includes('用户数据')
    ) {
      return 'S2';
    }

    return 'S1';
  }

  /**
   * Route task to appropriate agent
   */
  routeTask(task: AgentTask): {
    location: 'local' | 'cloud';
    sensitivity: DataSensitivity;
    agentId?: string;
  } {
    const sensitivity = this.classifyTask(task);
    const location = this.determineProcessingLocation(sensitivity);

    let agentId: string | undefined;
    if (location === 'local') {
      agentId = this.getAvailableLocalAgent();
    } else {
      agentId = this.getAvailableCloudAgent();
    }

    return { location, sensitivity, agentId };
  }

  /**
   * Register local agent
   */
  registerLocalAgent(agentId: string, endpoint: string): void {
    this.localAgents.set(agentId, endpoint);
  }

  /**
   * Register cloud agent
   */
  registerCloudAgent(agentId: string, endpoint: string): void {
    this.cloudAgents.set(agentId, endpoint);
  }

  /**
   * Get available local agent
   */
  getAvailableLocalAgent(): string | undefined {
    return Array.from(this.localAgents.keys())[0];
  }

  /**
   * Get available cloud agent
   */
  getAvailableCloudAgent(): string | undefined {
    return Array.from(this.cloudAgents.keys())[0];
  }

  /**
   * Get all registered agents
   */
  listAgents(): {
    local: Array<{ id: string; endpoint: string }>;
    cloud: Array<{ id: string; endpoint: string }>;
  } {
    return {
      local: Array.from(this.localAgents.entries()).map(([id, endpoint]) => ({ id, endpoint })),
      cloud: Array.from(this.cloudAgents.entries()).map(([id, endpoint]) => ({ id, endpoint }))
    };
  }

  /**
   * Update policy
   */
  updatePolicy(policy: EdgeCloudPolicy): void {
    this.policy = policy;
  }

  /**
   * Get current policy
   */
  getPolicy(): EdgeCloudPolicy {
    return { ...this.policy };
  }

  /**
   * Check if data can be processed locally
   */
  canProcessLocally(sensitivity: DataSensitivity): boolean {
    return this.policy.localProcessing.includes(sensitivity);
  }

  /**
   * Check if data needs cloud processing
   */
  needsCloudProcessing(sensitivity: DataSensitivity): boolean {
    return this.policy.cloudProcessing.includes(sensitivity);
  }
}

export function createEdgeCloudManager(policy?: EdgeCloudPolicy): EdgeCloudManager {
  return new EdgeCloudManager(policy);
}
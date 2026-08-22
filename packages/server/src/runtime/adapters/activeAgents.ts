import { OxygenAgent, ComputerUseAgent, VisionComputerUseAgent } from '@oxygen-claw/core';

export const activeAgents = new Map<string, OxygenAgent>();
export const activeComputerUseAgents = new Map<string, ComputerUseAgent | VisionComputerUseAgent>();

export function cancelAgent(taskId: string) {
  const agent = activeAgents.get(taskId);
  if (agent && typeof (agent as any).cancel === 'function') {
    (agent as any).cancel();
    return true;
  }
  return false;
}

export function stopComputerUseAgent(taskId: string) {
  const agent = activeComputerUseAgents.get(taskId);
  if (agent && typeof (agent as any).stop === 'function') {
    (agent as any).stop();
    return true;
  }
  return false;
}


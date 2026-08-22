import { RuntimeWorkerManager } from '../../services/runtimeWorkerManager';
import { containerAgentAdapter } from './containerAgent';
import { localAgentAdapter } from './localAgent';
import { localChatAdapter } from './localChat';
import { localComputerUseAdapter } from './localComputerUse';

let registered = false;

export function registerRuntimeAdapters(manager: RuntimeWorkerManager) {
  if (registered) return;
  manager.register(localAgentAdapter);
  manager.register(localChatAdapter);
  manager.register(localComputerUseAdapter);
  manager.register(containerAgentAdapter);
  registered = true;
}

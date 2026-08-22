/**
 * Container Manager
 * Isolated agent execution in Docker containers
 * Integrated from: NanoClaw architecture
 */
import { ContainerConfig } from '../types';
import type { GUIAction, GUIContext } from '../computeruse/types';
export declare class ContainerManager {
    private docker;
    private containers;
    private configs;
    private dockerAvailable;
    constructor();
    /**
     * Create and start a new agent container
     */
    createAgentContainer(config: Partial<ContainerConfig>): Promise<string>;
    /**
     * Execute command in container
     */
    execInContainer(containerId: string, command: string[]): Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
    }>;
    /**
     * Execute GUI action in container
     */
    executeGUIAction(containerId: string, action: GUIAction): Promise<boolean>;
    /**
     * Get GUI context (screenshot, accessibility tree)
     */
    getGUIContext(containerId: string): Promise<GUIContext>;
    /**
     * Stop and remove container
     */
    destroyContainer(containerId: string): Promise<void>;
    /**
     * Get container stats
     */
    getStats(containerId: string): Promise<{
        cpuUsage: number;
        memoryUsage: number;
        networkIO: number;
    }>;
    /**
     * List all active containers
     */
    listContainers(): string[];
    private ensureImage;
    private buildEnvVars;
    private buildMounts;
    private parseMemory;
    private parseCPU;
    private getDefaultLimits;
    private guiActionToCommand;
    /**
     * Cleanup all containers
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=manager.d.ts.map
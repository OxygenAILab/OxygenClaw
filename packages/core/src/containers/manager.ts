/**
 * Container Manager
 * Isolated agent execution in Docker containers
 * Integrated from: NanoClaw architecture
 */

// @ts-ignore - dockerode types not installed
import Docker from 'dockerode';
import { v4 as uuidv4 } from 'uuid';
import { ContainerConfig, ResourceLimits, MountConfig } from '../types';
import type { GUIAction, GUIContext } from '../computeruse/types';

// ============================================
// Container Manager
// ============================================
export class ContainerManager {
  private docker: typeof Docker | null = null;
  private containers: Map<string, any> = new Map();
  private configs: Map<string, ContainerConfig> = new Map();
  private dockerAvailable: boolean = false;

  constructor() {
    try {
      // @ts-ignore - dockerode types not installed
      const Docker = require('dockerode');
      const socketPath = process.platform === 'win32' 
        ? '//./pipe/docker_engine' 
        : '/var/run/docker.sock';
      this.docker = new Docker({ socketPath });
      this.dockerAvailable = true;
    } catch {
      this.dockerAvailable = false;
    }
  }

  /**
   * Create and start a new agent container
   */
  async createAgentContainer(config: Partial<ContainerConfig>): Promise<string> {
    const containerConfig: ContainerConfig = {
      id: uuidv4(),
      image: config.image || 'oxygen-claw/agent:latest',
      workingDir: config.workingDir || '/workspace',
      envVars: config.envVars || {},
      mounts: config.mounts || [],
      resourceLimits: config.resourceLimits || this.getDefaultLimits(),
      networkMode: config.networkMode || 'bridge'
    };

    try {
      // Pull image if not exists
      await this.ensureImage(containerConfig.image);

      // Create container
      const container = await this.docker.createContainer({
        Image: containerConfig.image,
        Cmd: ['sleep', 'infinity'],
        Env: this.buildEnvVars(containerConfig),
        HostConfig: {
          Binds: this.buildMounts(containerConfig.mounts || []),
          Memory: this.parseMemory(containerConfig.resourceLimits!.memory),
          CpuQuota: this.parseCPU(containerConfig.resourceLimits!.cpu),
          PidsLimit: containerConfig.resourceLimits!.pids,
          NetworkMode: containerConfig.networkMode,
          AutoRemove: true
        },
        WorkingDir: containerConfig.workingDir
      });

      // Start container
      await container.start();

      // Store references
      this.containers.set(containerConfig.id, container);
      this.configs.set(containerConfig.id, containerConfig);

      return containerConfig.id;
    } catch (error) {
      throw new Error(`Failed to create agent container: ${error}`);
    }
  }

  /**
   * Execute command in container
   */
  async execInContainer(containerId: string, command: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    try {
      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        exec.on('end', () => {
          resolve({
            stdout: Buffer.concat(chunks).toString('utf-8'),
            stderr: '',
            exitCode: 0
          });
        });

        exec.on('error', (err: any) => {
          reject(new Error(`Exec error: ${err}`));
        });

        // @ts-ignore - stream types
        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
      });
    } catch (error) {
      throw new Error(`Failed to exec in container: ${error}`);
    }
  }

  /**
   * Execute GUI action in container
   */
  async executeGUIAction(containerId: string, action: GUIAction): Promise<boolean> {
    // GUI actions require special handling
    // This is a simplified implementation
    const command = this.guiActionToCommand(action);
    if (!command) return false;

    try {
      await this.execInContainer(containerId, command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get GUI context (screenshot, accessibility tree)
   */
  async getGUIContext(containerId: string): Promise<GUIContext> {
    try {
      // Take screenshot
      const screenshotResult = await this.execInContainer(containerId, [
        'python3', '-c', `
          import pyautogui
          import base64
          from io import BytesIO
          img = pyautogui.screenshot()
          width, height = img.size
          buffered = BytesIO()
          img.save(buffered, format='PNG')
          print(f"{width}x{height}")
          print(base64.b64encode(buffered.getvalue()).decode())
        `
      ]);

      const lines = screenshotResult.stdout.trim().split('\n');
      const [widthStr, heightStr] = lines[0].split('x');
      const base64 = lines.slice(1).join('').trim();

      return {
        screenshot: {
          base64,
          scaleFactor: 1,
          width: Number(widthStr) || 0,
          height: Number(heightStr) || 0,
        },
        accessibilityTree: '',
        activeWindow: 'unknown'
      };
    } catch (error) {
      throw new Error(`Failed to get GUI context: ${error}`);
    }
  }

  /**
   * Stop and remove container
   */
  async destroyContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (container) {
      try {
        await container.stop();
        await container.remove();
      } catch {
        // Ignore cleanup errors
      }
      this.containers.delete(containerId);
      this.configs.delete(containerId);
    }
  }

  /**
   * Get container stats
   */
  async getStats(containerId: string): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    networkIO: number;
  }> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    try {
      const stats = await container.stats({ stream: false });
      // @ts-ignore - dockerode types
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      // @ts-ignore
      const systemCpuDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuUsage = systemCpuDelta > 0 ? (cpuDelta / systemCpuDelta) * 100 : 0;

      // @ts-ignore
      const memoryUsage = stats.memory_stats.usage || 0;
      // @ts-ignore
      const networkIO = stats.networks ? Object.values(stats.networks).reduce((acc: number, net: any) => acc + (net.rx_bytes + net.tx_bytes), 0) : 0;

      return { cpuUsage, memoryUsage, networkIO };
    } catch (error) {
      return { cpuUsage: 0, memoryUsage: 0, networkIO: 0 };
    }
  }

  /**
   * List all active containers
   */
  listContainers(): string[] {
    return Array.from(this.containers.keys());
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async ensureImage(image: string): Promise<void> {
    try {
      await this.docker.getImage(image).inspect();
    } catch {
      // Image not found, pull it
      await new Promise<void>((resolve, reject) => {
        // @ts-ignore - dockerode types not installed
        this.docker.pull(image, (err: any, stream: any) => {
          if (err) {
            reject(err);
            return;
          }
          stream.on('end', () => resolve());
          stream.on('error', reject);
        });
      });
    }
  }

  private buildEnvVars(config: ContainerConfig): string[] {
    const env: string[] = [];
    for (const [key, value] of Object.entries(config.envVars || {})) {
      env.push(`${key}=${value}`);
    }
    return env;
  }

  private buildMounts(mounts: MountConfig[]): string[] {
    return mounts.map(m => `${m.source}:${m.target}${m.readOnly ? ':ro' : ''}`);
  }

  private parseMemory(memory: string): number {
    // Convert memory string to bytes (e.g., '2g' -> 2147483648)
    const match = memory.match(/^(\d+)([kmg]?)$/);
    if (!match) return 2147483648; // Default 2GB

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'k': return value * 1024;
      case 'm': return value * 1024 * 1024;
      case 'g': return value * 1024 * 1024 * 1024;
      default: return value;
    }
  }

  private parseCPU(cpu: string): number {
    // Convert CPU string to quota (e.g., '1' -> 100000, '0.5' -> 50000)
    const value = parseFloat(cpu);
    return Math.floor(value * 100000);
  }

  private getDefaultLimits(): ResourceLimits {
    return {
      cpu: '1',
      memory: '2g',
      pids: 100
    };
  }

  private guiActionToCommand(action: GUIAction): string[] | null {
    const safe = (s: string) => s.replace(/"/g, '\\"');
    switch (action.type) {
      case 'click':
        if (typeof action.inputs.startX === 'number' && typeof action.inputs.startY === 'number') {
          return ['python3', '-c', `import pyautogui; pyautogui.click(${action.inputs.startX}, ${action.inputs.startY})`];
        }
        return ['python3', '-c', 'import pyautogui; pyautogui.click()'];
      case 'left_double':
        if (typeof action.inputs.startX === 'number' && typeof action.inputs.startY === 'number') {
          return ['python3', '-c', `import pyautogui; pyautogui.doubleClick(${action.inputs.startX}, ${action.inputs.startY})`];
        }
        return ['python3', '-c', 'import pyautogui; pyautogui.doubleClick()'];
      case 'type':
        if (action.inputs.content) {
          return ['python3', '-c', `import pyautogui; pyautogui.typewrite("${safe(action.inputs.content)}")`];
        }
        return null;
      case 'hotkey':
        if (action.inputs.key) {
          const keys = action.inputs.key.split('+').map(k => `"${safe(k.trim())}"`).join(', ');
          return ['python3', '-c', `import pyautogui; pyautogui.hotkey(${keys})`];
        }
        return null;
      case 'scroll':
        if (action.inputs.direction) {
          const delta = action.inputs.direction === 'up' ? 200 : -200;
          return ['python3', '-c', `import pyautogui; pyautogui.scroll(${delta})`];
        }
        return null;
      case 'screenshot':
        return ['python3', '-c', 'import pyautogui; pyautogui.screenshot("/tmp/screenshot.png")'];
      case 'wait':
        return ['sleep', '1'];
      default:
        return null;
    }
  }

  /**
   * Cleanup all containers
   */
  async cleanup(): Promise<void> {
    for (const [id] of this.containers) {
      await this.destroyContainer(id);
    }
  }
}

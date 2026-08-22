import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface ContainerEnvironmentStatus {
  available: boolean;
  reason?: string;
  image: string;
  socket: string;
}

export async function probeContainerEnvironment(): Promise<ContainerEnvironmentStatus> {
  const image = process.env.RUNTIME_CONTAINER_IMAGE || 'oxygen-claw/agent:latest';
  const socket = process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock';

  try {
    const { stdout } = await execFileAsync('docker', ['info', '--format', '{{json .ServerVersion}}'], { timeout: 5000 });
    const version = stdout.trim().replace(/^"|"$/g, '');
    return {
      available: true,
      image,
      socket,
      reason: `Docker reachable${version ? `; server ${version}` : ''}`,
    };
  } catch (error: any) {
    return {
      available: false,
      image,
      socket,
      reason: error?.message || 'Docker is not available',
    };
  }
}

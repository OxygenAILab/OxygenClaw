import { Router, Request } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const execAsync = promisify(exec);

const CLI_TIMEOUT = 60000;
const CLI_COMMAND = 'openclawmp';
const ALLOWED_COMMANDS = [
  'install',
  'uninstall',
  'list',
  'ls',
  'update',
  'upgrade',
  'search',
  'info',
  'show',
  'help',
  '--version',
  '-v',
  'version'
];

function isWindows(): boolean {
  return process.platform === 'win32';
}

function buildCommand(command: string, args: string[]): string {
  const cmd = `${CLI_COMMAND} ${command} ${args.join(' ')}`.trim();
  if (isWindows()) {
    return `cmd.exe /c ${cmd}`;
  }
  return cmd;
}

function validateCommand(command: string, args: string[]): { valid: boolean; error?: string } {
  if (!command) {
    return { valid: false, error: 'Command is required' };
  }

  if (!ALLOWED_COMMANDS.includes(command)) {
    return { valid: false, error: `Command '${command}' is not allowed` };
  }

  for (const arg of args) {
    if (typeof arg !== 'string' || arg.length > 200) {
      return { valid: false, error: 'Arguments must be strings shorter than 200 characters' };
    }
    if (!/^[\w@./:\-+=,\s]+$/.test(arg)) {
      return { valid: false, error: `Invalid character in argument: ${arg}` };
    }
  }

  return { valid: true };
}

async function executeCliCommand(command: string, args: string[] = []): Promise<{ output: string; exitCode: number }> {
  const fullCommand = buildCommand(command, args);
  
  try {
    const { stdout, stderr } = await execAsync(fullCommand, {
      timeout: CLI_TIMEOUT,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8'
    });
    return {
      output: stdout + stderr,
      exitCode: 0
    };
  } catch (error: any) {
    if (error.killed) {
      return {
        output: error.stdout + error.stderr + '\nError: Command timed out after 60 seconds',
        exitCode: -1
      };
    }
    return {
      output: (error.stdout || '') + (error.stderr || ''),
      exitCode: error.code || 1
    };
  }
}

function parseSkillsList(output: string): Array<{ name: string; version?: string; description?: string }> {
  const skills: Array<{ name: string; version?: string; description?: string }> = [];
  const lines = output.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('─') || trimmed.startsWith('┌') || 
        trimmed.startsWith('└') || trimmed.startsWith('├') || trimmed.startsWith('│') ||
        trimmed.toLowerCase().includes('name') || trimmed.toLowerCase().includes('skill')) {
      continue;
    }

    const parts = trimmed.split(/\s{2,}|\t+/).filter(Boolean);
    if (parts.length >= 1) {
      const name = parts[0].trim();
      if (name && !name.startsWith('@') && name.length < 100) {
        skills.push({
          name,
          version: parts[1]?.trim(),
          description: parts.slice(2).join(' ').trim() || undefined
        });
      }
    }
  }

  return skills;
}

router.get('/check', async (_req: Request, res) => {
  try {
    const result = await executeCliCommand('--version');
    
    if (result.exitCode === 0) {
      const version = result.output.trim().match(/[\d]+\.[\d]+\.[\d]+/)?.[0] || result.output.trim();
      res.json({
        success: true,
        data: {
          installed: true,
          version
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          installed: false,
          error: result.output || 'openclawmp not found'
        }
      });
    }
  } catch (error: any) {
    res.json({
      success: true,
      data: {
        installed: false,
        error: error.message || 'Failed to check CLI installation'
      }
    });
  }
});

router.post('/install', authMiddleware, async (_req: Request, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const send = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const installCmd = isWindows() 
      ? 'cmd.exe /c npm install -g openclawmp'
      : 'npm install -g openclawmp';

    send({ type: 'stdout', content: `Running ${installCmd}` });

    const { stdout, stderr } = await execAsync(installCmd, {
      timeout: CLI_TIMEOUT,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8'
    });

    const output = stdout + stderr;
    const checkResult = await executeCliCommand('--version');
    const installed = checkResult.exitCode === 0;

    if (stdout) send({ type: 'stdout', content: stdout });
    if (stderr) send({ type: 'stderr', content: stderr });
    send({
      type: 'done',
      success: true,
      data: {
        output,
        installed
      }
    });
    res.end();
  } catch (error: any) {
    const output = (error.stdout || '') + (error.stderr || '');

    if (error.stdout) send({ type: 'stdout', content: error.stdout });
    if (error.stderr) send({ type: 'stderr', content: error.stderr });
    send({
      type: 'done',
      success: false,
      error: error.message || 'Installation failed',
      data: {
        output,
        installed: false
      }
    });
    res.end();
  }
});

router.post('/exec', authMiddleware, async (req: Request, res) => {
  try {
    const { command, args = [] } = req.body;

    const validation = validateCommand(command, args);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const result = await executeCliCommand(command, args);

    res.json({
      success: result.exitCode === 0,
      data: {
        command: [command, ...args].join(' '),
        stdout: result.exitCode === 0 ? result.output : '',
        stderr: result.exitCode === 0 ? '' : result.output,
        output: result.output,
        exitCode: result.exitCode
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Command execution failed'
    });
  }
});

router.get('/skills', async (_req: Request, res) => {
  try {
    const result = await executeCliCommand('list');

    if (result.exitCode !== 0) {
      return res.json({
        success: false,
        error: result.output || 'Failed to list skills'
      });
    }

    const skills = parseSkillsList(result.output);

    res.json({
      success: true,
      data: {
        skills,
        count: skills.length,
        rawOutput: result.output
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list skills'
    });
  }
});

export default router;

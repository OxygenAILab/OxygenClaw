/**
 * MCP Command
 * Manage MCP servers
 */

import chalk from 'chalk';
import ora from 'ora';
import { MCPClientManager } from '@oxygen-claw/core';
import { MCPServerConfig } from '@oxygen-claw/core';

let manager: MCPClientManager;

export async function mcpCommand(options: {
  list?: boolean;
  add?: string;
  remove?: string;
  connect?: string;
  disconnect?: string;
  tools?: string;
}): Promise<void> {
  manager = new MCPClientManager();

  if (options.list) {
    await listServers();
    return;
  }

  if (options.add) {
    await addServer(options.add);
    return;
  }

  if (options.remove) {
    await removeServer(options.remove);
    return;
  }

  if (options.connect) {
    await connectServer(options.connect);
    return;
  }

  if (options.disconnect) {
    await disconnectServer(options.disconnect);
    return;
  }

  if (options.tools) {
    await listTools(options.tools);
    return;
  }

  // Show help
  console.log(chalk.cyan('\n🔌 MCP Management\n'));
  console.log(chalk.white('Commands:'));
  console.log('  --list           List all registered servers');
  console.log('  --add <json>     Add server from JSON config');
  console.log('  --remove <id>    Remove server');
  console.log('  --connect <id>   Connect to server');
  console.log('  --disconnect <id> Disconnect from server');
  console.log('  --tools <id>     List tools from server');
}

async function listServers(): Promise<void> {
  const servers = manager.listServers();
  
  console.log(chalk.cyan('\n📡 Registered MCP Servers:\n'));
  
  if (servers.length === 0) {
    console.log(chalk.gray('No servers registered.'));
    console.log(chalk.gray('Add one with: oxygen-claw mcp --add \'{"id":"fs","transport":"stdio","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/path"]}\''));
    return;
  }

  for (const id of servers) {
    const client = manager.getClient(id);
    const status = client?.isConnected() ? chalk.green('● Connected') : chalk.red('○ Disconnected');
    console.log(`  ${status} ${chalk.white(id)}`);
  }
  console.log();
}

async function addServer(configJson: string): Promise<void> {
  try {
    const config: MCPServerConfig = JSON.parse(configJson);
    await manager.register(config);
    console.log(chalk.green(`\n✅ Server "${config.id}" registered!`));
    console.log(chalk.gray(`Transport: ${config.transport}`));
    if (config.transport === 'stdio') {
      console.log(chalk.gray(`Command: ${config.command} ${config.args?.join(' ')}`));
    } else if (config.transport === 'streamable-http') {
      console.log(chalk.gray(`URL: ${config.url}`));
    }
  } catch (error) {
    console.log(chalk.red(`\n❌ Failed to add server: ${error}`));
  }
}

async function removeServer(id: string): Promise<void> {
  await manager.removeServer(id);
  console.log(chalk.green(`\n✅ Server "${id}" removed.`));
}

async function connectServer(id: string): Promise<void> {
  const spinner = ora(`Connecting to ${id}...`).start();
  try {
    await manager.connect(id);
    spinner.succeed(chalk.green(`Connected to ${id}`));
  } catch (error) {
    spinner.fail(chalk.red(`Failed to connect to ${id}: ${error}`));
  }
}

async function disconnectServer(id: string): Promise<void> {
  await manager.disconnect(id);
  console.log(chalk.green(`\n✅ Disconnected from ${id}.`));
}

async function listTools(serverId: string): Promise<void> {
  const client = manager.getClient(serverId);
  if (!client) {
    console.log(chalk.red(`\n❌ Server "${serverId}" not found.`));
    return;
  }

  try {
    const tools = await client.listTools();
    console.log(chalk.cyan(`\n🔧 Tools from "${serverId}":\n`));
    
    for (const tool of tools) {
      console.log(chalk.white(`  ${tool.name}`));
      console.log(chalk.gray(`    ${tool.description}`));
      console.log(chalk.gray(`    Input: ${JSON.stringify(tool.inputSchema).slice(0, 100)}...`));
      console.log();
    }
  } catch (error) {
    console.log(chalk.red(`\n❌ Failed to list tools: ${error}`));
  }
}

/**
 * MCP Client Implementation
 * Supports stdio, streamable-http, and SSE transports
 * Based on: @modelcontextprotocol/sdk
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { MCPTool, MCPResource, MCPServerConfig, MCPClient } from '../types';

// ============================================
// MCP Client Wrapper
// ============================================
export class OxygenMCPClient implements MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport | null = null;
  private config: MCPServerConfig;
  private connected = false;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      if (this.config.transport === 'stdio' && this.config.command) {
        this.transport = new StdioClientTransport({
          command: this.config.command,
          args: this.config.args || [],
          env: { ...process.env, ...this.config.env } as Record<string, string>
        });
      } else if (this.config.transport === 'streamable-http' && this.config.url) {
        this.transport = new StreamableHTTPClientTransport(new URL(this.config.url), {
          headers: this.config.headers || {}
        } as any);
      } else if (this.config.transport === 'sse' && this.config.url) {
        this.transport = new SSEClientTransport(new URL(this.config.url), {
          headers: this.config.headers || {}
        } as any);
      } else {
        throw new Error(`Invalid MCP config: missing transport details for ${this.config.transport}`);
      }

      this.client = new Client(
        {
          name: 'oxygen-claw',
          version: '1.0.0'
        },
        {
          capabilities: {
            roots: { listChanged: true },
            sampling: {}
          }
        }
      );

      await this.client.connect(this.transport);
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to MCP server: ${error}`);
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.connected = false;
    }
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.client || !this.connected) {
      throw new Error('MCP client not connected');
    }

    try {
      // @ts-ignore
      const response = await (this.client as any).listTools({}, {} as any);
      // @ts-ignore
      return response.tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema as Record<string, unknown>
      }));
    } catch (error) {
      throw new Error(`Failed to list MCP tools: ${error}`);
    }
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client || !this.connected) {
      throw new Error('MCP client not connected');
    }

    try {
      const result = await (this.client as any).callTool(
        { name, arguments: args },
        {} as any
      );
      return result.content;
    } catch (error) {
      throw new Error(`Failed to call MCP tool ${name}: ${error}`);
    }
  }

  /**
   * List available resources
   */
  async listResources(): Promise<MCPResource[]> {
    if (!this.client || !this.connected) {
      throw new Error('MCP client not connected');
    }

    try {
      const response = await this.client.listResources({}, {});
      return response.resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      }));
    } catch (error) {
      throw new Error(`Failed to list MCP resources: ${error}`);
    }
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<string> {
    if (!this.client || !this.connected) {
      throw new Error('MCP client not connected');
    }

    try {
      const result = await this.client.readResource({ uri }, {});
      // @ts-ignore
      return result.contents.map((c: any) => c.text || '').join('\n');
    } catch (error) {
      throw new Error(`Failed to read MCP resource ${uri}: ${error}`);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get server config
   */
  getConfig(): MCPServerConfig {
    return this.config;
  }

  /**
   * Call multiple tools in sequence
   */
  async batchCallTools(tools: Array<{ name: string; args: Record<string, unknown> }>): Promise<unknown[]> {
    if (!this.client || !this.connected) {
      throw new Error('MCP client not connected');
    }

    const results: unknown[] = [];
    for (const { name, args } of tools) {
      const result = await this.callTool(name, args);
      results.push(result);
    }
    return results;
  }

  /**
   * Search tools by keyword
   */
  async searchTools(keyword: string): Promise<MCPTool[]> {
    const tools = await this.listTools();
    const lowerKeyword = keyword.toLowerCase();
    return tools.filter(tool =>
      tool.name.toLowerCase().includes(lowerKeyword) ||
      tool.description.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Get tool by name
   */
  async getToolByName(name: string): Promise<MCPTool | undefined> {
    const tools = await this.listTools();
    return tools.find(tool => tool.name === name);
  }

  /**
   * Check if tool exists
   */
  async hasTool(name: string): Promise<boolean> {
    const tool = await this.getToolByName(name);
    return tool !== undefined;
  }
}

// ============================================
// MCP Client Manager
// ============================================
export class MCPClientManager {
  private clients: Map<string, OxygenMCPClient> = new Map();

  /**
   * Register a new MCP server
   */
  async register(config: MCPServerConfig): Promise<OxygenMCPClient> {
    if (this.clients.has(config.id)) {
      return this.clients.get(config.id)!;
    }

    const client = new OxygenMCPClient(config);
    this.clients.set(config.id, client);
    return client;
  }

  /**
   * Register multiple servers
   */
  async registerBatch(configs: MCPServerConfig[]): Promise<OxygenMCPClient[]> {
    const clients: OxygenMCPClient[] = [];
    for (const config of configs) {
      const client = await this.register(config);
      clients.push(client);
    }
    return clients;
  }

  /**
   * Connect to a registered server
   */
  async connect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`MCP server ${serverId} not registered`);
    }
    await client.connect();
  }

  /**
   * Connect to all servers
   */
  async connectAll(): Promise<void> {
    for (const serverId of this.clients.keys()) {
      try {
        await this.connect(serverId);
      } catch {
        // Continue even if one connection fails
      }
    }
  }

  /**
   * Disconnect from a server
   */
  async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.disconnect();
    }
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    for (const serverId of this.clients.keys()) {
      await this.disconnect(serverId);
    }
  }

  /**
   * Get client by ID
   */
  getClient(serverId: string): OxygenMCPClient | undefined {
    return this.clients.get(serverId);
  }

  /**
   * List all registered servers
   */
  listServers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * List connected servers
   */
  listConnectedServers(): string[] {
    return Array.from(this.clients.entries())
      .filter(([, client]) => client.isConnected())
      .map(([id]) => id);
  }

  /**
   * Remove a server
   */
  async removeServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.disconnect();
      this.clients.delete(serverId);
    }
  }

  /**
   * Remove all servers
   */
  async removeAll(): Promise<void> {
    await this.disconnectAll();
    this.clients.clear();
  }

  /**
   * Get all tools from all connected servers
   */
  async getAllTools(): Promise<Map<string, MCPTool[]>> {
    const toolsMap = new Map<string, MCPTool[]>();
    for (const [serverId, client] of this.clients.entries()) {
      if (client.isConnected()) {
        try {
          const tools = await client.listTools();
          toolsMap.set(serverId, tools);
        } catch {
          // Skip if tools can't be fetched
        }
      }
    }
    return toolsMap;
  }

  /**
   * Find tool across all servers
   */
  async findTool(toolName: string): Promise<{ serverId: string; tool: MCPTool } | null> {
    for (const [serverId, client] of this.clients.entries()) {
      if (client.isConnected()) {
        try {
          const tool = await client.getToolByName(toolName);
          if (tool) {
            return { serverId, tool };
          }
        } catch {
          // Continue searching
        }
      }
    }
    return null;
  }

  /**
   * Call tool on any server that has it
   */
  async callToolAnywhere(toolName: string, args: Record<string, unknown>): Promise<{
    success: boolean;
    result?: unknown;
    serverId?: string;
    error?: string;
  }> {
    const found = await this.findTool(toolName);
    if (!found) {
      return { success: false, error: `Tool "${toolName}" not found on any connected server` };
    }

    try {
      const client = this.clients.get(found.serverId);
      if (!client) {
        return { success: false, error: `Server "${found.serverId}" not found` };
      }
      const result = await client.callTool(toolName, args);
      return { success: true, result, serverId: found.serverId };
    } catch (error) {
      return { success: false, error: String(error), serverId: found.serverId };
    }
  }

  /**
   * Get status of all servers
   */
  getServerStatuses(): Array<{
    id: string;
    name: string;
    transport: string;
    connected: boolean;
    url?: string;
  }> {
    return Array.from(this.clients.entries()).map(([id, client]) => {
      const config = client.getConfig();
      return {
        id,
        name: config.name,
        transport: config.transport,
        connected: client.isConnected(),
        url: config.url
      };
    });
  }
}

// ============================================
// MCP Tool Wrapper for Agent Use
// ============================================
export class MCPToolWrapper {
  private client: OxygenMCPClient;
  private cachedTools: MCPTool[] = [];
  private executionHistory: Array<{
    toolName: string;
    args: Record<string, unknown>;
    success: boolean;
    result?: unknown;
    error?: string;
    timestamp: Date;
  }> = [];

  constructor(client: OxygenMCPClient) {
    this.client = client;
  }

  /**
   * Refresh tool cache
   */
  async refreshTools(): Promise<MCPTool[]> {
    this.cachedTools = await this.client.listTools();
    return this.cachedTools;
  }

  /**
   * Execute tool with error handling
   */
  async execute(toolName: string, args: Record<string, unknown>): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
  }> {
    const startTime = new Date();
    try {
      const result = await this.client.callTool(toolName, args);
      this.executionHistory.push({
        toolName,
        args,
        success: true,
        result,
        timestamp: startTime
      });
      return { success: true, result };
    } catch (error) {
      this.executionHistory.push({
        toolName,
        args,
        success: false,
        error: String(error),
        timestamp: startTime
      });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute multiple tools in sequence
   */
  async executeBatch(tools: Array<{ name: string; args: Record<string, unknown> }>): Promise<Array<{
    success: boolean;
    result?: unknown;
    error?: string;
  }>> {
    const results: Array<{
      success: boolean;
      result?: unknown;
      error?: string;
    }> = [];

    for (const tool of tools) {
      const result = await this.execute(tool.name, tool.args);
      results.push(result);
      
      if (!result.success && tool.name !== tools[tools.length - 1].name) {
        results.push({ success: false, error: 'Aborted due to previous failure' });
        break;
      }
    }

    return results;
  }

  /**
   * Get all tools
   */
  getTools(): MCPTool[] {
    return this.cachedTools;
  }

  /**
   * Get tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.cachedTools.find(t => t.name === name);
  }

  /**
   * Search tools by keyword
   */
  searchTools(keyword: string): MCPTool[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.cachedTools.filter(tool =>
      tool.name.toLowerCase().includes(lowerKeyword) ||
      tool.description.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Check if tool is available
   */
  hasTool(name: string): boolean {
    return this.cachedTools.some(t => t.name === name);
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit = 20): typeof this.executionHistory {
    return [...this.executionHistory].slice(-limit);
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Get tool statistics
   */
  getStatistics(): {
    totalExecutions: number;
    successRate: number;
    mostUsedTools: Array<{ name: string; count: number }>;
  } {
    const total = this.executionHistory.length;
    const successCount = this.executionHistory.filter(e => e.success).length;
    
    const toolCounts = this.executionHistory.reduce((acc, e) => {
      acc[e.toolName] = (acc[e.toolName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostUsed = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      totalExecutions: total,
      successRate: total > 0 ? successCount / total : 0,
      mostUsedTools: mostUsed
    };
  }
}

/**
 * MCP Client Implementation
 * Supports stdio, streamable-http, and SSE transports
 * Based on: @modelcontextprotocol/sdk
 */
import { MCPTool, MCPResource, MCPServerConfig, MCPClient } from '../types';
export declare class OxygenMCPClient implements MCPClient {
    private client;
    private transport;
    private config;
    private connected;
    constructor(config: MCPServerConfig);
    /**
     * Connect to MCP server
     */
    connect(): Promise<void>;
    /**
     * Disconnect from MCP server
     */
    disconnect(): Promise<void>;
    /**
     * List available tools
     */
    listTools(): Promise<MCPTool[]>;
    /**
     * Call a tool
     */
    callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
    /**
     * List available resources
     */
    listResources(): Promise<MCPResource[]>;
    /**
     * Read a resource
     */
    readResource(uri: string): Promise<string>;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Get server config
     */
    getConfig(): MCPServerConfig;
    /**
     * Call multiple tools in sequence
     */
    batchCallTools(tools: Array<{
        name: string;
        args: Record<string, unknown>;
    }>): Promise<unknown[]>;
    /**
     * Search tools by keyword
     */
    searchTools(keyword: string): Promise<MCPTool[]>;
    /**
     * Get tool by name
     */
    getToolByName(name: string): Promise<MCPTool | undefined>;
    /**
     * Check if tool exists
     */
    hasTool(name: string): Promise<boolean>;
}
export declare class MCPClientManager {
    private clients;
    /**
     * Register a new MCP server
     */
    register(config: MCPServerConfig): Promise<OxygenMCPClient>;
    /**
     * Register multiple servers
     */
    registerBatch(configs: MCPServerConfig[]): Promise<OxygenMCPClient[]>;
    /**
     * Connect to a registered server
     */
    connect(serverId: string): Promise<void>;
    /**
     * Connect to all servers
     */
    connectAll(): Promise<void>;
    /**
     * Disconnect from a server
     */
    disconnect(serverId: string): Promise<void>;
    /**
     * Disconnect from all servers
     */
    disconnectAll(): Promise<void>;
    /**
     * Get client by ID
     */
    getClient(serverId: string): OxygenMCPClient | undefined;
    /**
     * List all registered servers
     */
    listServers(): string[];
    /**
     * List connected servers
     */
    listConnectedServers(): string[];
    /**
     * Remove a server
     */
    removeServer(serverId: string): Promise<void>;
    /**
     * Remove all servers
     */
    removeAll(): Promise<void>;
    /**
     * Get all tools from all connected servers
     */
    getAllTools(): Promise<Map<string, MCPTool[]>>;
    /**
     * Find tool across all servers
     */
    findTool(toolName: string): Promise<{
        serverId: string;
        tool: MCPTool;
    } | null>;
    /**
     * Call tool on any server that has it
     */
    callToolAnywhere(toolName: string, args: Record<string, unknown>): Promise<{
        success: boolean;
        result?: unknown;
        serverId?: string;
        error?: string;
    }>;
    /**
     * Get status of all servers
     */
    getServerStatuses(): Array<{
        id: string;
        name: string;
        transport: string;
        connected: boolean;
        url?: string;
    }>;
}
export declare class MCPToolWrapper {
    private client;
    private cachedTools;
    private executionHistory;
    constructor(client: OxygenMCPClient);
    /**
     * Refresh tool cache
     */
    refreshTools(): Promise<MCPTool[]>;
    /**
     * Execute tool with error handling
     */
    execute(toolName: string, args: Record<string, unknown>): Promise<{
        success: boolean;
        result?: unknown;
        error?: string;
    }>;
    /**
     * Execute multiple tools in sequence
     */
    executeBatch(tools: Array<{
        name: string;
        args: Record<string, unknown>;
    }>): Promise<Array<{
        success: boolean;
        result?: unknown;
        error?: string;
    }>>;
    /**
     * Get all tools
     */
    getTools(): MCPTool[];
    /**
     * Get tool by name
     */
    getTool(name: string): MCPTool | undefined;
    /**
     * Search tools by keyword
     */
    searchTools(keyword: string): MCPTool[];
    /**
     * Check if tool is available
     */
    hasTool(name: string): boolean;
    /**
     * Get execution history
     */
    getExecutionHistory(limit?: number): typeof this.executionHistory;
    /**
     * Clear execution history
     */
    clearHistory(): void;
    /**
     * Get tool statistics
     */
    getStatistics(): {
        totalExecutions: number;
        successRate: number;
        mostUsedTools: Array<{
            name: string;
            count: number;
        }>;
    };
}
//# sourceMappingURL=client.d.ts.map
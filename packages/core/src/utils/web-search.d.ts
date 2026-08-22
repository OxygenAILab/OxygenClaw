/**
 * OxygenClaw Web Search Utility
 * 支持多种搜索后端：Tavily API / DuckDuckGo HTML / 环境变量配置
 */
export interface WebSearchResult {
    title: string;
    url: string;
    snippet: string;
}
export interface WebSearchOptions {
    maxResults?: number;
    searchEngine?: 'auto' | 'tavily' | 'ddg';
    apiKey?: string;
    apiBase?: string;
}
/**
 * 统一的 Web 搜索入口
 */
export declare function webSearch(query: string, options?: WebSearchOptions): Promise<WebSearchResult[]>;
//# sourceMappingURL=web-search.d.ts.map
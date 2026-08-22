"use strict";
/**
 * OxygenClaw Web Search Utility
 * 支持多种搜索后端：Tavily API / DuckDuckGo HTML / 环境变量配置
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.webSearch = webSearch;
/**
 * 统一的 Web 搜索入口
 */
async function webSearch(query, options = {}) {
    const maxResults = options.maxResults || 5;
    const engine = options.searchEngine || 'auto';
    if (engine === 'tavily' || (engine === 'auto' && (options.apiKey || process.env.TAVILY_API_KEY))) {
        return searchTavily(query, { ...options, maxResults });
    }
    if (engine === 'ddg') {
        return searchDuckDuckGo(query, maxResults);
    }
    // auto 模式：先试 Tavily（有 key 的话），再回退到 DDG
    if (options.apiKey || process.env.TAVILY_API_KEY) {
        try {
            return await searchTavily(query, { ...options, maxResults });
        }
        catch {
            // 回退
        }
    }
    try {
        return await searchDuckDuckGo(query, maxResults);
    }
    catch {
        return [];
    }
}
/**
 * Tavily Search API
 */
async function searchTavily(query, options) {
    const apiKey = options.apiKey || process.env.TAVILY_API_KEY;
    const apiBase = options.apiBase || process.env.TAVILY_API_BASE || 'https://api.tavily.com';
    const maxResults = options.maxResults || 5;
    if (!apiKey) {
        throw new Error('Tavily API key not configured');
    }
    const response = await fetch(`${apiBase}/search`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: maxResults,
            search_depth: 'basic',
            include_answer: false,
            include_raw_content: false,
        }),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Tavily API error: ${response.status} - ${text}`);
    }
    const data = (await response.json());
    return (data.results || [])
        .filter(r => r.title && r.url)
        .map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.content || '',
    }));
}
/**
 * DuckDuckGo HTML 搜索（零依赖，匿名）
 * 解析 HTML 结果页抽取标题、链接、摘要
 */
async function searchDuckDuckGo(query, maxResults = 5) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 OxygenClaw/1.0',
        },
    });
    if (!response.ok) {
        throw new Error(`DuckDuckGo search error: ${response.status}`);
    }
    const html = await response.text();
    const results = [];
    // 简单解析 DDG HTML 结果页
    // 结果块包含在 <div class="result"> 中
    const resultRegex = /<div class="result[^"]*"[^>]*>[\s\S]*?<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
        try {
            const rawUrl = decodeURIComponent(match[1]);
            const title = stripHtml(match[2]).trim();
            const snippet = stripHtml(match[3]).trim();
            // DDG 的 href 可能是 /l/?uddg=... 格式，提取真实 URL
            const realUrl = extractRealUrl(rawUrl);
            if (title && realUrl) {
                results.push({ title, url: realUrl, snippet });
            }
        }
        catch {
            // 跳过解析失败的条目
        }
    }
    return results;
}
function stripHtml(html) {
    return html
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
}
function extractRealUrl(rawUrl) {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        return rawUrl;
    }
    // DDG 重定向格式：/l/?uddg=<encoded_url>&...
    const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
    if (uddgMatch) {
        try {
            return decodeURIComponent(uddgMatch[1]);
        }
        catch {
            // fall through
        }
    }
    return '';
}
//# sourceMappingURL=web-search.js.map
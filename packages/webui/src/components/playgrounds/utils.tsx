import { Zap, Brain, Sparkles, Microscope, Users } from 'lucide-react';

export const capabilityModes: {
  id: 'fast' | 'think' | 'expert' | 'research' | 'moa';
  label: string;
  icon: typeof Zap;
  color: string;
  desc: string;
}[] = [
  { id: 'fast', label: '快速', icon: Zap, color: '#34c759', desc: '极速响应，少量搜索' },
  { id: 'think', label: '思考', icon: Brain, color: '#0071e3', desc: '深度思考，多轮联网' },
  { id: 'expert', label: '专家', icon: Sparkles, color: '#af52de', desc: 'CoT 链式思考，更多联网' },
  { id: 'research', label: '研究', icon: Microscope, color: '#ff9500', desc: '交叉验证，无限搜索，交付文档' },
  { id: 'moa', label: '协作', icon: Users, color: '#ff3b30', desc: '多 Agent 协作，投票产出' },
];

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 简单的 Markdown 渲染器
export function renderMarkdown(text: string): string {
  let html = escapeHtml(text);

  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="message-code-block" data-language="${lang}"><code>${code}</code></pre>`;
  });

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code class="message-inline-code">$1</code>');

  // 加粗
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 斜体
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // 标题
  html = html.replace(/^### (.*$)/gm, '<h3 class="message-h3">$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2 class="message-h2">$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1 class="message-h1">$1</h1>');

  // 无序列表
  html = html.replace(/^- (.*$)/gm, '<li class="message-li">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="message-ul">$&</ul>');

  // 有序列表
  html = html.replace(/^\d+\. (.*$)/gm, '<li class="message-li">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => {
    if (match.includes('message-ul')) return match;
    return `<ol class="message-ol">${match}</ol>`;
  });

  // 引用
  html = html.replace(/^> (.*$)/gm, '<blockquote class="message-quote">$1</blockquote>');

  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="message-link">$1</a>');

  // 换行
  html = html.replace(/\n/g, '<br/>');

  return html;
}

export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}天前`;

  const date = new Date(timestamp);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

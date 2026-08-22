import React, { useEffect, useRef, useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import mermaid from 'mermaid';
import { Check, Copy } from 'lucide-react';
import 'highlight.js/styles/github.css';

let mermaidInitialized = false;
function ensureMermaid() {
  if (mermaidInitialized) return;
  mermaidInitialized = true;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'neutral',
    fontFamily: 'inherit',
  });
}

const MermaidDiagram: React.FC<{ code: string }> = ({ code }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mmd-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;
    ensureMermaid();
    mermaid
      .render(idRef.current, code)
      .then(({ svg }) => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Diagram error');
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <pre className="message-code-block" data-language="mermaid">
        <code>{code}</code>
      </pre>
    );
  }
  return <div className="mermaid-diagram my-3 flex justify-center overflow-x-auto" ref={ref} />;
};

/** Recursively extract raw text from a hast node (for copy + mermaid source). */
function nodeToText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (Array.isArray(node.children)) return node.children.map(nodeToText).join('');
  return '';
}

interface CodeBlockProps {
  language: string;
  rawText: string;
  children: React.ReactNode;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, rawText, children }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="md-codeblock group/code relative my-3 rounded-xl overflow-hidden border border-outline-variant">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-container-high text-xs text-on-surface-variant">
        <span className="font-mono uppercase tracking-wide">{language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-surface-container-highest transition-colors"
          title={copied ? '已复制' : '复制'}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <pre className="!m-0 !rounded-none overflow-x-auto">{children}</pre>
    </div>
  );
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  return (
    <div className={`md-content ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Unwrap default <pre>; our CodeBlock/MermaidDiagram provide their own container.
          pre({ children }) {
            return <>{children}</>;
          },
          code({ node, className: cls, children, ...props }) {
            const match = /language-(\w+)/.exec(cls || '');
            const rawText = nodeToText(node).replace(/\n$/, '');
            const isBlock = Boolean(match) || rawText.includes('\n');

            if (isBlock && match?.[1] === 'mermaid') {
              return <MermaidDiagram code={rawText} />;
            }
            if (isBlock) {
              return (
                <CodeBlock language={match?.[1] || ''} rawText={rawText}>
                  <code className={cls ? `hljs ${cls}` : 'hljs'} {...props}>
                    {children}
                  </code>
                </CodeBlock>
              );
            }
            return (
              <code className="md-inline-code" {...props}>
                {children}
              </code>
            );
          },
          a({ children, ...props }) {
            return (
              <a target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default memo(MarkdownRenderer);

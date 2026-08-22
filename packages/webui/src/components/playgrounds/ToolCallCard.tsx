import React, { useState } from 'react';
import { Check, ChevronDown, Loader2, AlertCircle, Wrench } from 'lucide-react';

export interface ToolCall {
  id?: string;
  name: string;
  status?: 'running' | 'completed' | 'failed';
  /** Short subtitle shown after the name, e.g. a file path */
  detail?: string;
  arguments?: unknown;
  result?: unknown;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const STATUS_LABEL: Record<string, string> = {
  running: '执行中',
  completed: '已完成',
  failed: '失败',
};

const ToolCallCard: React.FC<{ tool: ToolCall }> = ({ tool }) => {
  const [open, setOpen] = useState(false);
  const status = tool.status || 'completed';

  const args = stringify(tool.arguments);
  const result = stringify(tool.result);
  const hasBody = Boolean(args || result);

  const StatusIcon =
    status === 'running' ? Loader2 : status === 'failed' ? AlertCircle : Check;
  const statusColor =
    status === 'running'
      ? 'var(--md-primary)'
      : status === 'failed'
      ? 'var(--md-error)'
      : 'var(--md-success)';

  return (
    <div className="my-2 inline-flex flex-col max-w-full">
      <button
        onClick={() => hasBody && setOpen(o => !o)}
        className={`group flex items-center gap-2 px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-low text-sm text-on-surface-variant transition-colors ${
          hasBody ? 'hover:bg-surface-container cursor-pointer' : 'cursor-default'
        }`}
      >
        <Wrench size={13} className="flex-shrink-0 opacity-60" />
        <StatusIcon
          size={14}
          className={`flex-shrink-0 ${status === 'running' ? 'animate-spin' : ''}`}
          style={{ color: statusColor }}
        />
        <span className="text-on-surface-variant">{STATUS_LABEL[status]}</span>
        <span className="font-medium text-on-surface truncate">{tool.name}</span>
        {tool.detail && (
          <span className="text-xs text-on-surface-variant/70 truncate hidden sm:inline">
            · {tool.detail}
          </span>
        )}
        {hasBody && (
          <ChevronDown
            size={14}
            className={`flex-shrink-0 ml-1 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {open && hasBody && (
        <div className="mt-1.5 rounded-xl border border-outline-variant bg-surface-container-low overflow-hidden animate-slide-down">
          {args && (
            <div className="px-3 py-2.5 border-b border-outline-variant">
              <div className="text-xs font-medium text-on-surface-variant mb-1.5">请求</div>
              <pre className="text-xs font-mono text-on-surface whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                {args}
              </pre>
            </div>
          )}
          {result && (
            <div className="px-3 py-2.5">
              <div className="text-xs font-medium text-on-surface-variant mb-1.5">响应</div>
              <pre className="text-xs font-mono text-on-surface whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolCallCard;

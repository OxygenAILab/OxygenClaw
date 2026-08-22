import React from 'react';
import type { RuntimeEvent } from '../../../api/types';

interface EventTimelineProps {
  events: RuntimeEvent[];
  isStreaming?: boolean;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ events, isStreaming = false }) => {
  if (events.length === 0 && !isStreaming) {
    return (
      <div className="flex items-center justify-center py-8 text-[#5C635D]">
        暂无事件
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <EventItem key={event.id} event={event} />
      ))}

      {isStreaming && (
        <div className="flex items-center gap-2 p-3 bg-[#F2E3D6] rounded-lg border border-[#E7E1D7]">
          <div className="w-2 h-2 bg-[#C4612F] rounded-full animate-pulse"></div>
          <span className="text-sm text-[#5C635D]">事件流正在传输...</span>
        </div>
      )}
    </div>
  );
};

interface EventItemProps {
  event: RuntimeEvent;
}

const EventItem: React.FC<EventItemProps> = ({ event }) => {
  const getEventColor = (type: string) => {
    if (type.includes('error') || type.includes('failed')) return 'border-red-200 bg-red-50';
    if (type.includes('complete') || type.includes('success')) return 'border-green-200 bg-green-50';
    if (type.includes('cancelled')) return 'border-yellow-200 bg-yellow-50';
    if (type.includes('start') || type.includes('running')) return 'border-blue-200 bg-blue-50';
    return 'border-[#E7E1D7] bg-white';
  };

  return (
    <div className={`p-3 rounded-lg border ${getEventColor(event.type)}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[#1F2421]">
          [{event.seq}] {event.type}
        </span>
        <span className="text-xs text-[#5C635D]">
          {new Date(event.createdAt).toLocaleTimeString('zh-CN')}
        </span>
      </div>

      {event.payload && Object.keys(event.payload).length > 0 && (
        <div className="mt-2">
          <details className="text-xs">
            <summary className="cursor-pointer text-[#5C635D] hover:text-[#C4612F]">
              查看详情
            </summary>
            <pre className="mt-2 p-2 bg-[#FBF9F5] rounded text-[#1F2421] overflow-x-auto">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

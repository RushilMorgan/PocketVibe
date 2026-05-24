import React, { useState } from 'react';
import type { ChecklistContent } from '../../types';

interface ChecklistRendererProps {
  content: ChecklistContent;
  onChange: (updated: ChecklistContent) => void;
}

export function ChecklistRenderer({ content, onChange }: ChecklistRendererProps) {
  function toggleItem(sectionId: string, itemId: string) {
    const updated: ChecklistContent = {
      ...content,
      sections: content.sections.map(s =>
        s.id !== sectionId ? s : {
          ...s,
          items: s.items.map(i =>
            i.id !== itemId ? i : { ...i, checked: !i.checked },
          ),
        },
      ),
    };
    onChange(updated);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {content.sections.map(section => {
        const done = section.items.filter(i => i.checked).length;
        const total = section.items.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <div key={section.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="font-semibold text-gray-800 text-sm">{section.title}</h3>
              <span className="text-xs text-gray-400">{done}/{total}</span>
            </div>

            {/* Progress bar */}
            <div className="mx-4 mb-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #a855f7)' }}
              />
            </div>

            {/* Items */}
            <div className="divide-y divide-gray-50">
              {section.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleItem(section.id, item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 text-left"
                >
                  <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    item.checked
                      ? 'bg-violet-600 border-violet-600'
                      : 'border-gray-300'
                  }`}>
                    {item.checked && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm flex-1 ${item.checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {content.sections.length === 0 && (
        <div className="text-center text-gray-400 text-sm py-10">
          No items yet. Ask AI to add some!
        </div>
      )}
    </div>
  );
}

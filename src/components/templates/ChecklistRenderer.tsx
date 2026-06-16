import React, { useState } from 'react';
import type { ChecklistContent, ChecklistItem, ChecklistSection } from '../../types';
import { celebrate } from '../../lib/celebrate';

interface ChecklistRendererProps {
  content: ChecklistContent;
  onChange: (updated: ChecklistContent) => void;
}

export function ChecklistRenderer({ content, onChange }: ChecklistRendererProps) {
  const [editMode, setEditMode] = useState(false);

  function toggleItem(sectionId: string, itemId: string) {
    const updatedSections = content.sections.map(s =>
      s.id !== sectionId ? s : {
        ...s,
        items: s.items.map(i => i.id !== itemId ? i : { ...i, checked: !i.checked }),
      },
    );
    onChange({ ...content, sections: updatedSections });

    // Celebrate completions (only when ticking, never when unticking):
    // finishing a section earns a quiet burst; finishing the whole list, confetti.
    const item = content.sections.find(s => s.id === sectionId)?.items.find(i => i.id === itemId);
    if (item && !item.checked) {
      const section = updatedSections.find(s => s.id === sectionId);
      const sectionDone = !!section && section.items.length > 0 && section.items.every(i => i.checked);
      if (sectionDone) {
        const allDone = updatedSections.every(s => s.items.every(i => i.checked));
        celebrate(allDone
          ? { intensity: 'big', message: 'All done! 🎉' }
          : { intensity: 'small' });
      }
    }
  }

  function updateItemLabel(sectionId: string, itemId: string, label: string) {
    onChange({
      ...content,
      sections: content.sections.map(s =>
        s.id !== sectionId ? s : {
          ...s,
          items: s.items.map(i => i.id !== itemId ? i : { ...i, label }),
        },
      ),
    });
  }

  function deleteItem(sectionId: string, itemId: string) {
    onChange({
      ...content,
      sections: content.sections.map(s =>
        s.id !== sectionId ? s : { ...s, items: s.items.filter(i => i.id !== itemId) },
      ),
    });
  }

  function addItem(sectionId: string) {
    const id = `i-${Date.now()}`;
    const newItem: ChecklistItem = { id, label: 'New item', checked: false };
    onChange({
      ...content,
      sections: content.sections.map(s =>
        s.id !== sectionId ? s : { ...s, items: [...s.items, newItem] },
      ),
    });
  }

  function updateSectionTitle(sectionId: string, title: string) {
    onChange({
      ...content,
      sections: content.sections.map(s => s.id !== sectionId ? s : { ...s, title }),
    });
  }

  function deleteSection(sectionId: string) {
    onChange({ ...content, sections: content.sections.filter(s => s.id !== sectionId) });
  }

  function addSection() {
    const id = `s-${Date.now()}`;
    const newSection: ChecklistSection = { id, title: 'New section', items: [] };
    onChange({ ...content, sections: [...content.sections, newSection] });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Edit toggle */}
      <div className="flex justify-end">
        <button
          data-testid="edit-checklist-btn"
          onClick={() => setEditMode(e => !e)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            editMode ? 'tpl-accent-bg text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {editMode ? 'Done' : 'Edit list'}
        </button>
      </div>

      {content.sections.map(section => {
        const done = section.items.filter(i => i.checked).length;
        const total = section.items.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <div key={section.id} className="tp-card rounded-2xl overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              {editMode ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    data-testid={`section-title-${section.id}`}
                    value={section.title}
                    onChange={e => updateSectionTitle(section.id, e.target.value)}
                    className="flex-1 text-sm font-semibold border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                  <button
                    onClick={() => deleteSection(section.id)}
                    className="text-red-400 hover:text-red-600 p-1"
                    aria-label="Delete section"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-gray-800 text-sm">{section.title}</h3>
                  <span className="text-xs text-gray-400">{done}/{total}</span>
                </>
              )}
            </div>

            {/* Progress bar */}
            {!editMode && (
              <div className="mx-4 mb-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 tpl-grad-bar"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            {/* Items */}
            <div className="divide-y divide-gray-50">
              {section.items.map(item => (
                <div key={item.id} className={`px-4 py-3 ${editMode ? '' : ''}`}>
                  {editMode ? (
                    <div className="flex items-center gap-2">
                      <input
                        data-testid={`item-label-${item.id}`}
                        value={item.label}
                        onChange={e => updateItemLabel(section.id, item.id, e.target.value)}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                      <button
                        data-testid={`delete-item-${item.id}`}
                        onClick={() => deleteItem(section.id, item.id)}
                        className="text-red-400 hover:text-red-600 p-1"
                        aria-label="Delete item"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleItem(section.id, item.id)}
                      className="w-full flex items-center gap-3 active:bg-gray-50 text-left"
                    >
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          item.checked ? 'tpl-accent-bg' : 'border-gray-300'
                        }`}
                        style={item.checked ? { borderColor: 'var(--tpl-accent, #7c3aed)' } : undefined}
                      >
                        {item.checked && (
                          <svg className="animate-check-pop" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      <span className={`text-sm flex-1 ${item.checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {item.label}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {editMode && (
              <div className="px-4 pb-4 pt-2">
                <button
                  data-testid="add-item-btn"
                  onClick={() => addItem(section.id)}
                  className="w-full text-sm tpl-accent-text font-semibold border-2 border-dashed tpl-accent-border rounded-xl py-2 active:opacity-70 transition-opacity"
                >
                  + Add item
                </button>
              </div>
            )}
          </div>
        );
      })}

      {editMode && (
        <button
          data-testid="add-section-btn"
          onClick={addSection}
          className="w-full text-sm tpl-accent-text font-semibold border-2 border-dashed tpl-accent-border rounded-2xl py-3 active:opacity-70 transition-opacity"
        >
          + Add section
        </button>
      )}

      {content.sections.length === 0 && !editMode && (
        <div className="text-center text-gray-400 text-sm py-10">
          No items yet. Ask AI to add some!
        </div>
      )}
    </div>
  );
}


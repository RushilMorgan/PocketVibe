import React, { useState } from 'react';
import type { MealPlannerContent, Meal } from '../../types';

interface MealPlannerRendererProps {
  content: MealPlannerContent;
  onChange: (updated: MealPlannerContent) => void;
}

const SLOT_ORDER: Meal['slot'][] = ['breakfast', 'lunch', 'dinner', 'snack'];
const SLOT_EMOJI: Record<Meal['slot'], string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};

export function MealPlannerRenderer({ content, onChange }: MealPlannerRendererProps) {
  const [editMode, setEditMode] = useState(false);

  // Group meals by day
  const days = [...new Set(content.meals.map(m => m.day))];

  function updateMeal(id: string, patch: Partial<Meal>) {
    onChange({
      ...content,
      meals: content.meals.map(m => m.id === id ? { ...m, ...patch } : m),
    });
  }

  function addMeal(day: string, slot: Meal['slot']) {
    const id = `m-${Date.now()}`;
    onChange({ ...content, meals: [...content.meals, { id, day, slot, name: 'New meal' }] });
  }

  function deleteMeal(id: string) {
    onChange({ ...content, meals: content.meals.filter(m => m.id !== id) });
  }

  function addGroceryItem() {
    onChange({ ...content, groceryList: [...content.groceryList, ''] });
  }

  function updateGroceryItem(idx: number, value: string) {
    const updated = [...content.groceryList];
    updated[idx] = value;
    onChange({ ...content, groceryList: updated });
  }

  function deleteGroceryItem(idx: number) {
    onChange({ ...content, groceryList: content.groceryList.filter((_, i) => i !== idx) });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">{content.weekLabel}</h2>
        <button
          data-testid="edit-meals-btn"
          onClick={() => setEditMode(e => !e)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            editMode ? 'tpl-accent-bg text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {editMode ? 'Done' : 'Edit meals'}
        </button>
      </div>

      {/* Daily meal cards */}
      {days.map(day => {
        const dayMeals = content.meals.filter(m => m.day === day);
        return (
          <div key={day} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h3 className="font-semibold text-gray-700 text-sm">{day}</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {SLOT_ORDER.map(slot => {
                const slotMeals = dayMeals.filter(m => m.slot === slot);
                return (
                  <div key={slot} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="text-base leading-none pt-0.5 flex-shrink-0">{SLOT_EMOJI[slot]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-400 capitalize mb-1">{slot}</div>
                        {slotMeals.length === 0 ? (
                          editMode ? (
                            <button
                              data-testid="add-meal-btn"
                              onClick={() => addMeal(day, slot)}
                              className="text-xs tpl-accent-text font-medium"
                            >
                              + Add meal
                            </button>
                          ) : (
                            <span className="text-sm text-gray-300 italic">—</span>
                          )
                        ) : (
                          <div className="space-y-1">
                            {slotMeals.map(meal => (
                              editMode ? (
                                <div key={meal.id} className="flex items-center gap-2">
                                  <input
                                    data-testid={`meal-${meal.id}-name`}
                                    value={meal.name}
                                    onChange={e => updateMeal(meal.id, { name: e.target.value })}
                                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                                  />
                                  <button
                                    onClick={() => deleteMeal(meal.id)}
                                    className="text-red-400 hover:text-red-600 p-1"
                                    aria-label="Delete meal"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <div key={meal.id} className="text-sm text-gray-800">{meal.name}</div>
                              )
                            ))}
                            {editMode && (
                              <button
                                data-testid="add-meal-btn"
                                onClick={() => addMeal(day, slot)}
                                className="text-xs tpl-accent-text font-medium"
                              >
                                + Add another
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Grocery list */}
      {(content.groceryList.length > 0 || editMode) && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="font-semibold text-gray-700 text-sm">🛒 Grocery list</h3>
          </div>
          <div className="p-4 space-y-2">
            {content.groceryList.map((item, idx) => (
              editMode ? (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    data-testid={`grocery-${idx}-input`}
                    value={item}
                    onChange={e => updateGroceryItem(idx, e.target.value)}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="Grocery item"
                  />
                  <button
                    onClick={() => deleteGroceryItem(idx)}
                    className="text-red-400 hover:text-red-600 p-1"
                    aria-label="Delete item"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full tpl-accent-bg flex-shrink-0" />
                  <span className="text-sm text-gray-700">{item}</span>
                </div>
              )
            ))}
            {editMode && (
              <button
                onClick={addGroceryItem}
                className="w-full text-sm tpl-accent-text font-semibold border-2 border-dashed tpl-accent-border rounded-xl py-2 mt-1 active:opacity-70 transition-opacity"
              >
                + Add item
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

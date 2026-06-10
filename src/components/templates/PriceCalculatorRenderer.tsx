import React, { useState } from 'react';
import type { PriceCalculatorContent, PriceLineItem } from '../../types';

interface PriceCalculatorRendererProps {
  content: PriceCalculatorContent;
  onChange: (updated: PriceCalculatorContent) => void;
}

function calcTotals(content: PriceCalculatorContent) {
  const subtotal = content.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const taxAmount = subtotal * ((content.taxRate ?? 0) / 100);
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

function formatAmount(currency: string, amount: number): string {
  return `${currency}${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PriceCalculatorRenderer({ content, onChange }: PriceCalculatorRendererProps) {
  const [editMode, setEditMode] = useState(false);
  const { subtotal, taxAmount, total } = calcTotals(content);

  function updateItem(id: string, patch: Partial<PriceLineItem>) {
    onChange({
      ...content,
      lineItems: content.lineItems.map(li => li.id === id ? { ...li, ...patch } : li),
    });
  }

  function addItem() {
    const id = `li-${Date.now()}`;
    onChange({
      ...content,
      lineItems: [...content.lineItems, { id, label: 'New item', quantity: 1, unitPrice: 0 }],
    });
  }

  function deleteItem(id: string) {
    onChange({ ...content, lineItems: content.lineItems.filter(li => li.id !== id) });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {content.description && (
            <p className="text-xs text-gray-400 mt-0.5">{content.description}</p>
          )}
        </div>
        <button
          data-testid="edit-price-btn"
          onClick={() => setEditMode(e => !e)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            editMode
              ? 'tpl-accent-bg text-white'
              : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {editMode ? 'Done' : 'Edit prices'}
        </button>
      </div>

      {/* Currency + Tax rate (edit mode) */}
      {editMode && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4">
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">Currency symbol</label>
            <input
              data-testid="currency-input"
              value={content.currency}
              onChange={e => onChange({ ...content, currency: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
              maxLength={4}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">Tax rate (%)</label>
            <input
              data-testid="tax-rate-input"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={content.taxRate ?? 0}
              onChange={e => onChange({ ...content, taxRate: parseFloat(e.target.value) || 0 })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
        </div>
      )}

      {/* Line items */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <span>Item</span>
            <span className="text-right w-12">Qty</span>
            <span className="text-right w-20">Unit price</span>
            <span className="text-right w-20">Total</span>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {content.lineItems.map(li => {
            const rowTotal = li.quantity * li.unitPrice;
            return (
              <div key={li.id} className="px-4 py-3">
                {editMode ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        data-testid={`item-label-${li.id}`}
                        value={li.label}
                        onChange={e => updateItem(li.id, { label: e.target.value })}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
                        placeholder="Item name"
                      />
                      <button
                        data-testid={`delete-item-${li.id}`}
                        onClick={() => deleteItem(li.id)}
                        className="text-red-400 hover:text-red-600 p-1"
                        aria-label="Delete item"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400">Qty</label>
                        <input
                          data-testid={`item-qty-${li.id}`}
                          type="number"
                          min={0}
                          step={1}
                          value={li.quantity}
                          onChange={e => updateItem(li.id, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Unit price</label>
                        <input
                          data-testid={`item-price-${li.id}`}
                          type="number"
                          min={0}
                          step={0.01}
                          value={li.unitPrice}
                          onChange={e => updateItem(li.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                    </div>
                    {li.category !== undefined && (
                      <input
                        value={li.category}
                        onChange={e => updateItem(li.id, { category: e.target.value })}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-400"
                        placeholder="Category (optional)"
                      />
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{li.label}</div>
                      {li.category && <div className="text-xs text-gray-400">{li.category}</div>}
                    </div>
                    <span className="text-sm text-gray-500 text-right w-12">{li.quantity}</span>
                    <span className="text-sm text-gray-500 text-right w-20">{formatAmount(content.currency, li.unitPrice)}</span>
                    <span className="text-sm font-semibold text-gray-800 text-right w-20">{formatAmount(content.currency, rowTotal)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {editMode && (
          <div className="px-4 pb-4 pt-2">
            <button
              data-testid="add-item-btn"
              onClick={addItem}
              className="w-full text-sm tpl-accent-text font-semibold border-2 border-dashed tpl-accent-border rounded-xl py-2.5 active:opacity-70 transition-opacity"
            >
              + Add item
            </button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-50">
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Subtotal</span>
            <span className="text-sm font-semibold text-gray-800">{formatAmount(content.currency, subtotal)}</span>
          </div>
          {(content.taxRate ?? 0) > 0 && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Tax ({content.taxRate}%)</span>
              <span className="text-sm font-semibold text-gray-800">{formatAmount(content.currency, taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between px-4 py-3 tpl-accent-soft">
            <span className="text-sm font-bold tpl-accent-text">Total</span>
            <span className="text-sm font-bold tpl-accent-text">{formatAmount(content.currency, total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {(content.notes !== undefined) && (
        editMode ? (
          <textarea
            data-testid="notes-input"
            value={content.notes ?? ''}
            onChange={e => onChange({ ...content, notes: e.target.value })}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        ) : content.notes ? (
          <div className="bg-gray-50 rounded-2xl px-4 py-3">
            <p className="text-sm text-gray-500">{content.notes}</p>
          </div>
        ) : null
      )}
    </div>
  );
}

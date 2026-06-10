import React, { useState } from 'react';
import type { BudgetCalculatorContent, BudgetLine } from '../../types';

interface BudgetCalculatorRendererProps {
  content: BudgetCalculatorContent;
  onChange: (updated: BudgetCalculatorContent) => void;
}

function fmt(currency: string, amount: number): string {
  return `${currency}${new Intl.NumberFormat('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))}`;
}

export function BudgetCalculatorRenderer({ content, onChange }: BudgetCalculatorRendererProps) {
  const [editMode, setEditMode] = useState(false);

  const totalIncome = content.income.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = content.expenses.reduce((s, e) => s + e.amount, 0);
  const net = totalIncome - totalExpenses;

  // ── Edit helpers — all fire onChange immediately ──────────────────────────

  function updateCurrency(val: string) {
    onChange({ ...content, currency: val || content.currency });
  }

  function updateIncomeField(id: string, field: keyof BudgetLine, val: string) {
    onChange({
      ...content,
      income: content.income.map(i =>
        i.id !== id ? i : { ...i, [field]: field === 'amount' ? parseFloat(val) || 0 : val },
      ),
    });
  }

  function addIncome() {
    const id = `inc-${Date.now()}`;
    onChange({
      ...content,
      income: [...content.income, { id, label: 'New income', amount: 0 }],
    });
  }

  function deleteIncome(id: string) {
    onChange({ ...content, income: content.income.filter(i => i.id !== id) });
  }

  function updateExpenseField(id: string, field: keyof BudgetLine, val: string) {
    onChange({
      ...content,
      expenses: content.expenses.map(e =>
        e.id !== id ? e : { ...e, [field]: field === 'amount' ? parseFloat(val) || 0 : val },
      ),
    });
  }

  function addExpense() {
    const id = `exp-${Date.now()}`;
    onChange({
      ...content,
      expenses: [...content.expenses, { id, label: 'New expense', category: '', amount: 0 }],
    });
  }

  function deleteExpense(id: string) {
    onChange({ ...content, expenses: content.expenses.filter(e => e.id !== id) });
  }

  function updateNotes(notes: string) {
    onChange({ ...content, notes });
  }

  // ── View ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
          Monthly budget
        </p>
        <button
          onClick={() => setEditMode(!editMode)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            editMode
              ? 'tpl-accent-bg text-white'
              : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
          aria-label={editMode ? 'Finish editing budget' : 'Edit budget'}
          data-testid="edit-budget-btn"
        >
          {editMode ? '✓  Done editing' : 'Edit budget'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-green-50 rounded-2xl p-3 text-center">
          <div className="text-xs text-green-600 font-medium mb-1">Income</div>
          <div className="text-sm font-bold text-green-700">{fmt(content.currency, totalIncome)}</div>
        </div>
        <div className="bg-red-50 rounded-2xl p-3 text-center">
          <div className="text-xs text-red-500 font-medium mb-1">Expenses</div>
          <div className="text-sm font-bold text-red-600">{fmt(content.currency, totalExpenses)}</div>
        </div>
        <div className={`rounded-2xl p-3 text-center ${net >= 0 ? 'tpl-accent-soft' : 'bg-orange-50'}`}>
          <div
            className={`text-xs font-medium mb-1 ${net >= 0 ? 'tpl-accent-text' : 'text-orange-500'}`}
          >
            Remaining
          </div>
          <div
            className={`text-sm font-bold ${net >= 0 ? 'tpl-accent-text' : 'text-orange-600'}`}
          >
            {fmt(content.currency, net)}
          </div>
        </div>
      </div>

      {/* Currency selector — edit mode only */}
      {editMode && (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-3">
          <span className="text-sm text-gray-500 flex-shrink-0">Currency symbol</span>
          <input
            type="text"
            value={content.currency}
            onChange={e => updateCurrency(e.target.value)}
            className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-300"
            maxLength={3}
            aria-label="Currency symbol"
            data-testid="currency-input"
          />
        </div>
      )}

      {/* ── Income section ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Income</h3>
          {editMode && (
            <button
              onClick={addIncome}
              className="text-xs font-semibold text-green-600 px-2 py-1 rounded-lg bg-green-50 active:bg-green-100"
              data-testid="add-income-btn"
            >
              + Add row
            </button>
          )}
        </div>

        {content.income.length === 0 && (
          <div className="px-4 py-3 text-sm text-gray-400">
            {editMode ? 'Tap + Add row to add income.' : 'No income entries yet.'}
          </div>
        )}

        {content.income.map(item => (
          <div
            key={item.id}
            className="px-4 py-3 border-b border-gray-50 last:border-0"
            data-testid={`income-row-${item.id}`}
          >
            {editMode ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.label}
                  onChange={e => updateIncomeField(item.id, 'label', e.target.value)}
                  className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  aria-label="Income label"
                  data-testid={`income-label-${item.id}`}
                  placeholder="Label"
                />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-sm text-gray-400">{content.currency}</span>
                  <input
                    type="number"
                    value={item.amount}
                    onChange={e => updateIncomeField(item.id, 'amount', e.target.value)}
                    className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-300"
                    min={0}
                    aria-label="Income amount"
                    data-testid={`income-amount-${item.id}`}
                  />
                </div>
                <button
                  onClick={() => deleteIncome(item.id)}
                  className="text-xs font-semibold text-red-400 w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 active:bg-red-100 flex-shrink-0"
                  aria-label={`Delete income row ${item.label}`}
                  data-testid={`delete-income-${item.id}`}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="flex-1 text-sm text-gray-700">{item.label}</span>
                <span className="text-sm font-semibold text-green-700">
                  {fmt(content.currency, item.amount)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Expenses section ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Expenses</h3>
          {editMode && (
            <button
              onClick={addExpense}
              className="text-xs font-semibold text-red-500 px-2 py-1 rounded-lg bg-red-50 active:bg-red-100"
              data-testid="add-expense-btn"
            >
              + Add row
            </button>
          )}
        </div>

        {content.expenses.length === 0 && (
          <div className="px-4 py-3 text-sm text-gray-400">
            {editMode ? 'Tap + Add row to add an expense.' : 'No expense entries yet.'}
          </div>
        )}

        {content.expenses.map(item => (
          <div
            key={item.id}
            className="px-4 py-3 border-b border-gray-50 last:border-0"
            data-testid={`expense-row-${item.id}`}
          >
            {editMode ? (
              <div className="flex gap-2">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    type="text"
                    value={item.label}
                    onChange={e => updateExpenseField(item.id, 'label', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                    aria-label="Expense label"
                    data-testid={`expense-label-${item.id}`}
                    placeholder="Label"
                  />
                  <input
                    type="text"
                    value={item.category ?? ''}
                    onChange={e => updateExpenseField(item.id, 'category', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                    aria-label="Expense category"
                    data-testid={`expense-category-${item.id}`}
                    placeholder="Category (optional)"
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-400">{content.currency}</span>
                    <input
                      type="number"
                      value={item.amount}
                      onChange={e => updateExpenseField(item.id, 'amount', e.target.value)}
                      className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-200"
                      min={0}
                      aria-label="Expense amount"
                      data-testid={`expense-amount-${item.id}`}
                    />
                  </div>
                  <button
                    onClick={() => deleteExpense(item.id)}
                    className="text-xs font-semibold text-red-400 px-2 py-1.5 rounded-lg bg-red-50 active:bg-red-100 text-center"
                    aria-label={`Delete expense row ${item.label}`}
                    data-testid={`delete-expense-${item.id}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700 truncate">{item.label}</div>
                  {item.category && (
                    <div className="text-xs text-gray-400">{item.category}</div>
                  )}
                </div>
                <span className="text-sm font-semibold text-red-600">
                  {fmt(content.currency, item.amount)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Notes section ───────────────────────────────────────────────── */}
      {(content.notes || editMode) && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Notes</h3>
          </div>
          <div className="px-4 py-3">
            {editMode ? (
              <textarea
                value={content.notes ?? ''}
                onChange={e => updateNotes(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
                rows={3}
                placeholder="Add notes about this budget…"
                aria-label="Budget notes"
                data-testid="notes-input"
              />
            ) : (
              <p className="text-sm text-gray-600">{content.notes}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

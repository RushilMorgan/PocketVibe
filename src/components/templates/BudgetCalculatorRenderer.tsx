import React, { useState } from 'react';
import type { BudgetCalculatorContent } from '../../types';

interface BudgetCalculatorRendererProps {
  content: BudgetCalculatorContent;
  onChange: (updated: BudgetCalculatorContent) => void;
}

function fmt(currency: string, amount: number): string {
  return `${currency}${new Intl.NumberFormat('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;
}

export function BudgetCalculatorRenderer({ content, onChange }: BudgetCalculatorRendererProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const totalIncome = content.income.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = content.expenses.reduce((s, e) => s + e.amount, 0);
  const net = totalIncome - totalExpenses;

  function startEdit(id: string, amount: number) {
    setEditingId(id);
    setEditValue(String(amount));
  }

  function commitEdit(type: 'income' | 'expense', id: string) {
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0) { setEditingId(null); return; }
    const updated: BudgetCalculatorContent = {
      ...content,
      income: type === 'income'
        ? content.income.map(i => i.id === id ? { ...i, amount: val } : i)
        : content.income,
      expenses: type === 'expense'
        ? content.expenses.map(e => e.id === id ? { ...e, amount: val } : e)
        : content.expenses,
    };
    onChange(updated);
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
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
        <div className={`rounded-2xl p-3 text-center ${net >= 0 ? 'bg-violet-50' : 'bg-orange-50'}`}>
          <div className={`text-xs font-medium mb-1 ${net >= 0 ? 'text-violet-600' : 'text-orange-500'}`}>Net</div>
          <div className={`text-sm font-bold ${net >= 0 ? 'text-violet-700' : 'text-orange-600'}`}>{fmt(content.currency, net)}</div>
        </div>
      </div>

      {/* Income section */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Income</h3>
        </div>
        {content.income.map(item => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
            <span className="flex-1 text-sm text-gray-700">{item.label}</span>
            {editingId === item.id ? (
              <input
                type="number"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => commitEdit('income', item.id)}
                onKeyDown={e => e.key === 'Enter' && commitEdit('income', item.id)}
                className="w-28 text-right text-sm font-semibold border border-violet-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-400"
                autoFocus
              />
            ) : (
              <button
                onClick={() => startEdit(item.id, item.amount)}
                className="text-sm font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-lg active:bg-green-100"
              >
                {fmt(content.currency, item.amount)}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Expenses section */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Expenses</h3>
        </div>
        {content.expenses.map(item => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-700 truncate">{item.label}</div>
              {item.category && <div className="text-xs text-gray-400">{item.category}</div>}
            </div>
            {editingId === item.id ? (
              <input
                type="number"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => commitEdit('expense', item.id)}
                onKeyDown={e => e.key === 'Enter' && commitEdit('expense', item.id)}
                className="w-28 text-right text-sm font-semibold border border-violet-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-400"
                autoFocus
              />
            ) : (
              <button
                onClick={() => startEdit(item.id, item.amount)}
                className="text-sm font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-lg active:bg-red-100"
              >
                {fmt(content.currency, item.amount)}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

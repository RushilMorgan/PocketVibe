import React, { useState } from 'react';
import type { SavingsTrackerContent, SavingsContribution } from '../../types';

interface SavingsTrackerRendererProps {
  content: SavingsTrackerContent;
  onChange: (updated: SavingsTrackerContent) => void;
}

function fmt(currency: string, amount: number): string {
  return `${currency}${new Intl.NumberFormat('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;
}

export function SavingsTrackerRenderer({ content, onChange }: SavingsTrackerRendererProps) {
  const [contribution, setContribution] = useState('');
  const [label, setLabel] = useState('');

  // Edit-goal state
  const [isEditing, setIsEditing] = useState(false);
  const [editGoalName, setEditGoalName] = useState(content.goalName);
  const [editTargetAmount, setEditTargetAmount] = useState(String(content.targetAmount));
  const [editCurrentAmount, setEditCurrentAmount] = useState(String(content.currentAmount));
  const [editCurrency, setEditCurrency] = useState(content.currency);
  const [editDeadline, setEditDeadline] = useState(content.deadline ?? '');

  const pct = content.targetAmount > 0
    ? Math.min(100, Math.round((content.currentAmount / content.targetAmount) * 100))
    : 0;

  function openEdit() {
    setEditGoalName(content.goalName);
    setEditTargetAmount(String(content.targetAmount));
    setEditCurrentAmount(String(content.currentAmount));
    setEditCurrency(content.currency);
    setEditDeadline(content.deadline ?? '');
    setIsEditing(true);
  }

  function saveEdit() {
    const target = parseFloat(editTargetAmount);
    const current = parseFloat(editCurrentAmount);
    if (!editGoalName.trim() || isNaN(target) || target <= 0 || isNaN(current) || current < 0) return;
    onChange({
      ...content,
      goalName: editGoalName.trim(),
      targetAmount: target,
      currentAmount: current,
      currency: editCurrency.trim() || 'R',
      deadline: editDeadline || undefined,
    });
    setIsEditing(false);
  }

  function deleteContribution(id: string) {
    const contrib = content.contributions.find(c => c.id === id);
    if (!contrib) return;
    onChange({
      ...content,
      currentAmount: Math.max(0, content.currentAmount - contrib.amount),
      contributions: content.contributions.filter(c => c.id !== id),
    });
  }

  function addContribution() {
    const amount = parseFloat(contribution);
    if (isNaN(amount) || amount <= 0) return;
    const now = new Date().toISOString();
    const newContribution: SavingsContribution = {
      id: `con-${Date.now()}`,
      date: now.slice(0, 10),
      amount,
      note: label.trim() || undefined,
    };
    onChange({
      ...content,
      currentAmount: content.currentAmount + amount,
      contributions: [...content.contributions, newContribution],
    });
    setContribution('');
    setLabel('');
  }

  const remaining = Math.max(0, content.targetAmount - content.currentAmount);
  const isComplete = content.currentAmount >= content.targetAmount;

  // Edit-goal form
  if (isEditing) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 text-base mb-4">Edit savings goal</h3>

          <label className="block mb-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Goal name</span>
            <input
              data-testid="edit-goal-name-input"
              type="text"
              value={editGoalName}
              onChange={e => setEditGoalName(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </label>

          <label className="block mb-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Currency symbol</span>
            <input
              data-testid="edit-currency-input"
              type="text"
              value={editCurrency}
              onChange={e => setEditCurrency(e.target.value)}
              maxLength={4}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </label>

          <label className="block mb-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Target amount</span>
            <input
              data-testid="edit-target-amount-input"
              type="number"
              value={editTargetAmount}
              onChange={e => setEditTargetAmount(e.target.value)}
              min="1"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </label>

          <label className="block mb-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current amount saved</span>
            <input
              data-testid="edit-current-amount-input"
              type="number"
              value={editCurrentAmount}
              onChange={e => setEditCurrentAmount(e.target.value)}
              min="0"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </label>

          <label className="block mb-4">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Deadline (optional)</span>
            <input
              data-testid="edit-deadline-input"
              type="date"
              value={editDeadline}
              onChange={e => setEditDeadline(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </label>

          <div className="flex gap-3">
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
            >
              Cancel
            </button>
            <button
              data-testid="done-editing-btn"
              onClick={saveEdit}
              disabled={!editGoalName.trim() || parseFloat(editTargetAmount) <= 0}
              className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold disabled:opacity-40 active:bg-sky-600 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Goal card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-gray-900 text-base">{content.goalName}</h3>
          <div className="flex items-center gap-2">
            {isComplete && <span className="text-lg">ðŸŽ‰</span>}
            <button
              data-testid="edit-savings-btn"
              onClick={openEdit}
              className="text-xs text-sky-600 font-medium px-2 py-1 rounded-lg hover:bg-sky-50 transition-colors"
            >
              Edit savings goal
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)' }}
          />
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold text-sky-600">{fmt(content.currency, content.currentAmount)}</div>
            <div className="text-xs text-gray-400">of {fmt(content.currency, content.targetAmount)} goal</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-700">{pct}%</div>
            {!isComplete && <div className="text-xs text-gray-400">{fmt(content.currency, remaining)} to go</div>}
          </div>
        </div>

        {content.deadline && (
          <div className="mt-2 text-xs text-gray-400">
            Target: {new Date(content.deadline).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Add contribution */}
      {!isComplete && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Add contribution</h4>
          <div className="flex gap-2 mb-2">
            <div className="flex-1 flex items-center border border-gray-200 rounded-xl px-3 py-2 gap-1">
              <span className="text-sm text-gray-400">{content.currency}</span>
              <input
                type="number"
                value={contribution}
                onChange={e => setContribution(e.target.value)}
                placeholder="0"
                className="flex-1 text-sm font-semibold focus:outline-none bg-transparent w-0"
                min="1"
              />
            </div>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Note (optional)"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <button
            onClick={addContribution}
            disabled={!contribution || parseFloat(contribution) <= 0}
            className="w-full py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold disabled:opacity-40 active:bg-sky-600 transition-colors"
          >
            + Add {contribution ? fmt(content.currency, parseFloat(contribution) || 0) : 'amount'}
          </button>
        </div>
      )}

      {/* Contribution history */}
      {content.contributions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h4 className="text-sm font-semibold text-gray-700">Contributions</h4>
          </div>
          <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
            {[...content.contributions].reverse().map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <div className="text-sm font-medium text-gray-700">{fmt(content.currency, c.amount)}</div>
                  {c.note && <div className="text-xs text-gray-400">{c.note}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-400">{c.date}</div>
                  <button
                    data-testid={`delete-contribution-${c.id}`}
                    onClick={() => deleteContribution(c.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-xs font-bold"
                    aria-label="Delete contribution"
                  >
                    âœ•
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  TournamentPoolTrackerContent,
  TournamentParticipant,
  TournamentTeam,
  TournamentMatch,
  TournamentScoringRules,
  ColourTheme,
} from '../../types';
import { SmartGuidance } from '../SmartGuidance';
import { computePoolGuidance } from '../../lib/guidance';
import { THEMES, getPoolGradient, getThemeAccent } from '../../lib/themes';
import {
  shuffle,
  runFairSeededDraw,
} from '../../lib/drawEngine';
import type { PotBreakdown, ParticipantDrawSummary } from '../../lib/drawEngine';

interface Props {
  content: TournamentPoolTrackerContent;
  onChange: (updated: TournamentPoolTrackerContent) => void;
  onShare?: () => void;
  hasShareLink?: boolean;
  pendingLocalAction?: string | null;
  onLocalActionConsumed?: () => void;
}

interface ParticipantScore {
  participant: TournamentParticipant;
  teams: TournamentTeam[];
  points: number;
  wins: number;
  draws: number;
  activeTeams: number;
}

interface DrawCompleteResult {
  totalAssigned: number;
  summaries: Array<{
    id: string;
    name: string;
    emoji: string;
    topTeams: string[];
    totalTeams: number;
    potCounts: PotBreakdown;
    strengthScore: number;
  }>;
  fairnessWarning: string | null;
}

type SheetView = 'manage' | 'editPeople' | 'editTeams' | 'scoring' | 'colours' | 'drawComplete' | 'addResult' | 'lockConfirm';

const MEDAL = ['🥇', '🥈', '🥉'];

// ── Pure helpers ──────────────────────────────────────────────────────────────


let _uid = 0;
function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_uid}`;
}

function calcScores(content: TournamentPoolTrackerContent): ParticipantScore[] {
  const { participants, teams, matches } = content;
  // Use nullish coalescing per-field so partially-generated or missing
  // scoringRules never produce NaN (avoids TS2783 duplicate-key warning).
  const sr = content.scoringRules as Partial<TournamentScoringRules> | undefined;
  const r: TournamentScoringRules = {
    pointsPerWin:      sr?.pointsPerWin      ?? 3,
    pointsPerDraw:     sr?.pointsPerDraw     ?? 1,
    knockoutBonus:     sr?.knockoutBonus     ?? 5,
    quarterFinalBonus: sr?.quarterFinalBonus ?? 10,
    semiFinalBonus:    sr?.semiFinalBonus    ?? 15,
    finalBonus:        sr?.finalBonus        ?? 20,
    winnerBonus:       sr?.winnerBonus       ?? 30,
  };
  return participants
    .map(p => {
      const myTeams = teams.filter(t => t.assignedTo === p.id);
      const myIds = new Set(myTeams.map(t => t.id));
      let points = 0;
      let wins = 0;
      let draws = 0;

      for (const m of matches) {
        if (m.scoreA === undefined || m.scoreB === undefined) continue;
        const aMe = myIds.has(m.teamAId);
        const bMe = myIds.has(m.teamBId);
        if (!aMe && !bMe) continue;
        if (m.scoreA > m.scoreB) {
          if (aMe) { points += r.pointsPerWin; wins++; }
        } else if (m.scoreB > m.scoreA) {
          if (bMe) { points += r.pointsPerWin; wins++; }
        } else {
          if (aMe) { points += r.pointsPerDraw; draws++; }
          if (bMe) { points += r.pointsPerDraw; draws++; }
        }
      }

      for (const team of myTeams) {
        switch (team.status) {
          case 'round_of_16':   points += r.knockoutBonus; break;
          case 'quarter_final': points += r.quarterFinalBonus; break;
          case 'semi_final':    points += r.semiFinalBonus; break;
          case 'final':         points += r.finalBonus; break;
          case 'winner':        points += r.winnerBonus; break;
        }
      }

      return {
        participant: p,
        teams: myTeams,
        points,
        wins,
        draws,
        activeTeams: myTeams.filter(t => t.status !== 'eliminated').length,
      };
    })
    .sort((a, b) => b.points - a.points);
}

// ── Sheet header (defined outside component to avoid remount issues) ───────────

interface SheetHeaderProps {
  title: string;
  onBack?: () => void;
  onClose?: () => void;
  closeBtnTestId?: string;
}

function SheetHeader({ title, onBack, onClose, closeBtnTestId }: SheetHeaderProps) {
  return (
    <>
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
      <div className="mb-4 flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 active:bg-gray-200"
            aria-label="Back"
          >
            ← Back
          </button>
        )}
        <h3 className="flex-1 text-base font-black text-gray-900">{title}</h3>
        {onClose && (
          <button
            data-testid={closeBtnTestId ?? 'sheet-close-btn'}
            onClick={onClose}
            className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 active:bg-gray-200"
          >
            Done
          </button>
        )}
      </div>
    </>
  );
}

const SCORING_FIELDS: [keyof TournamentScoringRules, string, string][] = [
  ['pointsPerWin',      'Points per win',       'points-per-win-input'],
  ['pointsPerDraw',     'Points per draw',      'points-per-draw-input'],
  ['knockoutBonus',     'Knockout bonus',       'knockout-bonus-input'],
  ['quarterFinalBonus', 'Quarter-final bonus',  'quarter-final-bonus-input'],
  ['semiFinalBonus',    'Semi-final bonus',     'semi-final-bonus-input'],
  ['finalBonus',        'Final bonus',          'final-bonus-input'],
  ['winnerBonus',       'Winner bonus',         'winner-bonus-input'],
];

// ── Main component ────────────────────────────────────────────────────────────

export function TournamentPoolRenderer({ content, onChange, onShare, hasShareLink = false, pendingLocalAction, onLocalActionConsumed }: Props) {
  const update = (patch: Partial<TournamentPoolTrackerContent>) =>
    onChange({ ...content, ...patch });

  // ── Theme accent colour ───────────────────────────────────────────────────
  const accent = getThemeAccent(content.colourTheme);
  const accentBg   = `${accent}18`;   // ~10% opacity — subtle tint for headers/badges
  const accentBg40 = `${accent}40`;   // ~25% opacity — hover / divider
  const accentText = accent;          // full colour for text and icons

  // ── Sheet navigation ─────────────────────────────────────────────────────
  const [sheetView, setSheetView] = useState<SheetView | null>(null);
  const [participantSheetId, setParticipantSheetId] = useState<string | null>(null);
  const [showAllTeams, setShowAllTeams] = useState(false);

  // ── Draw result data ─────────────────────────────────────────────────────
  const [drawCompleteData, setDrawCompleteData] = useState<DrawCompleteResult | null>(null);

  // ── Toast ────────────────────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg(msg);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2500);
  }

  // ── Participant state ────────────────────────────────────────────────────
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantEmoji, setNewParticipantEmoji] = useState('');
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [editParticipantName, setEditParticipantName] = useState('');
  const [editParticipantEmoji, setEditParticipantEmoji] = useState('');

  // ── Team state ───────────────────────────────────────────────────────────
  const [addingTeam, setAddingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamPot, setNewTeamPot] = useState('1');
  const [newTeamGroup, setNewTeamGroup] = useState('');
  const [newTeamFlag, setNewTeamFlag] = useState('');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamPot, setEditTeamPot] = useState('1');
  const [editTeamGroup, setEditTeamGroup] = useState('');
  const [editTeamFlag, setEditTeamFlag] = useState('');
  const [editTeamStatus, setEditTeamStatus] = useState<TournamentTeam['status']>('active');

  // ── Inline pool name editing ─────────────────────────────────────────────
  const [editingPoolName, setEditingPoolName] = useState(false);
  const [poolNameDraft, setPoolNameDraft] = useState(content.poolName);
  const poolNameInputRef = useRef<HTMLInputElement>(null);

  function commitPoolName() {
    const name = poolNameDraft.trim();
    if (name && name !== content.poolName) update({ poolName: name });
    else setPoolNameDraft(content.poolName);
    setEditingPoolName(false);
  }

  // ── Participant inline rename (from detail sheet) ─────────────────────────
  const [renamingParticipantId, setRenamingParticipantId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  function startRenameParticipant(p: TournamentParticipant) {
    setRenamingParticipantId(p.id);
    setRenameDraft(p.name);
  }

  function commitRenameParticipant() {
    const name = renameDraft.trim();
    if (name && renamingParticipantId) {
      update({
        participants: content.participants.map(p =>
          p.id === renamingParticipantId ? { ...p, name } : p,
        ),
      });
      showToast('Name updated');
    }
    setRenamingParticipantId(null);
  }

  // ── Match state ──────────────────────────────────────────────────────────
  const [matchTeamA, setMatchTeamA] = useState('');
  const [matchTeamB, setMatchTeamB] = useState('');
  const [matchScoreA, setMatchScoreA] = useState('');
  const [matchScoreB, setMatchScoreB] = useState('');
  const [matchDate, setMatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [matchStage, setMatchStage] = useState('Group Stage');

  // ── Scoring state ────────────────────────────────────────────────────────
  const [editScoring, setEditScoring] = useState<TournamentScoringRules>({ ...content.scoringRules });
  const [scoringDirty, setScoringDirty] = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const leaderboard = useMemo(() => calcScores(content), [content]);
  const unassignedTeams = content.teams.filter(t => !t.assignedTo);
  const allTeamsAssigned =
    content.teams.length > 0 &&
    unassignedTeams.length === 0 &&
    content.participants.length > 0;
  const poolGuidance = computePoolGuidance(content, hasShareLink);
  const assignedCount = content.teams.filter(t => t.assignedTo).length;

  const participantDetails = participantSheetId
    ? leaderboard.find(row => row.participant.id === participantSheetId) ?? null
    : null;

  const drawStatus = content.drawLocked
    ? 'Locked'
    : allTeamsAssigned
      ? 'Ready to lock'
      : content.participants.length === 0
        ? 'Add people first'
        : 'Waiting for draw';

  // ── SmartGuidance action router ──────────────────────────────────────────
  function handleAction(id: string) {
    switch (id) {
      case 'add-people':   setSheetView('editPeople'); break;
      case 'edit-scoring':
        setEditScoring({ ...content.scoringRules });
        setScoringDirty(false);
        setSheetView('scoring');
        break;
      case 'run-draw-all': drawAll(); break;
      case 'lock-draw':    lockDraw(); break;
      case 'change-theme': setSheetView('colours'); break;
      case 'add-result':   setSheetView('addResult'); break;
      case 'share':        onShare?.(); break;
    }
  }

  // ── Pending local action from chat (e.g. creationComposer chip) ────────────
  useEffect(() => {
    if (!pendingLocalAction) return;
    handleAction(pendingLocalAction);
    onLocalActionConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLocalAction]);

  // ── Participant CRUD ─────────────────────────────────────────────────────
  function addParticipant() {
    const name = newParticipantName.trim();
    if (!name) return;
    const p: TournamentParticipant = {
      id: uid('p'),
      name,
      emoji: newParticipantEmoji.trim() || '👤',
    };
    update({ participants: [...content.participants, p] });
    setNewParticipantName('');
    setNewParticipantEmoji('');
    setAddingParticipant(false);
  }

  function openEditParticipant(p: TournamentParticipant) {
    setEditingParticipantId(p.id);
    setEditParticipantName(p.name);
    setEditParticipantEmoji(p.emoji ?? '');
  }

  function saveParticipant() {
    const name = editParticipantName.trim();
    if (!name || !editingParticipantId) return;
    update({
      participants: content.participants.map(p =>
        p.id === editingParticipantId
          ? { ...p, name, emoji: editParticipantEmoji.trim() || p.emoji }
          : p,
      ),
    });
    setEditingParticipantId(null);
  }

  function deleteParticipant(id: string) {
    update({
      participants: content.participants.filter(p => p.id !== id),
      teams: content.teams.map(t =>
        t.assignedTo === id ? { ...t, assignedTo: undefined } : t,
      ),
    });
  }

  // ── Team CRUD ────────────────────────────────────────────────────────────
  function addTeam() {
    const name = newTeamName.trim();
    if (!name) return;
    const t: TournamentTeam = {
      id: uid('t'),
      name,
      pot: parseInt(newTeamPot) || 1,
      group: newTeamGroup.trim() || undefined,
      flagEmoji: newTeamFlag.trim() || undefined,
      status: 'active',
    };
    update({ teams: [...content.teams, t] });
    setNewTeamName('');
    setNewTeamPot('1');
    setNewTeamGroup('');
    setNewTeamFlag('');
    setAddingTeam(false);
  }

  function openEditTeam(team: TournamentTeam) {
    setEditingTeamId(team.id);
    setEditTeamName(team.name);
    setEditTeamPot(String(team.pot));
    setEditTeamGroup(team.group ?? '');
    setEditTeamFlag(team.flagEmoji ?? '');
    setEditTeamStatus(team.status);
  }

  function saveTeamEdit() {
    const name = editTeamName.trim();
    if (!name || !editingTeamId) return;
    update({
      teams: content.teams.map(t =>
        t.id === editingTeamId
          ? {
              ...t,
              name,
              pot: parseInt(editTeamPot) || t.pot,
              group: editTeamGroup.trim() || undefined,
              flagEmoji: editTeamFlag.trim() || undefined,
              status: editTeamStatus,
            }
          : t,
      ),
    });
    setEditingTeamId(null);
  }

  function updateTeamStatus(id: string, status: TournamentTeam['status']) {
    update({ teams: content.teams.map(t => (t.id === id ? { ...t, status } : t)) });
  }

  // ── Match CRUD ───────────────────────────────────────────────────────────
  function saveMatch() {
    if (!matchTeamA || !matchTeamB || matchTeamA === matchTeamB) return;
    const scoreA = parseInt(matchScoreA);
    const scoreB = parseInt(matchScoreB);
    const m: TournamentMatch = {
      id: uid('m'),
      teamAId: matchTeamA,
      teamBId: matchTeamB,
      scoreA: isNaN(scoreA) ? undefined : scoreA,
      scoreB: isNaN(scoreB) ? undefined : scoreB,
      date: matchDate || undefined,
      stage: matchStage || undefined,
    };
    update({ matches: [...content.matches, m] });
    setMatchTeamA('');
    setMatchTeamB('');
    setMatchScoreA('');
    setMatchScoreB('');
    showToast('Result added');
    setSheetView('manage');
  }

  function deleteMatch(id: string) {
    update({ matches: content.matches.filter(m => m.id !== id) });
  }

  // ── Scoring ──────────────────────────────────────────────────────────────
  function saveScoring() {
    update({ scoringRules: editScoring });
    setScoringDirty(false);
    showToast('Scoring updated');
  }

  // ── Draw ─────────────────────────────────────────────────────────────────
  function lockDraw() {
    update({ drawLocked: true });
  }

  function buildDrawCompleteResult(
    updatedTeams: TournamentTeam[],
    potBreakdown: Map<string, PotBreakdown>,
    fairnessWarning: string | null,
    participantSummaries: Map<string, ParticipantDrawSummary>,
  ): DrawCompleteResult {
    const totalAssigned = updatedTeams.filter(t => t.assignedTo).length;
    const summaries = content.participants.map(p => {
      const myTeams = updatedTeams.filter(t => t.assignedTo === p.id);
      const potCounts = potBreakdown.get(p.id) ?? {};
      const strengthScore = participantSummaries.get(p.id)?.strengthScore ?? 0;
      return {
        id: p.id,
        name: p.name,
        emoji: p.emoji ?? '👤',
        topTeams: myTeams.slice(0, 5).map(t => `${t.flagEmoji ?? ''} ${t.name}`.trim()),
        totalTeams: myTeams.length,
        potCounts,
        strengthScore,
      };
    });
    return { totalAssigned, summaries, fairnessWarning };
  }

  function drawAll() {
    if (content.drawLocked) { showToast('Draw is locked — unlock it first.'); return; }
    if (content.participants.length === 0) return;
    if (content.teams.length === 0) return;
    const result = runFairSeededDraw(content.teams, content.participants);
    update({ teams: result.teams });
    setDrawCompleteData(
      buildDrawCompleteResult(result.teams, result.potBreakdown, result.fairnessWarning, result.participantSummaries),
    );
    setSheetView('drawComplete');
  }

  function undoDraw() {
    update({ teams: content.teams.map(t => ({ ...t, assignedTo: undefined })) });
    setDrawCompleteData(null);
    setSheetView('manage');
  }

  // ── Sheet content renderer ───────────────────────────────────────────────

  function renderSheetContent() {
    // ── MANAGE ─────────────────────────────────────────────────────────────
    if (sheetView === 'manage') {
      return (
        <>
          <SheetHeader
            title="Manage pool"
            closeBtnTestId="edit-pool-btn"
            onClose={() => setSheetView(null)}
          />

          {toastMsg && (
            <div data-testid="toast-msg" className="mb-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              {toastMsg}
            </div>
          )}

          {/* Draw actions */}
          <div className="grid grid-cols-2 gap-2">
            <button data-testid="draw-all-btn" onClick={drawAll} className="col-span-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>🎯 Run fair draw</button>
            <button data-testid="lock-draw-btn" onClick={() => setSheetView('lockConfirm')} className="col-span-2 rounded-xl px-3 py-2.5 text-xs font-semibold" style={{ backgroundColor: accentBg, color: accentText, border: `1px solid ${accentBg40}` }}>🔒 Lock draw</button>
          </div>

          {/* Navigation to sub-views */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              data-testid="people-nav-btn"
              onClick={() => setSheetView('editPeople')}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700"
            >
              👥 People
            </button>
            <button
              data-testid="teams-nav-btn"
              onClick={() => setSheetView('editTeams')}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700"
            >
              🏳 Teams
            </button>
            <button
              data-testid="scoring-nav-btn"
              onClick={() => { setEditScoring({ ...content.scoringRules }); setScoringDirty(false); setSheetView('scoring'); }}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700"
            >
              📊 Scoring
            </button>
            <button
              data-testid="colours-nav-btn"
              onClick={() => setSheetView('colours')}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700"
            >
              🎨 Colours
            </button>
            <button
              data-testid="add-match-btn"
              onClick={() => setSheetView('addResult')}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700"
            >
              ⚽ Add result
            </button>
            {onShare && (
              <button
                onClick={onShare}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700"
              >
                🔗 Share
              </button>
            )}
          </div>
        </>
      );
    }

    // ── EDIT PEOPLE ───────────────────────────────────────────────────────────
    if (sheetView === 'editPeople') {
      return (
        <>
          <SheetHeader title="People" onBack={() => setSheetView('manage')} />
          <div className="mt-2 space-y-2">
            {content.participants.map(p => (
              <div key={p.id}>
                {editingParticipantId === p.id ? (
                  <div className="flex gap-2">
                    <input data-testid={`edit-participant-name-${p.id}`} value={editParticipantName} onChange={e => setEditParticipantName(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                    <input value={editParticipantEmoji} onChange={e => setEditParticipantEmoji(e.target.value)} className="w-14 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm" />
                    <button data-testid={`save-participant-${p.id}`} onClick={saveParticipant} className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">Save</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-center text-xl">{p.emoji ?? '👤'}</span>
                    <span className="flex-1 text-sm text-gray-800">{p.name}</span>
                    <button data-testid={`edit-participant-btn-${p.id}`} onClick={() => openEditParticipant(p)} className="rounded-lg px-2 py-1 text-xs text-blue-600 active:bg-blue-50">Edit</button>
                    <button data-testid={`delete-participant-${p.id}`} onClick={() => deleteParticipant(p.id)} className="px-2 py-1 text-sm text-red-500">×</button>
                  </div>
                )}
              </div>
            ))}
            {addingParticipant ? (
              <div className="flex gap-2">
                <input data-testid="new-participant-name" value={newParticipantName} onChange={e => setNewParticipantName(e.target.value)} placeholder="Name" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                <input value={newParticipantEmoji} onChange={e => setNewParticipantEmoji(e.target.value)} placeholder="😀" className="w-14 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm" />
                <button data-testid="save-participant-btn" onClick={addParticipant} className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">Add</button>
              </div>
            ) : (
              <button data-testid="add-participant-btn" onClick={() => setAddingParticipant(true)} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-800">+ Add participant</button>
            )}
          </div>
        </>
      );
    }

    // ── EDIT TEAMS ────────────────────────────────────────────────────────────
    if (sheetView === 'editTeams') {
      return (
        <>
          <SheetHeader title="Teams" onBack={() => setSheetView('manage')} />
          <div className="mt-2 space-y-2">
            {content.teams.map(team => (
              <div key={team.id}>
                {editingTeamId === team.id ? (
                  <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
                    <div className="flex gap-2">
                      <input data-testid={`edit-team-name-${team.id}`} value={editTeamName} onChange={e => setEditTeamName(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
                      <input data-testid={`edit-team-flag-${team.id}`} value={editTeamFlag} onChange={e => setEditTeamFlag(e.target.value)} className="w-12 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input data-testid={`edit-team-pot-${team.id}`} type="number" value={editTeamPot} onChange={e => setEditTeamPot(e.target.value)} className="w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm" />
                      <input data-testid={`edit-team-group-${team.id}`} value={editTeamGroup} onChange={e => setEditTeamGroup(e.target.value)} className="w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm" />
                      <select data-testid={`edit-team-status-${team.id}`} value={editTeamStatus} onChange={e => setEditTeamStatus(e.target.value as TournamentTeam['status'])} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs">
                        <option value="active">Active</option>
                        <option value="round_of_16">Round of 16</option>
                        <option value="quarter_final">Quarter-final</option>
                        <option value="semi_final">Semi-final</option>
                        <option value="final">Final</option>
                        <option value="winner">Winner</option>
                        <option value="eliminated">Eliminated</option>
                      </select>
                      <button data-testid={`save-team-edit-${team.id}`} onClick={saveTeamEdit} className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-gray-800">{team.flagEmoji ?? '🏳'} {team.name}</span>
                    <select data-testid={`team-status-${team.id}`} value={team.status} onChange={e => updateTeamStatus(team.id, e.target.value as TournamentTeam['status'])} className="rounded-lg border border-gray-200 px-2 py-1 text-xs">
                      <option value="active">Active</option>
                      <option value="round_of_16">Round of 16</option>
                      <option value="quarter_final">Quarter-final</option>
                      <option value="semi_final">Semi-final</option>
                      <option value="final">Final</option>
                      <option value="winner">Winner</option>
                      <option value="eliminated">Eliminated</option>
                    </select>
                    <button data-testid={`edit-team-btn-${team.id}`} onClick={() => openEditTeam(team)} className="rounded-lg px-2 py-1 text-xs text-blue-600 active:bg-blue-50">Edit</button>
                  </div>
                )}
              </div>
            ))}
            {addingTeam ? (
              <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
                <div className="flex gap-2">
                  <input data-testid="new-team-name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Team name" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  <input value={newTeamFlag} onChange={e => setNewTeamFlag(e.target.value)} placeholder="🏳" className="w-12 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <input data-testid="new-team-pot" type="number" value={newTeamPot} onChange={e => setNewTeamPot(e.target.value)} className="w-16 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm" />
                  <input value={newTeamGroup} onChange={e => setNewTeamGroup(e.target.value)} placeholder="Group" className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm" />
                  <button data-testid="save-team-btn" onClick={addTeam} className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">Add</button>
                </div>
              </div>
            ) : (
              <button data-testid="add-team-btn" onClick={() => setAddingTeam(true)} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-800">+ Add team</button>
            )}
          </div>
        </>
      );
    }

    // ── DRAW COMPLETE ────────────────────────────────────────────────────────
    if (sheetView === 'drawComplete' && drawCompleteData) {
      const pots = [...new Set(content.teams.map(t => t.pot))].sort((a, b) => a - b);
      return (
        <>
          <SheetHeader title="Draw complete! 🎉" onClose={() => setSheetView(null)} />
          <div data-testid="draw-complete-view">
            <p className="text-sm text-gray-500">
              {drawCompleteData.totalAssigned} teams assigned · Fair seeded draw
            </p>

            {drawCompleteData.fairnessWarning && (
              <div
                data-testid="draw-fairness-warning"
                className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3"
              >
                <p className="text-xs text-amber-700">⚠️ {drawCompleteData.fairnessWarning}</p>
              </div>
            )}

            {/* Participant summaries with pot breakdown */}
            <div className="mt-4 space-y-3">
              {drawCompleteData.summaries.map(s => (
                <div
                  key={s.id}
                  data-testid={`draw-complete-participant-${s.id}`}
                  className="rounded-2xl border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{s.emoji}</span>
                    <p className="font-semibold text-gray-900">{s.name}</p>
                    <span className="ml-auto text-xs text-gray-500">{s.totalTeams} teams</span>
                  </div>
                  {/* Pot breakdown */}
                  <div
                    data-testid={`pot-breakdown-${s.id}`}
                    className="mt-2 flex flex-wrap gap-1.5"
                  >
                    {pots.map(pot => {
                      const count = s.potCounts[pot] ?? 0;
                      if (count === 0) return null;
                      return (
                        <span
                          key={pot}
                          className="rounded-full px-2 py-0.5 text-xs"
                          style={{ backgroundColor: accentBg, border: `1px solid ${accentBg40}`, color: accentText }}
                        >
                          Pot {pot}: {count}
                        </span>
                      );
                    })}
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: accentBg40, color: accentText }}>
                      Strength: {s.strengthScore}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
                    {s.topTeams.join(' · ')}
                    {s.totalTeams > s.topTeams.length
                      ? ` · +${s.totalTeams - s.topTeams.length} more`
                      : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <button
              data-testid="view-leaderboard-btn"
              onClick={() => setSheetView(null)}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
            >
              View leaderboard
            </button>
            {onShare && (
              <button
                onClick={onShare}
                className="w-full rounded-xl py-3 text-sm font-semibold"
                style={{ backgroundColor: accentBg, color: accentText, border: `1px solid ${accentBg40}` }}
              >
                Share pool
              </button>
            )}
            <button
              data-testid="undo-draw-btn"
              onClick={undoDraw}
              className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600"
            >
              ↩ Undo draw
            </button>
          </div>
        </>
      );
    }

    // ── SCORING ──────────────────────────────────────────────────────────────
    if (sheetView === 'scoring') {
      return (
        <>
          <SheetHeader title="Scoring" onBack={() => setSheetView('manage')} />
          <div data-testid="sheet-scoring-view" className="space-y-3">
            {SCORING_FIELDS.map(([key, label, testId]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <label className="text-sm text-gray-700">{label}</label>
                <input
                  data-testid={testId}
                  type="number"
                  value={editScoring[key]}
                  onChange={e => {
                    setEditScoring(s => ({ ...s, [key]: Number(e.target.value) }));
                    setScoringDirty(true);
                  }}
                  className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm"
                />
              </div>
            ))}
          </div>
          {toastMsg && (
            <div data-testid="toast-msg" className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              {toastMsg}
            </div>
          )}
          <div className="mt-5 flex gap-2">
            <button
              data-testid="scoring-back-btn"
              onClick={() => setSheetView('manage')}
              className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700"
            >
              ← Back
            </button>
            <button
              data-testid="save-scoring-btn"
              onClick={saveScoring}
              className="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-opacity"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, opacity: scoringDirty ? 1 : 0.4 }}
            >
              Save scoring
            </button>
          </div>
        </>
      );
    }

    // ── COLOURS ──────────────────────────────────────────────────────────────
    if (sheetView === 'colours') {
      return (
        <>
          <SheetHeader title="Pool colours" onBack={() => setSheetView('manage')} />
          <div data-testid="sheet-colours-view" className="flex flex-wrap gap-4">
            {THEMES.map(theme => (
              <button
                key={theme.id}
                data-testid={`theme-${theme.id}`}
                onClick={() => {
                  update({ colourTheme: theme.id as ColourTheme });
                  showToast('Theme updated');
                  setSheetView('manage');
                }}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className={`h-12 w-12 rounded-full bg-gradient-to-br ${theme.gradient} ${
                    content.colourTheme === theme.id ? 'ring-2 ring-gray-900 ring-offset-2' : ''
                  }`}
                />
                <span className="text-xs text-gray-600">{theme.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-5">
            <button
              data-testid="colours-back-btn"
              onClick={() => setSheetView('manage')}
              className="w-full rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700"
            >
              ← Back to Manage pool
            </button>
          </div>
        </>
      );
    }

    // ── ADD RESULT ───────────────────────────────────────────────────────────
    if (sheetView === 'addResult') {
      return (
        <>
          <SheetHeader title="Add result" onBack={() => setSheetView('manage')} />
          <div className="space-y-3">
            <div className="flex gap-2">
              <select data-testid="match-team-a-select" value={matchTeamA} onChange={e => setMatchTeamA(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-2 py-2.5 text-sm">
                <option value="">Team A</option>
                {content.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select data-testid="match-team-b-select" value={matchTeamB} onChange={e => setMatchTeamB(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-2 py-2.5 text-sm">
                <option value="">Team B</option>
                {content.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <input data-testid="match-score-a-input" type="number" value={matchScoreA} onChange={e => setMatchScoreA(e.target.value)} placeholder="0" className="flex-1 rounded-lg border border-gray-200 px-2 py-2.5 text-center text-xl font-bold" />
              <span className="font-bold text-gray-400">–</span>
              <input data-testid="match-score-b-input" type="number" value={matchScoreB} onChange={e => setMatchScoreB(e.target.value)} placeholder="0" className="flex-1 rounded-lg border border-gray-200 px-2 py-2.5 text-center text-xl font-bold" />
            </div>
            <input value={matchStage} onChange={e => setMatchStage(e.target.value)} placeholder="Stage (e.g. Group Stage)" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            <input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
          </div>

          {content.matches.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Previous results</p>
              {content.matches.map(m => {
                const tA = content.teams.find(t => t.id === m.teamAId);
                const tB = content.teams.find(t => t.id === m.teamBId);
                return (
                  <div key={m.id} data-testid={`match-row-${m.id}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <span>{tA?.flagEmoji ? `${tA.flagEmoji} ` : ''}{tA?.name ?? m.teamAId} {m.scoreA ?? '–'} – {m.scoreB ?? '–'} {tB?.flagEmoji ? `${tB.flagEmoji} ` : ''}{tB?.name ?? m.teamBId}</span>
                    <button data-testid={`delete-match-${m.id}`} onClick={() => deleteMatch(m.id)} className="text-base leading-none text-red-500">×</button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5">
            <button
              data-testid="save-match-btn"
              onClick={saveMatch}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
            >
              Save result
            </button>
          </div>
        </>
      );
    }

    // ── LOCK CONFIRM ────────────────────────────────────────────────────────────
    if (sheetView === 'lockConfirm') {
      return (
        <>
          <SheetHeader title="⚠️ Lock draw?" onBack={() => setSheetView('manage')} />
          <div
            data-testid="lock-confirm-view"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2"
          >
            <p className="text-sm font-semibold text-amber-900">
              These teams may not be official yet.
            </p>
            <p className="text-xs text-amber-700">
              {content.teamsSource === 'incomplete_canonical'
                ? 'World Cup teams are still loading — this pool is using demo teams.'
                : 'This pool is using a demo team list. Check teams before locking.'}
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <button
              data-testid="confirm-lock-btn"
              onClick={() => { update({ drawLocked: true }); setSheetView(null); }}
              className="w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white active:bg-amber-700"
            >
              Lock draw anyway
            </button>
            <button
              onClick={() => setSheetView('manage')}
              className="w-full rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700"
            >
              Cancel
            </button>
          </div>
        </>
      );
    }

    return null;
  }

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-4">

      {/* ── Hero card — FIFA dark navy + gold ───────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-yellow-400/35">
        <div className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-5 overflow-hidden">

          {/* Stadium arc decorations */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-96 h-48 rounded-t-full border-2 border-white/10 pointer-events-none" />
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-60 h-28 rounded-t-full border border-white/10 pointer-events-none" />
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full border-4 border-white/5 pointer-events-none" />
          <div className="absolute -right-2 top-10 w-18 h-18 rounded-full border-2 border-white/5 pointer-events-none" />

          {/* Top row: host flags + manage button */}
          <div className="relative z-10 flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
              <span className="text-sm leading-none">🇺🇸</span>
              <span className="text-sm leading-none">🇨🇦</span>
              <span className="text-sm leading-none">🇲🇽</span>
              <span className="text-xs text-white/60 font-semibold ml-1">2026</span>
            </div>
            <button
              data-testid="manage-pool-btn"
              onClick={() => setSheetView('manage')}
              className="flex-shrink-0 bg-yellow-400 text-slate-900 text-xs font-black px-3 py-1.5 rounded-full active:bg-yellow-300 transition-colors"
            >
              Manage pool
            </button>
          </div>

          {/* Trophy + pool name */}
          <div className="relative z-10 flex items-center gap-3 mb-4">
            <span className="text-5xl leading-none flex-shrink-0">🏆</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="h-px w-6 bg-yellow-400" />
                <div className="h-px w-3 bg-yellow-400/40" />
              </div>
              {editingPoolName ? (
                <input
                  ref={poolNameInputRef}
                  data-testid="pool-name-input"
                  value={poolNameDraft}
                  onChange={e => setPoolNameDraft(e.target.value)}
                  onBlur={commitPoolName}
                  onKeyDown={e => { if (e.key === 'Enter') commitPoolName(); if (e.key === 'Escape') { setPoolNameDraft(content.poolName); setEditingPoolName(false); } }}
                  className="w-full rounded-lg bg-white/20 px-2 py-0.5 text-xl font-black text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
                  autoFocus
                />
              ) : (
                <button
                  data-testid="pool-name-btn"
                  onClick={() => { setPoolNameDraft(content.poolName); setEditingPoolName(true); setTimeout(() => poolNameInputRef.current?.select(), 0); }}
                  className="flex items-center gap-1.5 text-left active:opacity-70 w-full"
                >
                  <h2 className="truncate text-xl font-black text-white">{content.poolName}</h2>
                  <span className="shrink-0 text-sm opacity-50">✏️</span>
                </button>
              )}
              <p className="text-yellow-400 text-xs font-semibold tracking-wide uppercase mt-0.5">{content.tournamentName}</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="relative z-10 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2.5">
              <p className="text-white/50 text-xs mb-0.5">Draw</p>
              <p className="font-bold text-white text-sm">{drawStatus}</p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2.5">
              <p className="text-white/50 text-xs mb-0.5">Players</p>
              <p className="font-bold text-white text-sm">{content.participants.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2.5">
              <p className="text-white/50 text-xs mb-0.5">Teams</p>
              <p className="font-bold text-white text-sm">{assignedCount}/{content.teams.length} assigned</p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2.5">
              <p className="text-white/50 text-xs mb-0.5">Share</p>
              <p className="font-bold text-white text-sm">{hasShareLink ? '🟢 Live' : 'Not shared'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Teams source status banner */}
      {content.teamsSource === 'official' && (
        <div
          data-testid="teams-source-banner"
          className="rounded-2xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-medium text-green-700"
        >
          ✅ Official teams loaded
        </div>
      )}
      {content.teamsSource === 'demo_fallback' && (
        <div
          data-testid="teams-source-banner"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-700"
        >
          ⚠️ Using demo team list — check teams before locking draw
        </div>
      )}
      {content.teamsSource === 'incomplete_canonical' && (
        <div
          data-testid="teams-source-banner"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-700"
        >
          ⏳ World Cup teams are still loading — using demo teams for now
        </div>
      )}

      {/* SmartGuidance */}
      <SmartGuidance guidance={poolGuidance} onAction={handleAction} />

      {/* ── Leaderboard ─────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-yellow-400/20">
        {/* Dark navy header */}
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 px-4 py-3 flex items-center gap-2">
          <span className="text-base">🏆</span>
          <h3 className="text-sm font-black text-white tracking-wide">Leaderboard</h3>
        </div>
        {leaderboard.length === 0 ? (
          <p className="bg-white px-4 py-8 text-center text-sm text-gray-400">Add participants to see the leaderboard.</p>
        ) : (
          <div className="bg-white divide-y divide-gray-50">
            {leaderboard.map((row, i) => {
              const topThree = row.teams
                .slice(0, 3)
                .map(t => `${t.flagEmoji ?? ''} ${t.name}`.trim())
                .join(' · ');
              return (
                <button
                  key={row.participant.id}
                  data-testid={`leaderboard-row-${row.participant.id}`}
                  onClick={() => setParticipantSheetId(row.participant.id)}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-yellow-400/5 active:bg-yellow-400/10"
                >
                  <div data-testid={`participant-row-${row.participant.id}`} className="flex items-center gap-3">
                    <span className="w-6 text-center text-base">{MEDAL[i] ?? `#${i + 1}`}</span>
                    <span className="w-8 text-center text-xl">{row.participant.emoji ?? '👤'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{row.participant.name}</p>
                      <p className="truncate text-xs text-gray-500">{topThree || 'No teams yet'}</p>
                      <p className="mt-0.5 text-[11px] text-gray-400">{row.teams.length} teams · {row.activeTeams} active</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-yellow-500">{row.points} pts</p>
                      <p className="text-[11px] text-gray-400">Tap for details</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Teams ───────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-yellow-400/20">
        {/* Dark navy header */}
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 px-4 py-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <span>⚽</span> Teams
          </h3>
          <button
            data-testid="view-all-teams-btn"
            onClick={() => setShowAllTeams(v => !v)}
            className="bg-yellow-400 text-slate-900 text-xs font-black px-3 py-1.5 rounded-full active:bg-yellow-300 transition-colors"
          >
            {showAllTeams ? 'Hide teams' : 'View all teams'}
          </button>
        </div>
        {!showAllTeams ? (
          <p data-testid="teams-collapsed-hint" className="bg-white px-4 py-3 text-xs text-gray-500">
            Tap "View all teams" to open the full team list.
          </p>
        ) : (
          <div data-testid="all-teams-list" className="bg-white flex flex-wrap gap-2 p-4">
            {content.teams.map(team => (
              <div key={team.id} className="rounded-xl border border-yellow-200 bg-yellow-50 px-2.5 py-1.5 text-xs text-gray-700">
                {team.flagEmoji ?? '🏳'} {team.name} · Pot {team.pot}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Participant detail sheet (independent of manage sheet) */}
      {participantDetails && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => setParticipantSheetId(null)}>
          <div className="absolute inset-0 bg-black/35" />
          <div
            data-testid="participant-detail-sheet"
            className="relative z-10 max-h-[78dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {renamingParticipantId === participantDetails.participant.id ? (
                  <div className="flex gap-2">
                    <input
                      data-testid="rename-participant-input"
                      value={renameDraft}
                      onChange={e => setRenameDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitRenameParticipant(); if (e.key === 'Escape') setRenamingParticipantId(null); }}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-lg font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
                      autoFocus
                    />
                    <button
                      data-testid="rename-participant-save"
                      onClick={commitRenameParticipant}
                      className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setRenamingParticipantId(null)}
                      className="rounded-lg bg-gray-100 px-2 py-1.5 text-sm font-semibold text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-gray-900">{participantDetails.participant.name}</h3>
                    <button
                      data-testid="rename-participant-btn"
                      onClick={() => startRenameParticipant(participantDetails.participant)}
                      className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 active:bg-gray-200"
                    >
                      Rename
                    </button>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-1 text-sm font-semibold" style={{ color: accentText }}>
              {participantDetails.points} pts · {participantDetails.teams.length} teams
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl p-3 text-xs text-gray-600" style={{ backgroundColor: accentBg, border: `1px solid ${accentBg40}` }}>Wins: <span className="font-bold" style={{ color: accentText }}>{participantDetails.wins}</span></div>
              <div className="rounded-xl p-3 text-xs text-gray-600" style={{ backgroundColor: accentBg, border: `1px solid ${accentBg40}` }}>Draws: <span className="font-bold" style={{ color: accentText }}>{participantDetails.draws}</span></div>
            </div>
            {[1, 2, 3, 4].map(pot => {
              const teams = participantDetails.teams.filter(t => t.pot === pot);
              if (teams.length === 0) return null;
              return (
                <div key={pot} className="mt-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: accentText }}>Pot {pot}</p>
                  <div className="mt-2 space-y-2">
                    {teams.map(team => (
                      <div
                        key={team.id}
                        data-testid={`participant-detail-team-${team.id}`}
                        className="flex items-center justify-between rounded-xl px-3 py-2 text-sm"
                        style={{ backgroundColor: accentBg, border: `1px solid ${accentBg40}` }}
                      >
                        <span className="font-medium text-gray-800">{team.flagEmoji ?? '🏳'} {team.name}</span>
                        <span className="text-xs text-gray-500">{team.status.replaceAll('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="mt-4">
              <button
                onClick={() => setParticipantSheetId(null)}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single manage sheet — all sub-views rendered here */}
      {sheetView !== null && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => setSheetView(null)}>
          <div className="absolute inset-0 bg-black/35" />
          <div
            data-testid="manage-pool-sheet"
            className="relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4"
            onClick={e => e.stopPropagation()}
          >
            {renderSheetContent()}
          </div>
        </div>
      )}
    </div>
  );
}

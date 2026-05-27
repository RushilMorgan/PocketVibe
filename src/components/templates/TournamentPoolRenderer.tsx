import React, { useState } from 'react';
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
import { THEMES, getPoolGradient } from '../../lib/themes';

interface Props {
  content: TournamentPoolTrackerContent;
  onChange: (updated: TournamentPoolTrackerContent) => void;
  onShare?: () => void;
  hasShareLink?: boolean;
}

// ── Score calculation ─────────────────────────────────────────────────────────

interface ParticipantScore {
  participant: TournamentParticipant;
  teams: TournamentTeam[];
  points: number;
  wins: number;
  draws: number;
}

function calcScores(content: TournamentPoolTrackerContent): ParticipantScore[] {
  const { participants, teams, matches, scoringRules: r } = content;
  return participants
    .map(p => {
      const myTeams = teams.filter(t => t.assignedTo === p.id);
      const myIds = new Set(myTeams.map(t => t.id));
      let points = 0, wins = 0, draws = 0;
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
          case 'round_of_16': points += r.knockoutBonus; break;
          case 'quarter_final': points += r.quarterFinalBonus; break;
          case 'semi_final': points += r.semiFinalBonus; break;
          case 'final': points += r.finalBonus; break;
          case 'winner': points += r.winnerBonus; break;
        }
      }
      return { participant: p, teams: myTeams, points, wins, draws };
    })
    .sort((a, b) => b.points - a.points);
}

// ── Draw helpers ──────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextParticipantIndex(
  participants: TournamentParticipant[],
  teams: TournamentTeam[],
): number {
  const counts = participants.map((p, i) => ({
    i,
    count: teams.filter(t => t.assignedTo === p.id).length,
  }));
  return counts.reduce((min, cur) => (cur.count < min.count ? cur : min)).i;
}

let _uid = 0;
function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_uid}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TournamentPoolRenderer({ content, onChange, onShare, hasShareLink = false }: Props) {
  const update = (patch: Partial<TournamentPoolTrackerContent>) =>
    onChange({ ...content, ...patch });

  // ── Edit panel ──
  const [editMode, setEditMode] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);

  // Pool setup
  const [editPoolName, setEditPoolName] = useState(content.poolName);
  const [editTournamentName, setEditTournamentName] = useState(content.tournamentName);
  const [editPrizeNote, setEditPrizeNote] = useState(content.prizeNote ?? '');
  const [editAdminName, setEditAdminName] = useState(content.adminName ?? '');
  const [editRulesNote, setEditRulesNote] = useState(content.rulesNote ?? '');

  // Participants
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantEmoji, setNewParticipantEmoji] = useState('');
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [editParticipantName, setEditParticipantName] = useState('');
  const [editParticipantEmoji, setEditParticipantEmoji] = useState('');

  // Teams
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

  // Scoring
  const [editScoring, setEditScoring] = useState<TournamentScoringRules>({ ...content.scoringRules });
  const [scoringDirty, setScoringDirty] = useState(false);

  // Matches
  const [addingMatch, setAddingMatch] = useState(false);
  const [matchTeamA, setMatchTeamA] = useState('');
  const [matchTeamB, setMatchTeamB] = useState('');
  const [matchScoreA, setMatchScoreA] = useState('');
  const [matchScoreB, setMatchScoreB] = useState('');
  const [matchDate, setMatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [matchStage, setMatchStage] = useState('Group Stage');

  // Draw
  const [resetConfirm, setResetConfirm] = useState(false);

  // Derived
  const leaderboard = calcScores(content);
  const unassignedTeams = content.teams.filter(t => !t.assignedTo);
  const pots = [...new Set(content.teams.map(t => t.pot))].sort((a, b) => a - b);

  // ── Edit panel open ──
  function openEditMode() {
    setEditPoolName(content.poolName);
    setEditTournamentName(content.tournamentName);
    setEditPrizeNote(content.prizeNote ?? '');
    setEditAdminName(content.adminName ?? '');
    setEditRulesNote(content.rulesNote ?? '');
    setEditScoring({ ...content.scoringRules });
    setScoringDirty(false);
    setAddingParticipant(false);
    setAddingTeam(false);
    setEditingParticipantId(null);
    setEditingTeamId(null);
    setEditMode(true);
  }

  function saveSetup() {
    update({
      poolName: editPoolName.trim() || content.poolName,
      tournamentName: editTournamentName.trim() || content.tournamentName,
      prizeNote: editPrizeNote.trim() || undefined,
      adminName: editAdminName.trim() || undefined,
      rulesNote: editRulesNote.trim() || undefined,
    });
  }

  // ── Draw ──
  function drawOne() {
    if (content.participants.length === 0) return;
    const unassigned = shuffle(content.teams.filter(t => !t.assignedTo));
    if (unassigned.length === 0) return;
    const pickedTeam = unassigned[0];
    const pidx = nextParticipantIndex(content.participants, content.teams);
    update({
      teams: content.teams.map(t =>
        t.id === pickedTeam.id ? { ...t, assignedTo: content.participants[pidx].id } : t,
      ),
    });
  }

  function drawAll() {
    if (content.participants.length === 0) return;
    const unassigned = shuffle(content.teams.filter(t => !t.assignedTo));
    if (unassigned.length === 0) return;
    let pidx = nextParticipantIndex(content.participants, content.teams);
    const assignment = new Map<string, string>();
    for (const team of unassigned) {
      assignment.set(team.id, content.participants[pidx].id);
      pidx = (pidx + 1) % content.participants.length;
    }
    update({
      teams: content.teams.map(t =>
        assignment.has(t.id) ? { ...t, assignedTo: assignment.get(t.id) } : t,
      ),
    });
  }

  function drawByPot() {
    if (content.participants.length === 0) return;
    const teams = [...content.teams];
    for (const pot of pots) {
      const potTeams = shuffle(teams.filter(t => t.pot === pot && !t.assignedTo));
      potTeams.forEach((team, i) => {
        const participant = content.participants[i % content.participants.length];
        const idx = teams.findIndex(t => t.id === team.id);
        if (idx >= 0) teams[idx] = { ...teams[idx], assignedTo: participant.id };
      });
    }
    update({ teams });
  }

  function lockDraw() {
    update({ drawLocked: true });
  }

  function resetDraw() {
    update({
      teams: content.teams.map(({ assignedTo: _a, ...rest }) => rest as TournamentTeam),
      drawLocked: false,
    });
    setResetConfirm(false);
  }

  // ── Participants ──
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

  // ── Teams ──
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

  function deleteTeam(id: string) {
    update({
      teams: content.teams.filter(t => t.id !== id),
      matches: content.matches.filter(m => m.teamAId !== id && m.teamBId !== id),
    });
  }

  function updateTeamStatus(id: string, status: TournamentTeam['status']) {
    update({ teams: content.teams.map(t => (t.id === id ? { ...t, status } : t)) });
  }

  function openEditTeam(t: TournamentTeam) {
    setEditingTeamId(t.id);
    setEditTeamName(t.name);
    setEditTeamPot(String(t.pot));
    setEditTeamGroup(t.group ?? '');
    setEditTeamFlag(t.flagEmoji ?? '');
    setEditTeamStatus(t.status);
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

  // ── Matches ──
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
    setMatchDate(new Date().toISOString().slice(0, 10));
    setMatchStage('Group Stage');
    setAddingMatch(false);
  }

  function deleteMatch(id: string) {
    update({ matches: content.matches.filter(m => m.id !== id) });
  }

  // ── Scoring ──
  function saveScoring() {
    update({ scoringRules: editScoring });
    setScoringDirty(false);
  }

  // ── Team name helper ──
  function teamLabel(id: string): string {
    const t = content.teams.find(x => x.id === id);
    return t ? `${t.flagEmoji ?? ''} ${t.name}`.trim() : id;
  }

  const MEDAL = ['🥇', '🥈', '🥉'];

  // ── Smart Guidance ────────────────────────────────────────────────────────
  const poolGuidance = computePoolGuidance(content, hasShareLink);

  function handleAction(id: string) {
    switch (id) {
      case 'add-people':      openEditMode(); break;
      case 'run-draw-all':    drawAll();      break;
      case 'run-draw-by-pot': drawByPot();   break;
      case 'lock-draw':       lockDraw();    break;
      case 'edit-scoring':    openEditMode(); break;
      case 'change-theme':    setThemePickerOpen(true); break;
      case 'share':           onShare?.();   break;
      default: break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  // Derived setup checklist state
  const allTeamsAssigned = content.teams.length > 0 && unassignedTeams.length === 0 && content.participants.length > 0;

  return (
    <div className="flex flex-col gap-4 p-4 relative">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className={`bg-gradient-to-br ${getPoolGradient(content.colourTheme)} rounded-2xl p-5 text-white`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{content.poolName}</h2>
            <p className="text-sm opacity-90 mt-0.5">{content.tournamentName}</p>
            {content.prizeNote && (
              <p className="text-xs opacity-75 mt-0.5">🏆 {content.prizeNote}</p>
            )}
          </div>
          <button
            data-testid="edit-pool-btn"
            onClick={openEditMode}
            className="flex-shrink-0 text-xs font-semibold bg-white/20 text-white px-3 py-1.5 rounded-full active:bg-white/30"
          >
            Edit pool
          </button>
        </div>
        {content.drawLocked && (
          <span className="mt-2 inline-block text-xs bg-white/20 px-2 py-0.5 rounded-full">
            🔒 Draw locked
          </span>
        )}
      </div>

      {/* ── Smart Guidance ────────────────────────────────────────────────── */}
      <SmartGuidance guidance={poolGuidance} onAction={handleAction} />

      {/* ── Theme picker (opens via quick action) ────────────────────────── */}
      {themePickerOpen && (
        <div data-testid="theme-picker" className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Choose a theme</h3>
            <button onClick={() => setThemePickerOpen(false)} className="text-gray-400 text-xl leading-none">×</button>
          </div>
          <div className="flex gap-4 flex-wrap">
            {THEMES.map(theme => (
              <button
                key={theme.id}
                data-testid={`theme-${theme.id}`}
                onClick={() => { update({ colourTheme: theme.id as ColourTheme }); setThemePickerOpen(false); }}
                className="flex flex-col items-center gap-1.5"
              >
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${theme.gradient}
                  ${content.colourTheme === theme.id ? 'ring-2 ring-offset-2 ring-gray-800' : ''}`} />
                <span className="text-xs text-gray-600">{theme.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Draw section ──────────────────────────────────────────────────── */}
      {!content.drawLocked && content.participants.length > 0 && content.teams.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            Draw{unassignedTeams.length > 0
              ? ` · ${unassignedTeams.length} team${unassignedTeams.length !== 1 ? 's' : ''} remaining`
              : ' · All teams assigned'}
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              data-testid="draw-one-btn"
              onClick={drawOne}
              disabled={unassignedTeams.length === 0}
              className="text-xs font-semibold bg-yellow-500 text-white px-3 py-2 rounded-xl active:bg-yellow-600 disabled:opacity-40"
            >
              Draw one
            </button>
            <button
              data-testid="draw-all-btn"
              onClick={drawAll}
              disabled={unassignedTeams.length === 0}
              className="text-xs font-semibold bg-orange-500 text-white px-3 py-2 rounded-xl active:bg-orange-600 disabled:opacity-40"
            >
              Draw all
            </button>
            <button
              data-testid="draw-by-pot-btn"
              onClick={drawByPot}
              disabled={unassignedTeams.length === 0}
              className="text-xs font-semibold bg-amber-500 text-white px-3 py-2 rounded-xl active:bg-amber-600 disabled:opacity-40"
            >
              Draw by pot
            </button>
            <button
              data-testid="lock-draw-btn"
              onClick={lockDraw}
              className="text-xs font-semibold bg-green-500 text-white px-3 py-2 rounded-xl active:bg-green-600"
            >
              🔒 Lock draw
            </button>
            {resetConfirm ? (
              <>
                <button
                  data-testid="confirm-reset-draw-btn"
                  onClick={resetDraw}
                  className="text-xs font-semibold bg-red-500 text-white px-3 py-2 rounded-xl"
                >
                  Confirm reset
                </button>
                <button
                  onClick={() => setResetConfirm(false)}
                  className="text-xs text-gray-500 px-3 py-2 rounded-xl border border-gray-200"
                >
                  Cancel
                </button>
              </>
            ) : (
              content.teams.some(t => t.assignedTo) && (
                <button
                  data-testid="reset-draw-btn"
                  onClick={() => setResetConfirm(true)}
                  className="text-xs font-semibold text-red-500 px-3 py-2 rounded-xl border border-red-100 active:bg-red-50"
                >
                  Reset draw
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* ── Leaderboard ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">Leaderboard</h3>
        </div>
        {leaderboard.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-400 text-center">
            Add participants to see the leaderboard.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {leaderboard.map((row, i) => (
              <div
                key={row.participant.id}
                data-testid={`leaderboard-row-${row.participant.id}`}
                className="px-4 py-3 flex items-center gap-3"
              >
                <span className="text-base w-6 text-center">
                  {MEDAL[i] ?? <span className="text-sm font-bold text-gray-400">{i + 1}</span>}
                </span>
                <span className="text-xl w-8 text-center">{row.participant.emoji ?? '👤'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{row.participant.name}</p>
                  {row.teams.length > 0 && (
                    <p className="text-xs text-gray-500 truncate">
                      {row.teams.map(t => `${t.flagEmoji ?? ''} ${t.name}`.trim()).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-800">{row.points} pts</p>
                  {row.teams.length > 0 && (
                    <p className="text-xs text-gray-400">
                      {row.teams.length} team{row.teams.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Match results ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Match results</h3>
          <button
            data-testid="add-match-btn"
            onClick={() => {
              setAddingMatch(v => !v);
              setMatchTeamA('');
              setMatchTeamB('');
              setMatchScoreA('');
              setMatchScoreB('');
            }}
            className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-full active:bg-yellow-100"
          >
            + Add result
          </button>
        </div>

        {addingMatch && (
          <div className="px-4 py-3 border-b border-gray-50 bg-gray-50 flex flex-col gap-3">
            <div className="flex gap-2">
              <select
                data-testid="match-team-a-select"
                value={matchTeamA}
                onChange={e => setMatchTeamA(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white"
              >
                <option value="">Team A</option>
                {content.teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.flagEmoji} {t.name}
                  </option>
                ))}
              </select>
              <span className="self-center text-xs text-gray-400 font-bold">vs</span>
              <select
                data-testid="match-team-b-select"
                value={matchTeamB}
                onChange={e => setMatchTeamB(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white"
              >
                <option value="">Team B</option>
                {content.teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.flagEmoji} {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 items-center">
              <input
                data-testid="match-score-a-input"
                type="number"
                min="0"
                value={matchScoreA}
                onChange={e => setMatchScoreA(e.target.value)}
                placeholder="0"
                className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-2 text-center"
              />
              <span className="text-xs text-gray-400">–</span>
              <input
                data-testid="match-score-b-input"
                type="number"
                min="0"
                value={matchScoreB}
                onChange={e => setMatchScoreB(e.target.value)}
                placeholder="0"
                className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-2 text-center"
              />
              <input
                value={matchStage}
                onChange={e => setMatchStage(e.target.value)}
                placeholder="Stage"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-2"
              />
              <input
                type="date"
                value={matchDate}
                onChange={e => setMatchDate(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-2"
              />
            </div>
            <div className="flex gap-2">
              <button
                data-testid="save-match-btn"
                onClick={saveMatch}
                disabled={!matchTeamA || !matchTeamB || matchTeamA === matchTeamB}
                className="text-xs font-semibold bg-yellow-500 text-white px-4 py-2 rounded-xl disabled:opacity-40"
              >
                Save result
              </button>
              <button
                onClick={() => setAddingMatch(false)}
                className="text-xs text-gray-500 px-4 py-2 rounded-xl border border-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {content.matches.length === 0 && !addingMatch ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No results yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {content.matches.map(m => {
              const a = content.teams.find(t => t.id === m.teamAId);
              const b = content.teams.find(t => t.id === m.teamBId);
              return (
                <div
                  key={m.id}
                  data-testid={`match-row-${m.id}`}
                  className="px-4 py-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0 text-sm text-gray-800">
                    <span className="font-medium">{teamLabel(m.teamAId)}</span>
                    {m.scoreA !== undefined && m.scoreB !== undefined && (
                      <span className="mx-2 text-gray-500 font-bold tabular-nums">
                        {m.scoreA}–{m.scoreB}
                      </span>
                    )}
                    <span className="font-medium">{a ? '' : ''}{teamLabel(m.teamBId)}</span>
                  </div>
                  {m.stage && <span className="text-xs text-gray-400 flex-shrink-0">{m.stage}</span>}
                  <button
                    data-testid={`delete-match-${m.id}`}
                    onClick={() => deleteMatch(m.id)}
                    className="text-red-400 hover:text-red-600 text-lg leading-none p-1 flex-shrink-0"
                    aria-label="Delete result"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Teams by pot ──────────────────────────────────────────────────── */}
      {pots.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-800">Teams</h3>
          </div>
          <div className="p-4 flex flex-col gap-4">
            {pots.map(pot => (
              <div key={pot}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Pot {pot}
                </p>
                <div className="flex flex-wrap gap-2">
                  {content.teams
                    .filter(t => t.pot === pot)
                    .map(team => {
                      const owner = team.assignedTo
                        ? content.participants.find(p => p.id === team.assignedTo)
                        : null;
                      return (
                        <div
                          key={team.id}
                          className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border ${
                            team.status === 'eliminated'
                              ? 'opacity-40 border-gray-100 bg-gray-50 line-through'
                              : team.status === 'winner'
                              ? 'border-yellow-200 bg-yellow-50 text-yellow-700 font-semibold'
                              : 'border-gray-100 bg-gray-50'
                          }`}
                        >
                          {team.flagEmoji && <span>{team.flagEmoji}</span>}
                          <span>{team.name}</span>
                          {team.group && <span className="text-gray-400">({team.group})</span>}
                          {owner && (
                            <span className="text-gray-500">· {owner.emoji ?? ''}{owner.name}</span>
                          )}
                          {team.status === 'winner' && <span>🏆</span>}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit panel ────────────────────────────────────────────────────── */}
      {editMode && (
        <div
          className="fixed inset-0 z-40 flex"
          onClick={() => setEditMode(false)}
        >
          <div className="flex-1 bg-black/20" />
          <div
            className="w-full max-w-sm bg-white shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between z-10">
              <h3 className="text-base font-bold text-gray-900">Edit pool</h3>
              <button
                onClick={() => setEditMode(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg"
                aria-label="Close edit panel"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex flex-col gap-6">

              {/* ── Pool setup ── */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Pool setup
                </h4>
                <div className="flex flex-col gap-2">
                  <input
                    data-testid="pool-name-input"
                    value={editPoolName}
                    onChange={e => setEditPoolName(e.target.value)}
                    onBlur={saveSetup}
                    placeholder="Pool name"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                  />
                  <input
                    data-testid="tournament-name-input"
                    value={editTournamentName}
                    onChange={e => setEditTournamentName(e.target.value)}
                    onBlur={saveSetup}
                    placeholder="Tournament name"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                  />
                  <input
                    data-testid="prize-note-input"
                    value={editPrizeNote}
                    onChange={e => setEditPrizeNote(e.target.value)}
                    onBlur={saveSetup}
                    placeholder="Prize note (e.g. Bragging rights + dinner)"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                  />
                  <input
                    data-testid="rules-note-input"
                    value={editRulesNote}
                    onChange={e => setEditRulesNote(e.target.value)}
                    onBlur={saveSetup}
                    placeholder="Rules (optional)"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                  />
                </div>
              </section>

              {/* ── Participants ── */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Participants
                </h4>
                <div className="flex flex-col gap-2">
                  {content.participants.map(p => (
                    <div key={p.id}>
                      {editingParticipantId === p.id ? (
                        <div className="flex gap-2">
                          <input
                            data-testid={`edit-participant-name-${p.id}`}
                            value={editParticipantName}
                            onChange={e => setEditParticipantName(e.target.value)}
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2"
                          />
                          <input
                            data-testid={`edit-participant-emoji-${p.id}`}
                            value={editParticipantEmoji}
                            onChange={e => setEditParticipantEmoji(e.target.value)}
                            className="w-14 text-sm border border-gray-200 rounded-lg px-2 py-2 text-center"
                            placeholder="😀"
                          />
                          <button
                            data-testid={`save-participant-${p.id}`}
                            onClick={saveParticipant}
                            className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-2 rounded-lg"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingParticipantId(null)}
                            className="text-xs text-gray-500 px-2 py-2 rounded-lg border border-gray-200"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-base w-7">{p.emoji ?? '👤'}</span>
                          <span className="flex-1 text-sm text-gray-800">{p.name}</span>
                          <button
                            data-testid={`edit-participant-btn-${p.id}`}
                            onClick={() => openEditParticipant(p)}
                            className="text-xs text-blue-500 px-2 py-1 rounded-lg active:bg-blue-50"
                          >
                            Edit
                          </button>
                          <button
                            data-testid={`delete-participant-${p.id}`}
                            onClick={() => deleteParticipant(p.id)}
                            className="text-red-400 hover:text-red-600 text-lg leading-none p-1"
                            aria-label="Delete participant"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {addingParticipant ? (
                    <div className="flex gap-2">
                      <input
                        data-testid="new-participant-name"
                        value={newParticipantName}
                        onChange={e => setNewParticipantName(e.target.value)}
                        placeholder="Name"
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2"
                      />
                      <input
                        value={newParticipantEmoji}
                        onChange={e => setNewParticipantEmoji(e.target.value)}
                        className="w-14 text-sm border border-gray-200 rounded-lg px-2 py-2 text-center"
                        placeholder="😀"
                      />
                      <button
                        data-testid="save-participant-btn"
                        onClick={addParticipant}
                        className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-2 rounded-lg"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setAddingParticipant(false);
                          setNewParticipantName('');
                        }}
                        className="text-xs text-gray-500 px-2 py-2 rounded-lg border border-gray-200"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      data-testid="add-participant-btn"
                      onClick={() => setAddingParticipant(true)}
                      className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-4 py-2 rounded-xl active:bg-yellow-100 text-left"
                    >
                      + Add participant
                    </button>
                  )}
                </div>
              </section>

              {/* ── Teams ── */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Teams
                </h4>
                <div className="flex flex-col gap-1">
                  {pots.map(pot => (
                    <div key={pot} className="mb-2">
                      <p className="text-xs text-gray-400 mb-1">Pot {pot}</p>
                      {content.teams
                        .filter(t => t.pot === pot)
                        .map(team =>
                          editingTeamId === team.id ? (
                            <div key={team.id} className="flex flex-col gap-2 py-1 border border-blue-100 rounded-xl p-2">
                              <div className="flex gap-2">
                                <input
                                  data-testid={`edit-team-name-${team.id}`}
                                  value={editTeamName}
                                  onChange={e => setEditTeamName(e.target.value)}
                                  placeholder="Team name"
                                  className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                                />
                                <input
                                  data-testid={`edit-team-flag-${team.id}`}
                                  value={editTeamFlag}
                                  onChange={e => setEditTeamFlag(e.target.value)}
                                  placeholder="🏳️"
                                  className="w-12 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center"
                                />
                              </div>
                              <div className="flex gap-2 flex-wrap items-center">
                                <label className="text-xs text-gray-500">Pot</label>
                                <input
                                  data-testid={`edit-team-pot-${team.id}`}
                                  type="number"
                                  min="1"
                                  max="8"
                                  value={editTeamPot}
                                  onChange={e => setEditTeamPot(e.target.value)}
                                  className="w-14 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center"
                                />
                                <label className="text-xs text-gray-500">Group</label>
                                <input
                                  data-testid={`edit-team-group-${team.id}`}
                                  value={editTeamGroup}
                                  onChange={e => setEditTeamGroup(e.target.value)}
                                  placeholder="A"
                                  className="w-12 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center uppercase"
                                />
                                <select
                                  data-testid={`edit-team-status-${team.id}`}
                                  value={editTeamStatus}
                                  onChange={e => setEditTeamStatus(e.target.value as TournamentTeam['status'])}
                                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                                >
                                  <option value="active">Active</option>
                                  <option value="round_of_16">Round of 16</option>
                                  <option value="quarter_final">Quarter-final</option>
                                  <option value="semi_final">Semi-final</option>
                                  <option value="final">Final</option>
                                  <option value="winner">Winner 🏆</option>
                                  <option value="eliminated">Eliminated</option>
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  data-testid={`save-team-edit-${team.id}`}
                                  onClick={saveTeamEdit}
                                  className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingTeamId(null)}
                                  className="text-xs text-gray-500 px-2 py-1.5 rounded-lg border border-gray-200"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div key={team.id} className="flex items-center gap-2 py-1">
                              {team.flagEmoji && <span>{team.flagEmoji}</span>}
                              <span className="flex-1 text-sm text-gray-800">{team.name}</span>
                              <select
                                data-testid={`team-status-${team.id}`}
                                value={team.status}
                                onChange={e =>
                                  updateTeamStatus(team.id, e.target.value as TournamentTeam['status'])
                                }
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                              >
                                <option value="active">Active</option>
                                <option value="round_of_16">Round of 16</option>
                                <option value="quarter_final">Quarter-final</option>
                                <option value="semi_final">Semi-final</option>
                                <option value="final">Final</option>
                                <option value="winner">Winner 🏆</option>
                                <option value="eliminated">Eliminated</option>
                              </select>
                              <button
                                data-testid={`edit-team-btn-${team.id}`}
                                onClick={() => openEditTeam(team)}
                                className="text-xs text-blue-500 px-2 py-1 rounded-lg active:bg-blue-50"
                              >
                                Edit
                              </button>
                              <button
                                data-testid={`delete-team-${team.id}`}
                                onClick={() => deleteTeam(team.id)}
                                className="text-red-400 hover:text-red-600 text-lg leading-none p-1"
                                aria-label="Delete team"
                              >
                                ×
                              </button>
                            </div>
                          )
                        )}
                    </div>
                  ))}

                  {addingTeam ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <div className="flex gap-2">
                        <input
                          data-testid="new-team-name"
                          value={newTeamName}
                          onChange={e => setNewTeamName(e.target.value)}
                          placeholder="Team name"
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2"
                        />
                        <input
                          value={newTeamFlag}
                          onChange={e => setNewTeamFlag(e.target.value)}
                          placeholder="🏳️"
                          className="w-12 text-sm border border-gray-200 rounded-lg px-2 py-2 text-center"
                        />
                      </div>
                      <div className="flex gap-2 items-center">
                        <label className="text-xs text-gray-500 whitespace-nowrap">Pot</label>
                        <input
                          data-testid="new-team-pot"
                          type="number"
                          min="1"
                          max="8"
                          value={newTeamPot}
                          onChange={e => setNewTeamPot(e.target.value)}
                          className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-2 text-center"
                        />
                        <label className="text-xs text-gray-500 whitespace-nowrap">Group</label>
                        <input
                          value={newTeamGroup}
                          onChange={e => setNewTeamGroup(e.target.value)}
                          placeholder="A"
                          className="w-12 text-sm border border-gray-200 rounded-lg px-2 py-2 text-center uppercase"
                        />
                        <button
                          data-testid="save-team-btn"
                          onClick={addTeam}
                          className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-2 rounded-lg"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setAddingTeam(false);
                            setNewTeamName('');
                          }}
                          className="text-xs text-gray-500 px-2 py-2 rounded-lg border border-gray-200"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      data-testid="add-team-btn"
                      onClick={() => setAddingTeam(true)}
                      className="mt-1 text-xs font-semibold text-yellow-600 bg-yellow-50 px-4 py-2 rounded-xl active:bg-yellow-100 text-left"
                    >
                      + Add team
                    </button>
                  )}
                </div>
              </section>

              {/* ── Scoring rules ── */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Scoring rules
                </h4>
                <div className="flex flex-col gap-3">
                  {(
                    [
                      ['pointsPerWin', 'Points per win', 'points-per-win-input'],
                      ['pointsPerDraw', 'Points per draw', 'points-per-draw-input'],
                      ['knockoutBonus', 'Knockout bonus', 'knockout-bonus-input'],
                      ['quarterFinalBonus', 'Quarter-final bonus', 'quarter-final-bonus-input'],
                      ['semiFinalBonus', 'Semi-final bonus', 'semi-final-bonus-input'],
                      ['finalBonus', 'Final bonus', 'final-bonus-input'],
                      ['winnerBonus', 'Winner bonus', 'winner-bonus-input'],
                    ] as [keyof TournamentScoringRules, string, string][]
                  ).map(([key, label, testid]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <label className="text-sm text-gray-700">{label}</label>
                      <input
                        data-testid={testid}
                        type="number"
                        min="0"
                        value={editScoring[key]}
                        onChange={e => {
                          setEditScoring(s => ({ ...s, [key]: Number(e.target.value) }));
                          setScoringDirty(true);
                        }}
                        className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-2 text-center"
                      />
                    </div>
                  ))}
                  <button
                    data-testid="save-scoring-btn"
                    onClick={saveScoring}
                    className={`mt-1 text-xs font-semibold px-4 py-2 rounded-xl ${
                      scoringDirty
                        ? 'bg-yellow-500 text-white active:bg-yellow-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    Save scoring
                  </button>
                </div>
              </section>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

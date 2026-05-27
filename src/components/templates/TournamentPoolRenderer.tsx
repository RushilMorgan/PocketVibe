import React, { useMemo, useState } from 'react';
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

interface ParticipantScore {
  participant: TournamentParticipant;
  teams: TournamentTeam[];
  points: number;
  wins: number;
  draws: number;
  activeTeams: number;
}

const MEDAL = ['🥇', '🥈', '🥉'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextParticipantIndex(participants: TournamentParticipant[], teams: TournamentTeam[]): number {
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

function calcScores(content: TournamentPoolTrackerContent): ParticipantScore[] {
  const { participants, teams, matches, scoringRules: r } = content;
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
          if (aMe) {
            points += r.pointsPerWin;
            wins++;
          }
        } else if (m.scoreB > m.scoreA) {
          if (bMe) {
            points += r.pointsPerWin;
            wins++;
          }
        } else {
          if (aMe) {
            points += r.pointsPerDraw;
            draws++;
          }
          if (bMe) {
            points += r.pointsPerDraw;
            draws++;
          }
        }
      }

      for (const team of myTeams) {
        switch (team.status) {
          case 'round_of_16':
            points += r.knockoutBonus;
            break;
          case 'quarter_final':
            points += r.quarterFinalBonus;
            break;
          case 'semi_final':
            points += r.semiFinalBonus;
            break;
          case 'final':
            points += r.finalBonus;
            break;
          case 'winner':
            points += r.winnerBonus;
            break;
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

export function TournamentPoolRenderer({ content, onChange, onShare, hasShareLink = false }: Props) {
  const update = (patch: Partial<TournamentPoolTrackerContent>) => onChange({ ...content, ...patch });

  const [manageOpen, setManageOpen] = useState(false);
  const [participantSheetId, setParticipantSheetId] = useState<string | null>(null);
  const [showAllTeams, setShowAllTeams] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [drawReveal, setDrawReveal] = useState<string[]>([]);

  const [addingParticipant, setAddingParticipant] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantEmoji, setNewParticipantEmoji] = useState('');
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [editParticipantName, setEditParticipantName] = useState('');
  const [editParticipantEmoji, setEditParticipantEmoji] = useState('');

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

  const [addingMatch, setAddingMatch] = useState(false);
  const [matchTeamA, setMatchTeamA] = useState('');
  const [matchTeamB, setMatchTeamB] = useState('');
  const [matchScoreA, setMatchScoreA] = useState('');
  const [matchScoreB, setMatchScoreB] = useState('');
  const [matchDate, setMatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [matchStage, setMatchStage] = useState('Group Stage');

  const [editScoring, setEditScoring] = useState<TournamentScoringRules>({ ...content.scoringRules });
  const [scoringDirty, setScoringDirty] = useState(false);

  const leaderboard = useMemo(() => calcScores(content), [content]);
  const unassignedTeams = content.teams.filter(t => !t.assignedTo);
  const allTeamsAssigned = content.teams.length > 0 && unassignedTeams.length === 0 && content.participants.length > 0;
  const poolGuidance = computePoolGuidance(content, hasShareLink);

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

  function handleAction(id: string) {
    switch (id) {
      case 'add-people':
      case 'edit-scoring':
        setManageOpen(true);
        break;
      case 'run-draw-all':
        drawAll();
        break;
      case 'run-draw-by-pot':
        drawByPot();
        break;
      case 'lock-draw':
        lockDraw();
        break;
      case 'change-theme':
        setThemePickerOpen(true);
        break;
      case 'share':
        onShare?.();
        break;
    }
  }

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
        p.id === editingParticipantId ? { ...p, name, emoji: editParticipantEmoji.trim() || p.emoji } : p,
      ),
    });
    setEditingParticipantId(null);
  }

  function deleteParticipant(id: string) {
    update({
      participants: content.participants.filter(p => p.id !== id),
      teams: content.teams.map(t => (t.assignedTo === id ? { ...t, assignedTo: undefined } : t)),
    });
  }

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
    setAddingMatch(false);
    setMatchTeamA('');
    setMatchTeamB('');
    setMatchScoreA('');
    setMatchScoreB('');
  }

  function deleteMatch(id: string) {
    update({ matches: content.matches.filter(m => m.id !== id) });
  }

  function saveScoring() {
    update({ scoringRules: editScoring });
    setScoringDirty(false);
  }

  function lockDraw() {
    update({ drawLocked: true });
  }

  function drawOne() {
    if (content.participants.length === 0) return;
    const unassigned = shuffle(content.teams.filter(t => !t.assignedTo));
    if (unassigned.length === 0) return;
    const picked = unassigned[0];
    const pidx = nextParticipantIndex(content.participants, content.teams);
    const owner = content.participants[pidx];
    update({
      teams: content.teams.map(t => (t.id === picked.id ? { ...t, assignedTo: owner.id } : t)),
    });
    setDrawReveal([`${owner.name} got ${picked.flagEmoji ?? ''} ${picked.name}`.trim()]);
  }

  function drawAll() {
    if (content.participants.length === 0) return;
    const unassigned = shuffle(content.teams.filter(t => !t.assignedTo));
    if (unassigned.length === 0) return;

    const assignment = new Map<string, string>();
    let pidx = nextParticipantIndex(content.participants, content.teams);
    for (const team of unassigned) {
      assignment.set(team.id, content.participants[pidx].id);
      pidx = (pidx + 1) % content.participants.length;
    }

    update({
      teams: content.teams.map(t => (assignment.has(t.id) ? { ...t, assignedTo: assignment.get(t.id) } : t)),
    });

    const reveal = content.participants.map(p => {
      const picks = unassigned
        .filter(t => assignment.get(t.id) === p.id)
        .slice(0, 3)
        .map(t => `${t.flagEmoji ?? ''} ${t.name}`.trim())
        .join(', ');
      return picks ? `${p.name} got ${picks}` : `${p.name} got no teams`;
    });
    setDrawReveal(reveal);
  }

  function drawByPot() {
    if (content.participants.length === 0) return;
    const teams = [...content.teams];
    const pots = [...new Set(teams.map(t => t.pot))].sort((a, b) => a - b);

    for (const pot of pots) {
      const potTeams = shuffle(teams.filter(t => t.pot === pot && !t.assignedTo));
      potTeams.forEach((team, i) => {
        const participant = content.participants[i % content.participants.length];
        const idx = teams.findIndex(t => t.id === team.id);
        if (idx >= 0) teams[idx] = { ...teams[idx], assignedTo: participant.id };
      });
    }

    update({ teams });
    setDrawReveal(content.participants.map(p => {
      const names = teams
        .filter(t => t.assignedTo === p.id)
        .slice(0, 3)
        .map(t => `${t.flagEmoji ?? ''} ${t.name}`.trim())
        .join(', ');
      return names ? `${p.name} got ${names}` : `${p.name} got no teams`;
    }));
  }

  const assignedCount = content.teams.filter(t => t.assignedTo).length;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className={`rounded-3xl bg-gradient-to-br ${getPoolGradient(content.colourTheme)} p-5 text-white shadow-lg`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-black">{content.poolName}</h2>
            <p className="mt-0.5 text-sm opacity-90">{content.tournamentName}</p>
          </div>
          <button
            data-testid="manage-pool-btn"
            onClick={() => setManageOpen(true)}
            className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white active:bg-white/30"
          >
            Manage pool
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-white/15 p-2.5">Status: <span className="font-bold">{drawStatus}</span></div>
          <div className="rounded-xl bg-white/15 p-2.5">People: <span className="font-bold">{content.participants.length}</span></div>
          <div className="rounded-xl bg-white/15 p-2.5">Assigned: <span className="font-bold">{assignedCount}/{content.teams.length}</span></div>
          <div className="rounded-xl bg-white/15 p-2.5">Share: <span className="font-bold">{hasShareLink ? 'Live' : 'Not shared'}</span></div>
        </div>
      </div>

      <SmartGuidance guidance={poolGuidance} onAction={handleAction} />

      {drawReveal.length > 0 && (
        <div data-testid="draw-reveal" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Draw Reveal</p>
          <div className="mt-2 space-y-1.5">
            {drawReveal.map((line, idx) => (
              <p key={`${line}-${idx}`} className="text-sm font-medium text-amber-900">{line}</p>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        <div className="border-b border-gray-50 px-4 py-3">
          <h3 className="text-sm font-bold text-gray-900">Leaderboard</h3>
        </div>
        {leaderboard.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">Add participants to see the leaderboard.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {leaderboard.map((row, i) => {
              const topThree = row.teams.slice(0, 3).map(t => `${t.flagEmoji ?? ''} ${t.name}`.trim()).join(' · ');
              return (
                <button
                  key={row.participant.id}
                  data-testid={`leaderboard-row-${row.participant.id}`}
                  onClick={() => setParticipantSheetId(row.participant.id)}
                  className="w-full px-4 py-3 text-left active:bg-gray-50"
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
                      <p className="text-sm font-black text-gray-900">{row.points} pts</p>
                      <p className="text-[11px] text-gray-400">Tap for details</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900">Teams</h3>
          <button
            data-testid="view-all-teams-btn"
            onClick={() => setShowAllTeams(v => !v)}
            className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 active:bg-gray-200"
          >
            {showAllTeams ? 'Hide teams' : 'View all teams'}
          </button>
        </div>
        {!showAllTeams ? (
          <p data-testid="teams-collapsed-hint" className="mt-2 text-xs text-gray-500">Tap “View all teams” to open the full 48-team list.</p>
        ) : (
          <div data-testid="all-teams-list" className="mt-3 flex flex-wrap gap-2">
            {content.teams.map(team => (
              <div key={team.id} className="rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700">
                {team.flagEmoji ?? '🏳'} {team.name} · Pot {team.pot}
              </div>
            ))}
          </div>
        )}
      </div>

      {participantDetails && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => setParticipantSheetId(null)}>
          <div className="absolute inset-0 bg-black/35" />
          <div
            data-testid="participant-detail-sheet"
            className="relative z-10 max-h-[78dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
            <h3 className="text-lg font-black text-gray-900">{participantDetails.participant.name}</h3>
            <p className="text-sm text-gray-500">{participantDetails.points} points · {participantDetails.teams.length} teams</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">Wins: <span className="font-bold text-gray-900">{participantDetails.wins}</span></div>
              <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">Draws: <span className="font-bold text-gray-900">{participantDetails.draws}</span></div>
            </div>

            {[1, 2, 3, 4].map(pot => {
              const teams = participantDetails.teams.filter(t => t.pot === pot);
              if (teams.length === 0) return null;
              return (
                <div key={pot} className="mt-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Pot {pot}</p>
                  <div className="mt-2 space-y-2">
                    {teams.map(team => (
                      <div key={team.id} data-testid={`participant-detail-team-${team.id}`} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                        <span className="font-medium text-gray-800">{team.flagEmoji ?? '🏳'} {team.name}</span>
                        <span className="text-xs text-gray-500">{team.status.replaceAll('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="mt-4 flex gap-2">
              <button onClick={() => setParticipantSheetId(null)} className="flex-1 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white">Done</button>
            </div>
          </div>
        </div>
      )}

      {themePickerOpen && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => setThemePickerOpen(false)}>
          <div className="absolute inset-0 bg-black/35" />
          <div className="relative z-10 w-full rounded-t-3xl bg-white p-4" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
            <h3 className="text-sm font-bold text-gray-900">Pool colours</h3>
            <div className="mt-3 flex flex-wrap gap-3">
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  data-testid={`theme-${theme.id}`}
                  onClick={() => {
                    update({ colourTheme: theme.id as ColourTheme });
                    setThemePickerOpen(false);
                  }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${theme.gradient} ${content.colourTheme === theme.id ? 'ring-2 ring-gray-900 ring-offset-2' : ''}`} />
                  <span className="text-xs text-gray-600">{theme.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {manageOpen && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => setManageOpen(false)}>
          <div className="absolute inset-0 bg-black/35" />
          <div data-testid="manage-pool-sheet" className="relative z-10 max-h-[84dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-black text-gray-900">Manage pool</h3>
              <button data-testid="edit-pool-btn" onClick={() => setManageOpen(false)} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">Done</button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button data-testid="draw-one-btn" onClick={drawOne} className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white">Draw one</button>
              <button data-testid="draw-all-btn" onClick={drawAll} className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white">Draw all</button>
              <button data-testid="draw-by-pot-btn" onClick={drawByPot} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-800">Draw by pot</button>
              <button data-testid="lock-draw-btn" onClick={lockDraw} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-800">Lock draw</button>
            </div>

            <section className="mt-5">
              <h4 className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Add people</h4>
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
            </section>

            <section className="mt-5">
              <h4 className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Edit teams</h4>
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
            </section>

            <section className="mt-5">
              <h4 className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Add result</h4>
              <button data-testid="add-match-btn" onClick={() => setAddingMatch(v => !v)} className="mt-2 rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-800">+ Add result</button>
              {addingMatch && (
                <div className="mt-2 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
                  <div className="flex gap-2">
                    <select data-testid="match-team-a-select" value={matchTeamA} onChange={e => setMatchTeamA(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-2 py-2 text-xs">
                      <option value="">Team A</option>
                      {content.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select data-testid="match-team-b-select" value={matchTeamB} onChange={e => setMatchTeamB(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-2 py-2 text-xs">
                      <option value="">Team B</option>
                      {content.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input data-testid="match-score-a-input" type="number" value={matchScoreA} onChange={e => setMatchScoreA(e.target.value)} className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm" />
                    <input data-testid="match-score-b-input" type="number" value={matchScoreB} onChange={e => setMatchScoreB(e.target.value)} className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm" />
                    <input value={matchStage} onChange={e => setMatchStage(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-2 py-2 text-xs" />
                    <input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-2 text-xs" />
                  </div>
                  <button data-testid="save-match-btn" onClick={saveMatch} className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">Save result</button>
                </div>
              )}
              {content.matches.length > 0 && (
                <div className="mt-2 space-y-1">
                  {content.matches.map(m => (
                    <div key={m.id} data-testid={`match-row-${m.id}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1.5 text-xs text-gray-700">
                      <span>{m.teamAId} {m.scoreA ?? '-'} - {m.scoreB ?? '-'} {m.teamBId}</span>
                      <button data-testid={`delete-match-${m.id}`} onClick={() => deleteMatch(m.id)} className="text-red-500">×</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-5">
              <h4 className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Scoring</h4>
              <div className="mt-2 space-y-2">
                {([
                  ['pointsPerWin', 'Points per win', 'points-per-win-input'],
                  ['pointsPerDraw', 'Points per draw', 'points-per-draw-input'],
                  ['knockoutBonus', 'Knockout bonus', 'knockout-bonus-input'],
                  ['quarterFinalBonus', 'Quarter-final bonus', 'quarter-final-bonus-input'],
                  ['semiFinalBonus', 'Semi-final bonus', 'semi-final-bonus-input'],
                  ['finalBonus', 'Final bonus', 'final-bonus-input'],
                  ['winnerBonus', 'Winner bonus', 'winner-bonus-input'],
                ] as [keyof TournamentScoringRules, string, string][]).map(([key, label, testId]) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <label className="text-xs text-gray-600">{label}</label>
                    <input
                      data-testid={testId}
                      type="number"
                      value={editScoring[key]}
                      onChange={e => {
                        setEditScoring(s => ({ ...s, [key]: Number(e.target.value) }));
                        setScoringDirty(true);
                      }}
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm"
                    />
                  </div>
                ))}
                <button data-testid="save-scoring-btn" onClick={saveScoring} className={`rounded-xl px-3 py-2 text-xs font-semibold ${scoringDirty ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>Save scoring</button>
              </div>
            </section>

            <section className="mt-5">
              <h4 className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Colours + Share</h4>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setThemePickerOpen(true)} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700">Colours</button>
                <button onClick={() => onShare?.()} className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white">Share</button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

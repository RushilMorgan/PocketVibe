/**
 * Read-only + change-request view for Tournament Pool viewers and participants.
 * Admins use the full TournamentPoolRenderer instead.
 *
 * Shows: pool header, your teams, leaderboard, draw results, recent results, scoring.
 * Participants can also submit change requests which the admin can approve/decline.
 */
import React, { useState, useEffect } from 'react';
import type {
  TournamentPoolTrackerContent,
  TournamentParticipant,
  TournamentTeam,
  WorldCupTeam,
  WorldCupMatch,
} from '../../types';
import type { AccessMode } from '../../types';
import { applyCreationAction } from '../../services/shareService';
import {
  calcTournamentScores,
  buildEffectiveMatches,
  buildEffectiveTeamStages,
  calcScoresFromPool,
} from '../../lib/tournamentScoring';
import type { ParticipantScore } from '../../lib/tournamentScoring';
import { getWorldCupData } from '../../services/worldCupService';

interface Props {
  content: TournamentPoolTrackerContent;
  accessMode: AccessMode;
  participantRef?: string;
  shareSlug: string;
  token?: string;
  onUpdate: (updated: TournamentPoolTrackerContent) => void;
  onRemix?: () => void;
}

// Score calculation is in src/lib/tournamentScoring.ts

const MEDAL = ['🥇', '🥈', '🥉'];

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  round_of_16: 'Round of 16',
  quarter_final: 'QF',
  semi_final: 'SF',
  final: 'Final',
  winner: '🏆 Winner',
  eliminated: '❌ Out',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function TournamentPoolReadView({ content, accessMode, participantRef, shareSlug, token, onUpdate, onRemix }: Props) {
  const [changeRequestOpen, setChangeRequestOpen] = useState(false);
  const [changeDescription, setChangeDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [wcTeams, setWcTeams] = useState<WorldCupTeam[]>([]);
  const [wcMatches, setWcMatches] = useState<WorldCupMatch[]>([]);
  const [wcLoaded, setWcLoaded] = useState(false);

  const autoSettings = content.autoSettings;
  const autoEnabled  = autoSettings?.autoResultsEnabled ?? false;

  // Load canonical WC data when auto-results is enabled
  useEffect(() => {
    if (!autoEnabled) return;
    let cancelled = false;
    getWorldCupData().then(data => {
      if (!cancelled) {
        setWcTeams(data.teams);
        setWcMatches(data.matches);
        setWcLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, [autoEnabled]);

  // Build leaderboard — use canonical data when auto is enabled, else pool data
  const leaderboard: ParticipantScore[] = (() => {
    if (autoEnabled && wcLoaded) {
      const effectiveMatches = buildEffectiveMatches(
        content.teams,
        content.matches,
        wcMatches,
        autoSettings?.allowManualOverrides ?? true,
      );
      const teamStages = buildEffectiveTeamStages(content.teams, wcTeams);
      return calcTournamentScores(
        content.participants,
        content.teams,
        effectiveMatches,
        teamStages,
        content.scoringRules,
      );
    }
    return calcScoresFromPool(content);
  })();

  const myTeams       = participantRef ? content.teams.filter(t => t.assignedTo === participantRef) : [];
  const me            = participantRef ? content.participants.find(p => p.id === participantRef) : undefined;
  const hasLiveMatch  = autoEnabled && wcMatches.some(m => m.status === 'live');

  // Recent results: canonical (when auto) or pool matches
  const recentResults = autoEnabled && wcLoaded
    ? wcMatches
        .filter(m => m.status === 'finished' &&
          content.teams.some(t => t.providerTeamId === m.homeTeamId || t.providerTeamId === m.awayTeamId))
        .slice(-5)
        .reverse()
        .map(m => ({
          id: String(m.providerMatchId),
          labelA: canonicalTeamLabel(m.homeTeamId),
          labelB: canonicalTeamLabel(m.awayTeamId),
          scoreA: m.scoreHome,
          scoreB: m.scoreAway,
          isManual: m.isManualOverride,
        }))
    : content.matches
        .filter(m => m.scoreA !== undefined)
        .slice(-5)
        .reverse()
        .map(m => ({
          id: m.id,
          labelA: poolTeamLabel(m.teamAId),
          labelB: poolTeamLabel(m.teamBId),
          scoreA: m.scoreA,
          scoreB: m.scoreB,
          isManual: m.isManualOverride ?? false,
        }));

  function poolTeamLabel(id: string): string {
    const t = content.teams.find(x => x.id === id);
    return t ? `${t.flagEmoji ?? ''} ${t.name}`.trim() : id;
  }

  function canonicalTeamLabel(provId: number): string {
    const poolTeam = content.teams.find(t => t.providerTeamId === provId);
    if (poolTeam) return `${poolTeam.flagEmoji ?? ''} ${poolTeam.name}`.trim();
    const wct = wcTeams.find(t => t.providerTeamId === provId);
    return wct ? wct.name : `Team ${provId}`;
  }

  async function submitChangeRequest() {
    if (!token || !participantRef || !changeDescription.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await applyCreationAction(shareSlug, token, 'create_change_request', {
        participantId: participantRef,
        description: changeDescription,
      });
      onUpdate(result.content as TournamentPoolTrackerContent);
      setChangeRequestOpen(false);
      setChangeDescription('');
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl p-5 text-white">
        <h2 className="text-xl font-bold">{content.poolName}</h2>
        <p className="text-sm opacity-90 mt-0.5">{content.tournamentName}</p>
        {content.prizeNote && (
          <p className="text-xs opacity-80 mt-0.5">🏆 {content.prizeNote}</p>
        )}
        {content.drawLocked && (
          <span className="mt-2 inline-block text-xs bg-white/20 px-2 py-0.5 rounded-full">🔒 Draw locked</span>
        )}
        {autoEnabled && (
          <span className="mt-2 ml-1 inline-block text-xs bg-white/20 px-2 py-0.5 rounded-full">
            {hasLiveMatch ? '🔴 Live' : '🔄 Auto-results'}
          </span>
        )}
      </div>

      {/* Your teams */}
      {me && myTeams.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your teams</p>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{me.emoji ?? '👤'}</span>
            <span className="font-semibold text-gray-800">{me.name}</span>
          </div>
          <div className="space-y-2">
            {myTeams.map(team => (
              <div key={team.id} className="flex items-center justify-between py-2 px-3 bg-yellow-50 rounded-xl">
                <span className="text-sm font-medium text-gray-800">
                  {team.flagEmoji ?? ''} {team.name}
                  <span className="ml-2 text-xs text-gray-400 font-normal">Pot {team.pot}</span>
                </span>
                <span className="text-xs font-medium text-gray-600">
                  {STATUS_LABEL[team.status] ?? team.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Leaderboard</p>
          <div className="space-y-2">
            {leaderboard.map((score, i) => (
              <div
                key={score.participant.id}
                className={`flex items-center gap-3 py-2 px-3 rounded-xl ${
                  score.participant.id === participantRef ? 'bg-yellow-50' : ''
                }`}
              >
                <span className="text-lg w-6 text-center flex-shrink-0">
                  {i < 3 ? MEDAL[i] : `#${i + 1}`}
                </span>
                <span className="text-xl flex-shrink-0">{score.participant.emoji ?? '👤'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {score.participant.name}
                    {score.participant.id === participantRef && (
                      <span className="ml-1 text-xs text-yellow-600">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {score.teams.map(t => `${t.flagEmoji ?? ''} ${t.name}`).join(' · ') || 'No teams yet'}
                  </p>
                </div>
                <span className="text-sm font-bold text-gray-800 flex-shrink-0">{score.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full draw results */}
      {content.drawLocked && content.participants.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">All draws</p>
          <div className="space-y-2">
            {content.participants.map(p => {
              const theirTeams = content.teams.filter(t => t.assignedTo === p.id);
              return (
                <div key={p.id} className="flex items-start gap-3 py-1.5">
                  <span className="text-xl flex-shrink-0">{p.emoji ?? '👤'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      {theirTeams.length > 0
                        ? theirTeams.map(t => `${t.flagEmoji ?? ''} ${t.name}`).join(', ')
                        : 'No teams drawn yet'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent results */}
      {recentResults.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Recent results</p>
          <div className="space-y-2">
            {recentResults.map(m => (
              <div key={m.id} className="flex items-center justify-between py-1.5 text-sm gap-2">
                <span className="flex-1 text-right text-gray-800 truncate">{m.labelA}</span>
                <span className="font-bold text-gray-700 tabular-nums flex-shrink-0 px-1">
                  {m.scoreA} – {m.scoreB}
                </span>
                <span className="flex-1 text-gray-800 truncate">{m.labelB}</span>
                {m.isManual && (
                  <span className="text-xs text-amber-500 flex-shrink-0" title="Manual override">✏️</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scoring breakdown */}
      <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Scoring</p>
        <div className="space-y-1 text-xs text-gray-600">
          <p>⚽ Win: {content.scoringRules.pointsPerWin} pts · Draw: {content.scoringRules.pointsPerDraw} pt</p>
          {content.scoringRules.knockoutBonus > 0 && (
            <p>🔥 Knockout bonus: +{content.scoringRules.knockoutBonus}</p>
          )}
          {content.scoringRules.semiFinalBonus > 0 && (
            <p>🔥 Semi-final bonus: +{content.scoringRules.semiFinalBonus}</p>
          )}
          {content.scoringRules.winnerBonus > 0 && (
            <p>🏆 Tournament winner bonus: +{content.scoringRules.winnerBonus}</p>
          )}
        </div>
        {content.rulesNote && (
          <p className="mt-2 text-xs text-gray-500 italic">{content.rulesNote}</p>
        )}
      </div>

      {/* Make my own version (viewers only) */}
      {accessMode === 'viewer' && onRemix && (
        <div className="bg-violet-50 rounded-2xl border border-violet-100 p-4 flex flex-col gap-2">
          <p className="text-sm font-semibold text-violet-800">Like this pool?</p>
          <p className="text-xs text-violet-600">
            Make your own private copy with the same teams, participants, and scoring rules.
          </p>
          <button
            data-testid="remix-btn"
            onClick={onRemix}
            className="w-full bg-violet-600 text-white text-sm font-semibold rounded-xl py-3 active:bg-violet-700"
          >
            Make my own version
          </button>
        </div>
      )}

      {/* Suggest a change (participant only) */}
      {accessMode === 'participant' && token && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Suggest a change</p>
          {submitSuccess && (
            <div className="flex items-center gap-2 text-xs text-green-600 mb-2">
              <span>✓</span>
              <span>Request sent to admin for review</span>
            </div>
          )}
          {!changeRequestOpen ? (
            <button
              data-testid="suggest-change-btn"
              onClick={() => setChangeRequestOpen(true)}
              className="w-full text-sm text-gray-500 font-medium border border-dashed border-gray-300 rounded-xl py-2.5 active:bg-gray-50"
            >
              ✏️ Suggest a change to the admin
            </button>
          ) : (
            <div className="space-y-2">
              {submitError && <p className="text-xs text-red-500">{submitError}</p>}
              <textarea
                data-testid="change-request-input"
                value={changeDescription}
                onChange={e => setChangeDescription(e.target.value)}
                placeholder="e.g. Brazil beat Japan 3-1, not 2-1 / My team name is wrong"
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
              />
              <div className="flex gap-2">
                <button
                  data-testid="submit-change-request-btn"
                  onClick={submitChangeRequest}
                  disabled={submitting || !changeDescription.trim()}
                  className="flex-1 bg-yellow-500 text-white text-sm font-semibold rounded-xl py-2.5 active:bg-yellow-600 disabled:opacity-50"
                >
                  {submitting ? 'Sending…' : 'Send to admin'}
                </button>
                <button
                  onClick={() => {
                    setChangeRequestOpen(false);
                    setChangeDescription('');
                    setSubmitError(null);
                  }}
                  className="px-4 bg-gray-100 text-gray-600 text-sm rounded-xl active:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

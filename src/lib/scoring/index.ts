import type { Group, Match, MatchResult, RankingTieBreaker, ScoringRule } from "@/lib/types";

export type GroupStanding = {
  groupId: string;
  groupName: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
};

export const defaultScoringRule: ScoringRule = {
  winPoints: 1,
  lossPoints: 0,
  usePointDifferential: true,
  tieBreakers: ["points", "pointDifferential", "pointsFor", "wins", "pointsAgainst"],
};

export function calculateStandings(
  groups: Group[],
  matches: Match[],
  results: MatchResult[],
  rule: ScoringRule,
): GroupStanding[] {
  const standings = new Map(
    groups.map((group) => [
      group.id,
      {
        groupId: group.id,
        groupName: group.name,
        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDifferential: 0,
      },
    ]),
  );

  const matchesById = new Map(matches.map((match) => [match.id, match]));

  results
    .filter((result) => result.recorded)
    .forEach((result) => {
      const match = matchesById.get(result.matchId);

      if (!match) {
        return;
      }

      applyResult(standings.get(match.groupAId), result.scoreA, result.scoreB, result, rule);
      applyResult(standings.get(match.groupBId), result.scoreB, result.scoreA, result, rule);
    });

  return [...standings.values()].sort((a, b) => compareStandings(a, b, rule.tieBreakers));
}

export function isTournamentComplete(matches: Match[], results: MatchResult[]) {
  const recorded = new Set(results.filter((result) => result.recorded).map((result) => result.matchId));

  return matches.length > 0 && matches.every((match) => recorded.has(match.id));
}

function applyResult(
  standing: GroupStanding | undefined,
  pointsFor: number,
  pointsAgainst: number,
  result: MatchResult,
  rule: ScoringRule,
) {
  if (!standing) {
    return;
  }

  const won = standing.groupId === result.winnerGroupId;

  standing.played += 1;
  standing.wins += won ? 1 : 0;
  standing.losses += won ? 0 : 1;
  standing.points += won ? rule.winPoints : rule.lossPoints;
  standing.pointsFor += pointsFor;
  standing.pointsAgainst += pointsAgainst;
  standing.pointDifferential = standing.pointsFor - standing.pointsAgainst;
}

function compareStandings(
  left: GroupStanding,
  right: GroupStanding,
  tieBreakers: RankingTieBreaker[],
) {
  for (const tieBreaker of tieBreakers) {
    const diff = valueFor(right, tieBreaker) - valueFor(left, tieBreaker);

    if (diff !== 0) {
      return diff;
    }
  }

  return left.groupName.localeCompare(right.groupName);
}

function valueFor(standing: GroupStanding, tieBreaker: RankingTieBreaker) {
  if (tieBreaker === "pointsAgainst") {
    return -standing.pointsAgainst;
  }

  return standing[tieBreaker];
}

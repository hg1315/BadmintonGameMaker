import { describe, expect, it } from "vitest";
import { calculateStandings, isTournamentComplete } from "@/lib/scoring";
import type { Group, Match, MatchResult, ScoringRule } from "@/lib/types";

const groups: Group[] = [
  { id: "group-1", name: "1조", order: 1, players: [] },
  { id: "group-2", name: "2조", order: 2, players: [] },
];

const matches: Match[] = [
  {
    id: "match-1",
    courtId: "court-1",
    startsAt: "2026-05-06T09:00:00.000Z",
    endsAt: "2026-05-06T09:15:00.000Z",
    groupAId: "group-1",
    groupBId: "group-2",
    players: [],
    status: "scheduled",
  },
];

const result: MatchResult = {
  matchId: "match-1",
  scoreA: 21,
  scoreB: 18,
  winnerGroupId: "group-1",
  recorded: true,
};

describe("scoring", () => {
  it("승리 팀의 조 포인트만 승리 포인트로 증가한다", () => {
    const standings = calculateStandings(groups, matches, [result], {
      winPoints: 1,
      lossPoints: 0,
      usePointDifferential: true,
      tieBreakers: ["points"],
    });

    expect(standings.find((standing) => standing.groupId === "group-1")?.points).toBe(1);
    expect(standings.find((standing) => standing.groupId === "group-2")?.points).toBe(0);
  });

  it("설정형 포인트 규칙 변경을 순위 계산에 반영한다", () => {
    const rule: ScoringRule = {
      winPoints: 3,
      lossPoints: 1,
      usePointDifferential: true,
      tieBreakers: ["points", "pointDifferential"],
    };
    const standings = calculateStandings(groups, matches, [result], rule);

    expect(standings.find((standing) => standing.groupId === "group-1")?.points).toBe(3);
    expect(standings.find((standing) => standing.groupId === "group-2")?.points).toBe(1);
  });

  it("모든 결과가 입력되기 전에는 대회 완료로 보지 않는다", () => {
    expect(isTournamentComplete(matches, [])).toBe(false);
    expect(isTournamentComplete(matches, [result])).toBe(true);
  });
});

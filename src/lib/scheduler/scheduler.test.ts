import { describe, expect, it } from "vitest";
import {
  calculateMatchCapacity,
  createGroups,
  createPlayers,
  generateSchedule,
} from "@/lib/scheduler";

describe("scheduler", () => {
  it("50명과 7개 조를 균등하게 배정한다", () => {
    const players = createPlayers(50, []);
    const groups = createGroups(players, 7);

    expect(groups.map((group) => group.players.length)).toEqual([8, 7, 7, 7, 7, 7, 7]);
  });

  it("운영 시간과 코트 수로 가능한 경기 수를 계산한다", () => {
    const capacity = calculateMatchCapacity("2026-05-06T09:00", "2026-05-06T10:30", 3);

    expect(capacity).toBe(18);
  });

  it("같은 시간 슬롯에 같은 선수를 중복 배정하지 않는다", () => {
    const schedule = generateSchedule({
      totalPlayers: 50,
      names: [],
      groupCount: 7,
      courtCount: 3,
      startsAt: "2026-05-06T09:00",
      endsAt: "2026-05-06T10:30",
    });

    const matchesBySlot = Map.groupBy(schedule.matches, (match) => match.startsAt);

    matchesBySlot.forEach((matches) => {
      const playerIds = matches.flatMap((match) => match.players.map((player) => player.playerId));
      expect(new Set(playerIds).size).toBe(playerIds.length);
    });
  });

  it("7개 조와 4개 코트 조건에서도 모든 코트를 사용한다", () => {
    const schedule = generateSchedule({
      totalPlayers: 50,
      names: [],
      groupCount: 7,
      courtCount: 4,
      startsAt: "2026-06-14T13:00",
      endsAt: "2026-06-14T18:00",
    });
    const courtCounts = new Map(schedule.courts.map((court) => [court.id, 0]));

    schedule.matches.forEach((match) => {
      courtCounts.set(match.courtId, (courtCounts.get(match.courtId) ?? 0) + 1);
    });

    expect(schedule.matches).toHaveLength(80);
    expect([...courtCounts.values()]).toEqual([20, 20, 20, 20]);
  });

  it("선수별 출전 횟수가 한쪽으로 몰리지 않는다", () => {
    const schedule = generateSchedule({
      totalPlayers: 50,
      names: [],
      groupCount: 7,
      courtCount: 3,
      startsAt: "2026-05-06T09:00",
      endsAt: "2026-05-06T10:30",
    });
    const counts = new Map(schedule.players.map((player) => [player.id, 0]));

    schedule.matches.forEach((match) => {
      match.players.forEach((player) => {
        counts.set(player.playerId, (counts.get(player.playerId) ?? 0) + 1);
      });
    });

    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2);
  });
});

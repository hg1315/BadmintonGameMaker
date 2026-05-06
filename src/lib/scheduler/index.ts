import type { Court, Group, Match, MatchPlayer, Player } from "@/lib/types";

const MATCH_MINUTES = 15;

type PairKey = string;

type ScheduleStats = {
  playerGames: Map<string, number>;
  groupGames: Map<string, number>;
  partnerPairs: Map<PairKey, number>;
  opponentPairs: Map<PairKey, number>;
  groupPairings: Map<PairKey, number>;
};

type Candidate = {
  groupA: Group;
  groupB: Group;
  players: MatchPlayer[];
  score: number;
};

export type GenerateScheduleInput = {
  totalPlayers: number;
  names: string[];
  groupCount: number;
  courtCount: number;
  startsAt: string;
  endsAt: string;
};

export function createPlayers(totalPlayers: number, names: string[]): Player[] {
  return Array.from({ length: totalPlayers }, (_, index) => {
    const rawName = names[index]?.trim();
    const generatedName = `Player ${index + 1}`;

    return {
      id: `player-${index + 1}`,
      name: rawName || generatedName,
      isGeneratedName: !rawName,
    };
  });
}

export function createGroups(players: Player[], groupCount: number): Group[] {
  if (groupCount < 2) {
    throw new Error("조 대 조 경기를 만들려면 최소 2개 조가 필요합니다.");
  }

  if (players.length < groupCount * 2) {
    throw new Error("각 조에서 최소 2명을 선발할 수 있도록 인원을 입력하세요.");
  }

  const groups = Array.from({ length: groupCount }, (_, index): Group => {
    return {
      id: `group-${index + 1}`,
      name: `${index + 1}조`,
      order: index + 1,
      players: [],
    };
  });

  players.forEach((player, index) => {
    groups[index % groupCount].players.push(player);
  });

  return groups;
}

export function createCourts(courtCount: number): Court[] {
  return Array.from({ length: courtCount }, (_, index) => ({
    id: `court-${index + 1}`,
    name: `${index + 1}코트`,
  }));
}

export function calculateMatchCapacity(
  startsAt: string,
  endsAt: string,
  courtCount: number,
): number {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const minutes = Math.max(0, Math.floor((end - start) / 60000));
  const slots = Math.floor(minutes / MATCH_MINUTES);

  return slots * Math.max(0, courtCount);
}

export function generateSchedule(input: GenerateScheduleInput) {
  const players = createPlayers(input.totalPlayers, input.names);
  const groups = createGroups(players, input.groupCount);
  const courts = createCourts(input.courtCount);
  const matches = scheduleMatches(groups, courts, input.startsAt, input.endsAt);

  return {
    players,
    groups,
    courts,
    matches,
  };
}

export function scheduleMatches(
  groups: Group[],
  courts: Court[],
  startsAt: string,
  endsAt: string,
): Match[] {
  const capacity = calculateMatchCapacity(startsAt, endsAt, courts.length);
  const stats = createEmptyStats(groups);
  const matches: Match[] = [];
  const slotCount = courts.length === 0 ? 0 : Math.ceil(capacity / courts.length);
  const start = new Date(startsAt);

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    const slotStartsAt = addMinutes(start, slotIndex * MATCH_MINUTES);
    const slotEndsAt = addMinutes(slotStartsAt, MATCH_MINUTES);
    const busyPlayers = new Set<string>();

    for (const court of courts) {
      if (matches.length >= capacity) {
        break;
      }

      const candidate = pickBestCandidate(groups, stats, busyPlayers);

      if (!candidate) {
        continue;
      }

      const match: Match = {
        id: `match-${matches.length + 1}`,
        courtId: court.id,
        startsAt: slotStartsAt.toISOString(),
        endsAt: slotEndsAt.toISOString(),
        groupAId: candidate.groupA.id,
        groupBId: candidate.groupB.id,
        players: candidate.players,
        status: "scheduled",
      };

      matches.push(match);
      applyCandidate(stats, candidate);
      candidate.players.forEach((player) => busyPlayers.add(player.playerId));
    }
  }

  return matches;
}

function createEmptyStats(groups: Group[]): ScheduleStats {
  return {
    playerGames: new Map(groups.flatMap((group) => group.players.map((player) => [player.id, 0]))),
    groupGames: new Map(groups.map((group) => [group.id, 0])),
    partnerPairs: new Map(),
    opponentPairs: new Map(),
    groupPairings: new Map(),
  };
}

function pickBestCandidate(
  groups: Group[],
  stats: ScheduleStats,
  busyPlayers: Set<string>,
): Candidate | null {
  const candidates: Candidate[] = [];

  for (let leftIndex = 0; leftIndex < groups.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < groups.length; rightIndex += 1) {
      const groupA = groups[leftIndex];
      const groupB = groups[rightIndex];

      const teamA = pickTwoPlayers(groupA, stats, busyPlayers);
      const teamB = pickTwoPlayers(groupB, stats, busyPlayers);

      if (teamA.length !== 2 || teamB.length !== 2) {
        continue;
      }

      const players: MatchPlayer[] = [
        ...teamA.map((player) => ({
          playerId: player.id,
          groupId: groupA.id,
          side: "A" as const,
        })),
        ...teamB.map((player) => ({
          playerId: player.id,
          groupId: groupB.id,
          side: "B" as const,
        })),
      ];

      candidates.push({
        groupA,
        groupB,
        players,
        score: scoreCandidate(groupA, groupB, players, stats),
      });
    }
  }

  return candidates.sort((a, b) => a.score - b.score)[0] ?? null;
}

function pickTwoPlayers(
  group: Group,
  stats: ScheduleStats,
  busyPlayers: Set<string>,
): Player[] {
  return group.players
    .filter((player) => !busyPlayers.has(player.id))
    .sort((a, b) => {
      const gamesA = stats.playerGames.get(a.id) ?? 0;
      const gamesB = stats.playerGames.get(b.id) ?? 0;

      if (gamesA !== gamesB) {
        return gamesA - gamesB;
      }

      return a.id.localeCompare(b.id);
    })
    .slice(0, 2);
}

function scoreCandidate(
  groupA: Group,
  groupB: Group,
  players: MatchPlayer[],
  stats: ScheduleStats,
): number {
  const groupLoad =
    (stats.groupGames.get(groupA.id) ?? 0) + (stats.groupGames.get(groupB.id) ?? 0);
  const playerLoad = players.reduce((sum, player) => {
    return sum + (stats.playerGames.get(player.playerId) ?? 0);
  }, 0);
  const partnerPenalty = sidePairKeys(players).reduce((sum, pair) => {
    return sum + (stats.partnerPairs.get(pair) ?? 0);
  }, 0);
  const opponentPenalty = opponentPairKeys(players).reduce((sum, pair) => {
    return sum + (stats.opponentPairs.get(pair) ?? 0);
  }, 0);
  const groupPairPenalty = stats.groupPairings.get(pairKey(groupA.id, groupB.id)) ?? 0;

  return groupLoad * 20 + playerLoad * 10 + groupPairPenalty * 8 + partnerPenalty * 4 + opponentPenalty;
}

function applyCandidate(stats: ScheduleStats, candidate: Candidate) {
  candidate.players.forEach((player) => {
    stats.playerGames.set(player.playerId, (stats.playerGames.get(player.playerId) ?? 0) + 1);
  });

  stats.groupGames.set(
    candidate.groupA.id,
    (stats.groupGames.get(candidate.groupA.id) ?? 0) + 1,
  );
  stats.groupGames.set(
    candidate.groupB.id,
    (stats.groupGames.get(candidate.groupB.id) ?? 0) + 1,
  );

  incrementMap(stats.groupPairings, pairKey(candidate.groupA.id, candidate.groupB.id));
  sidePairKeys(candidate.players).forEach((key) => incrementMap(stats.partnerPairs, key));
  opponentPairKeys(candidate.players).forEach((key) => incrementMap(stats.opponentPairs, key));
}

function sidePairKeys(players: MatchPlayer[]): PairKey[] {
  return ["A", "B"].flatMap((side) => {
    const sidePlayers = players.filter((player) => player.side === side);

    return sidePlayers.length === 2 ? [pairKey(sidePlayers[0].playerId, sidePlayers[1].playerId)] : [];
  });
}

function opponentPairKeys(players: MatchPlayer[]): PairKey[] {
  const teamA = players.filter((player) => player.side === "A");
  const teamB = players.filter((player) => player.side === "B");

  return teamA.flatMap((left) => teamB.map((right) => pairKey(left.playerId, right.playerId)));
}

function incrementMap(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function pairKey(first: string, second: string) {
  return [first, second].sort().join("__");
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

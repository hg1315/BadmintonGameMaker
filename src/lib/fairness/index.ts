import type { Court, Group, Match } from "@/lib/types";

export type PlayerFairnessStat = {
  playerId: string;
  playerName: string;
  groupName: string;
  gameCount: number;
  restSlots: number;
  averageDelta: number;
};

export type GroupFairnessStat = {
  groupId: string;
  groupName: string;
  playerCount: number;
  gameCount: number;
  gamesPerPlayer: number;
};

export type CourtFairnessStat = {
  courtId: string;
  courtName: string;
  gameCount: number;
  usedMinutes: number;
  averageDelta: number;
};

export type PairRepeatStat = {
  label: string;
  count: number;
};

export type FairnessReport = {
  playerStats: PlayerFairnessStat[];
  groupStats: GroupFairnessStat[];
  courtStats: CourtFairnessStat[];
  groupPairRepeats: PairRepeatStat[];
  partnerRepeats: PairRepeatStat[];
  opponentRepeats: PairRepeatStat[];
  summary: {
    playerMin: number;
    playerMax: number;
    groupMin: number;
    groupMax: number;
    courtMin: number;
    courtMax: number;
  };
};

export function buildFairnessReport(
  groups: Group[],
  courts: Court[],
  matches: Match[],
): FairnessReport {
  const totalSlots = new Set(matches.map((match) => match.startsAt)).size;
  const playerGameCounts = new Map<string, number>();
  const groupGameCounts = new Map<string, number>();
  const courtGameCounts = new Map<string, number>();
  const playerNames = new Map<string, string>();
  const groupNames = new Map<string, string>();
  const groupByPlayer = new Map<string, string>();

  groups.forEach((group) => {
    groupNames.set(group.id, group.name);
    groupGameCounts.set(group.id, 0);
    group.players.forEach((player) => {
      playerGameCounts.set(player.id, 0);
      playerNames.set(player.id, player.name);
      groupByPlayer.set(player.id, group.name);
    });
  });

  courts.forEach((court) => courtGameCounts.set(court.id, 0));

  const groupPairRepeats = new Map<string, number>();
  const partnerRepeats = new Map<string, number>();
  const opponentRepeats = new Map<string, number>();

  matches.forEach((match) => {
    groupGameCounts.set(match.groupAId, (groupGameCounts.get(match.groupAId) ?? 0) + 1);
    groupGameCounts.set(match.groupBId, (groupGameCounts.get(match.groupBId) ?? 0) + 1);
    courtGameCounts.set(match.courtId, (courtGameCounts.get(match.courtId) ?? 0) + 1);
    increment(groupPairRepeats, pairLabel(groupNames.get(match.groupAId), groupNames.get(match.groupBId)));

    match.players.forEach((player) => {
      playerGameCounts.set(player.playerId, (playerGameCounts.get(player.playerId) ?? 0) + 1);
    });

    sidePairs(match.players).forEach((pair) => {
      increment(partnerRepeats, pairLabel(playerNames.get(pair[0]), playerNames.get(pair[1])));
    });

    opponentPairs(match.players).forEach((pair) => {
      increment(opponentRepeats, pairLabel(playerNames.get(pair[0]), playerNames.get(pair[1])));
    });
  });

  const playerAverage = average([...playerGameCounts.values()]);
  const courtAverage = average([...courtGameCounts.values()]);

  const playerStats = groups
    .flatMap((group) => group.players)
    .map((player) => {
      const gameCount = playerGameCounts.get(player.id) ?? 0;

      return {
        playerId: player.id,
        playerName: player.name,
        groupName: groupByPlayer.get(player.id) ?? "",
        gameCount,
        restSlots: Math.max(0, totalSlots - gameCount),
        averageDelta: roundOne(gameCount - playerAverage),
      };
    });

  const groupStats = groups.map((group) => {
    const gameCount = groupGameCounts.get(group.id) ?? 0;

    return {
      groupId: group.id,
      groupName: group.name,
      playerCount: group.players.length,
      gameCount,
      gamesPerPlayer: roundOne((gameCount * 2) / group.players.length),
    };
  });

  const courtStats = courts.map((court) => {
    const gameCount = courtGameCounts.get(court.id) ?? 0;

    return {
      courtId: court.id,
      courtName: court.name,
      gameCount,
      usedMinutes: gameCount * 15,
      averageDelta: roundOne(gameCount - courtAverage),
    };
  });

  return {
    playerStats,
    groupStats,
    courtStats,
    groupPairRepeats: repeated(groupPairRepeats),
    partnerRepeats: repeated(partnerRepeats),
    opponentRepeats: repeated(opponentRepeats),
    summary: {
      playerMin: min(playerStats.map((stat) => stat.gameCount)),
      playerMax: max(playerStats.map((stat) => stat.gameCount)),
      groupMin: min(groupStats.map((stat) => stat.gameCount)),
      groupMax: max(groupStats.map((stat) => stat.gameCount)),
      courtMin: min(courtStats.map((stat) => stat.gameCount)),
      courtMax: max(courtStats.map((stat) => stat.gameCount)),
    },
  };
}

function sidePairs(players: Match["players"]) {
  return ["A", "B"].flatMap((side) => {
    const sidePlayers = players.filter((player) => player.side === side);

    return sidePlayers.length === 2 ? [[sidePlayers[0].playerId, sidePlayers[1].playerId]] : [];
  });
}

function opponentPairs(players: Match["players"]) {
  const teamA = players.filter((player) => player.side === "A");
  const teamB = players.filter((player) => player.side === "B");

  return teamA.flatMap((left) => teamB.map((right) => [left.playerId, right.playerId]));
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function repeated(map: Map<string, number>) {
  return [...map.entries()]
    .filter(([, count]) => count > 1)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function pairLabel(first = "", second = "") {
  return [first, second].sort().join(" / ");
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function min(values: number[]) {
  return values.length === 0 ? 0 : Math.min(...values);
}

function max(values: number[]) {
  return values.length === 0 ? 0 : Math.max(...values);
}

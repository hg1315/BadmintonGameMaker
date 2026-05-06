export type Player = {
  id: string;
  name: string;
  isGeneratedName: boolean;
};

export type Group = {
  id: string;
  name: string;
  order: number;
  players: Player[];
};

export type Court = {
  id: string;
  name: string;
};

export type TeamSide = "A" | "B";

export type MatchStatus = "scheduled" | "completed";

export type MatchPlayer = {
  playerId: string;
  groupId: string;
  side: TeamSide;
};

export type Match = {
  id: string;
  courtId: string;
  startsAt: string;
  endsAt: string;
  groupAId: string;
  groupBId: string;
  players: MatchPlayer[];
  status: MatchStatus;
  manuallyEdited?: boolean;
};

export type MatchResult = {
  matchId: string;
  scoreA: number;
  scoreB: number;
  winnerGroupId: string;
  recorded: boolean;
};

export type ScoringRule = {
  winPoints: number;
  lossPoints: number;
  usePointDifferential: boolean;
  tieBreakers: RankingTieBreaker[];
};

export type RankingTieBreaker =
  | "points"
  | "wins"
  | "pointDifferential"
  | "pointsFor"
  | "pointsAgainst";

export type EventSettings = {
  totalPlayers: number;
  groupCount: number;
  courtCount: number;
  startsAt: string;
  endsAt: string;
  winPoints: number;
  lossPoints: number;
  usePointDifferential: boolean;
};

export type Schedule = {
  players: Player[];
  groups: Group[];
  courts: Court[];
  matches: Match[];
};

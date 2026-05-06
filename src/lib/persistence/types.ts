import type { GroupingState } from "@/lib/grouping-io";
import type { Match, MatchResult, ScoringRule } from "@/lib/types";

export type PersistedState = {
  totalPlayers: number;
  groupCount: number;
  courtCount: number;
  startsAt: string;
  endsAt: string;
  namesText: string;
  scoringRule: ScoringRule;
  grouping: GroupingState | null;
  matches: Match[];
  results: MatchResult[];
};

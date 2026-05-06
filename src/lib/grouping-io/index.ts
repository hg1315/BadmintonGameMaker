import type { Court, Group, Player } from "@/lib/types";

const EXPORT_VERSION = 1;

export type GroupingExportData = {
  version: number;
  exportedAt: string;
  players: Player[];
  groups: Group[];
  courts: Court[];
};

export type GroupingState = Pick<GroupingExportData, "players" | "groups" | "courts">;

export function serializeGrouping(grouping: GroupingState) {
  const payload: GroupingExportData = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    players: grouping.players,
    groups: grouping.groups,
    courts: grouping.courts,
  };

  return JSON.stringify(payload, null, 2);
}

export function parseGroupingJson(json: string): GroupingState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("올바른 JSON 파일이 아닙니다.");
  }

  if (!isGroupingExportData(parsed)) {
    throw new Error("조 편성 JSON 형식이 올바르지 않습니다.");
  }

  return {
    players: parsed.players,
    groups: parsed.groups,
    courts: parsed.courts,
  };
}

export function createGroupingExportFileName(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10);

  return `badminton-grouping-${stamp}.json`;
}

function isGroupingExportData(value: unknown): value is GroupingExportData {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === EXPORT_VERSION &&
    typeof value.exportedAt === "string" &&
    Array.isArray(value.players) &&
    Array.isArray(value.groups) &&
    Array.isArray(value.courts) &&
    value.players.every(isPlayer) &&
    value.groups.every(isGroup) &&
    value.courts.every(isCourt)
  );
}

function isPlayer(value: unknown): value is Player {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.isGeneratedName === "boolean"
  );
}

function isGroup(value: unknown): value is Group {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.order === "number" &&
    Array.isArray(value.players) &&
    value.players.every(isPlayer)
  );
}

function isCourt(value: unknown): value is Court {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

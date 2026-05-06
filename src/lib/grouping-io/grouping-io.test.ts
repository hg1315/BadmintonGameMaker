import { describe, expect, it } from "vitest";
import {
  createGroupingExportFileName,
  parseGroupingJson,
  serializeGrouping,
} from "@/lib/grouping-io";
import type { GroupingState } from "@/lib/grouping-io";

const grouping: GroupingState = {
  players: [
    { id: "player-1", name: "김민수", isGeneratedName: false },
    { id: "player-2", name: "Player 2", isGeneratedName: true },
  ],
  groups: [
    {
      id: "group-1",
      name: "1조",
      order: 1,
      players: [{ id: "player-1", name: "김민수", isGeneratedName: false }],
    },
    {
      id: "group-2",
      name: "2조",
      order: 2,
      players: [{ id: "player-2", name: "Player 2", isGeneratedName: true }],
    },
  ],
  courts: [{ id: "court-1", name: "1코트" }],
};

describe("grouping-io", () => {
  it("조 편성 상태를 JSON으로 직렬화하고 다시 복원한다", () => {
    const json = serializeGrouping(grouping);
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toEqual(expect.any(String));
    expect(parsed.players).toHaveLength(2);
    expect(parsed.groups).toHaveLength(2);
    expect(parsed.courts).toHaveLength(1);
    expect(parseGroupingJson(json)).toEqual(grouping);
  });

  it("잘못된 JSON은 명확한 오류를 던진다", () => {
    expect(() => parseGroupingJson("{")).toThrow("올바른 JSON 파일이 아닙니다.");
    expect(() => parseGroupingJson("{}")).toThrow("조 편성 JSON 형식이 올바르지 않습니다.");
  });

  it("Export 파일명을 날짜 기준으로 만든다", () => {
    expect(createGroupingExportFileName(new Date("2026-06-14T00:00:00.000Z"))).toBe(
      "badminton-grouping-2026-06-14.json",
    );
  });
});

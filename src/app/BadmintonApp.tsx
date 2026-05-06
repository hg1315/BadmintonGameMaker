"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildFairnessReport } from "@/lib/fairness";
import {
  createGroupingExportFileName,
  parseGroupingJson,
  serializeGrouping,
} from "@/lib/grouping-io";
import type { GroupingState } from "@/lib/grouping-io";
import type { PersistedState } from "@/lib/persistence/types";
import { defaultScoringRule, calculateStandings, isTournamentComplete } from "@/lib/scoring";
import {
  calculateMatchCapacity,
  createCourts,
  createGroups,
  createPlayers,
  scheduleMatches,
} from "@/lib/scheduler";
import type { Match, MatchResult, Schedule, ScoringRule } from "@/lib/types";

type Tab = "setup" | "groups" | "schedule" | "fairness" | "results" | "rankings";

const initialStartsAt = "2026-05-06T09:00";
const initialEndsAt = "2026-05-06T12:00";
const persistenceEnabled =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function BadmintonApp() {
  const importInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedStateRef = useRef(false);
  const [tab, setTab] = useState<Tab>("setup");
  const [totalPlayers, setTotalPlayers] = useState(50);
  const [groupCount, setGroupCount] = useState(7);
  const [courtCount, setCourtCount] = useState(3);
  const [startsAt, setStartsAt] = useState(initialStartsAt);
  const [endsAt, setEndsAt] = useState(initialEndsAt);
  const [namesText, setNamesText] = useState("");
  const [scoringRule, setScoringRule] = useState<ScoringRule>(defaultScoringRule);
  const [grouping, setGrouping] = useState<GroupingState | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [error, setError] = useState("");
  const [persistenceStatus, setPersistenceStatus] = useState<
    "disabled" | "loading" | "ready" | "saving" | "error"
  >(persistenceEnabled ? "loading" : "disabled");

  const capacity = calculateMatchCapacity(startsAt, endsAt, courtCount);
  const schedule: Schedule | null = useMemo(() => {
    return grouping ? { ...grouping, matches } : null;
  }, [grouping, matches]);
  const isGroupingComplete = Boolean(grouping);
  const isScheduleGenerated = matches.length > 0;
  const fairness = useMemo(() => {
    if (!schedule || !isScheduleGenerated) {
      return null;
    }

    return buildFairnessReport(schedule.groups, schedule.courts, schedule.matches);
  }, [isScheduleGenerated, schedule]);
  const standings = useMemo(() => {
    if (!schedule || !isScheduleGenerated) {
      return [];
    }

    return calculateStandings(schedule.groups, schedule.matches, results, scoringRule);
  }, [isScheduleGenerated, results, schedule, scoringRule]);

  useEffect(() => {
    if (!persistenceEnabled) {
      hasLoadedStateRef.current = true;
      return;
    }

    let cancelled = false;

    async function loadState() {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });

        if (!response.ok) {
          throw new Error("저장 상태를 불러오지 못했습니다.");
        }

        const data = (await response.json()) as { payload: PersistedState | null };

        if (cancelled) {
          return;
        }

        if (data.payload) {
          setTotalPlayers(data.payload.totalPlayers);
          setGroupCount(data.payload.groupCount);
          setCourtCount(data.payload.courtCount);
          setStartsAt(data.payload.startsAt);
          setEndsAt(data.payload.endsAt);
          setNamesText(data.payload.namesText);
          setScoringRule(data.payload.scoringRule);
          setGrouping(data.payload.grouping);
          setMatches(data.payload.matches);
          setResults(data.payload.results);
        }

        setPersistenceStatus("ready");
      } catch {
        if (!cancelled) {
          setPersistenceStatus("error");
        }
      } finally {
        if (!cancelled) {
          hasLoadedStateRef.current = true;
        }
      }
    }

    loadState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!persistenceEnabled || !hasLoadedStateRef.current) {
      return;
    }

    const timer = setTimeout(async () => {
      const payload: PersistedState = {
        totalPlayers,
        groupCount,
        courtCount,
        startsAt,
        endsAt,
        namesText,
        scoringRule,
        grouping,
        matches,
        results,
      };

      try {
        setPersistenceStatus("saving");
        const response = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });

        if (!response.ok) {
          throw new Error("저장 실패");
        }

        setPersistenceStatus("ready");
      } catch {
        setPersistenceStatus("error");
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [
    totalPlayers,
    groupCount,
    courtCount,
    startsAt,
    endsAt,
    namesText,
    scoringRule,
    grouping,
    matches,
    results,
  ]);

  function resetGeneratedData() {
    setGrouping(null);
    setMatches([]);
    setResults([]);
  }

  function handleCreateGroups() {
    try {
      const names = namesText.split("\n");
      const players = createPlayers(totalPlayers, names);
      const groups = createGroups(players, groupCount);
      const courts = createCourts(courtCount);

      setGrouping({ players, groups, courts });
      setMatches([]);
      setResults([]);
      setError("");
      setTab("groups");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "조 편성에 실패했습니다.");
    }
  }

  function handleGenerateSchedule() {
    if (!grouping) {
      setError("조 편성을 먼저 완료하세요.");
      return;
    }

    try {
      const nextMatches = scheduleMatches(grouping.groups, grouping.courts, startsAt, endsAt);

      setMatches(nextMatches);
      setResults([]);
      setError("");
      setTab("schedule");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "대진표 생성에 실패했습니다.");
    }
  }

  function handleExportGrouping() {
    if (!grouping) {
      return;
    }

    const blob = new Blob([serializeGrouping(grouping)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = createGroupingExportFileName();
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportGrouping(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      const importedGrouping = parseGroupingJson(await file.text());

      setGrouping(importedGrouping);
      setTotalPlayers(importedGrouping.players.length);
      setGroupCount(importedGrouping.groups.length);
      setCourtCount(importedGrouping.courts.length);
      setNamesText(importedGrouping.players.map((player) => player.name).join("\n"));
      setMatches([]);
      setResults([]);
      setError("");
      setTab("groups");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "조 편성 Import에 실패했습니다.");
      setTab("groups");
    } finally {
      input.value = "";
    }
  }

  function updateMatch(matchId: string, patch: Partial<Match>) {
    setMatches((current) =>
      current.map((match) => {
        return match.id === matchId ? { ...match, ...patch, manuallyEdited: true } : match;
      }),
    );
  }

  function recordResult(match: Match, scoreA: number, scoreB: number) {
    if (scoreA === scoreB) {
      return;
    }

    const winnerGroupId = scoreA > scoreB ? match.groupAId : match.groupBId;
    const nextResult: MatchResult = {
      matchId: match.id,
      scoreA,
      scoreB,
      winnerGroupId,
      recorded: true,
    };

    setResults((current) => [
      ...current.filter((result) => result.matchId !== match.id),
      nextResult,
    ]);
  }

  function movePlayerToGroup(playerId: string, targetGroupId: string) {
    setGrouping((current) => {
      if (!current) {
        return current;
      }

      const sourceGroup = current.groups.find((group) =>
        group.players.some((player) => player.id === playerId),
      );
      const targetGroup = current.groups.find((group) => group.id === targetGroupId);
      const player = sourceGroup?.players.find((item) => item.id === playerId);

      if (!sourceGroup || !targetGroup || !player || sourceGroup.id === targetGroup.id) {
        return current;
      }

      setMatches([]);
      setResults([]);

      return {
        ...current,
        groups: current.groups.map((group) => {
          if (group.id === sourceGroup.id) {
            return {
              ...group,
              players: group.players.filter((item) => item.id !== playerId),
            };
          }

          if (group.id === targetGroup.id) {
            return {
              ...group,
              players: [...group.players, player],
            };
          }

          return group;
        }),
      };
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-3xl bg-zinc-950 p-6 text-white shadow-xl">
        <p className="text-sm font-semibold text-emerald-300">Badminton Scheduler</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
          배드민턴 조 대 조 복식 대진표
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-300 sm:text-base">
          운영 시간, 코트 수, 조 개수를 입력하면 15분 단위로 대진표를 만들고 공평성 통계,
          결과 입력, 순위 계산까지 한 화면에서 확인합니다.
        </p>
        <p className="mt-3 text-xs text-zinc-400">
          저장 상태: {persistenceLabel(persistenceStatus)}
        </p>
      </header>

      <nav className="flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm">
        {[
          ["setup", "설정"],
          ["groups", "조 편성"],
          ["schedule", "시간표"],
          ["fairness", "테스트 탭"],
          ["results", "결과 입력"],
          ["rankings", "순위"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value as Tab)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === value ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "setup" && (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">기본 설정</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <NumberField
                label="전체 인원"
                value={totalPlayers}
                onChange={(value) => {
                  setTotalPlayers(value);
                  resetGeneratedData();
                }}
              />
              <NumberField
                label="조 개수"
                value={groupCount}
                onChange={(value) => {
                  setGroupCount(value);
                  resetGeneratedData();
                }}
              />
              <NumberField
                label="코트 수"
                value={courtCount}
                onChange={(value) => {
                  setCourtCount(value);
                  resetGeneratedData();
                }}
              />
              <div>
                <label className="text-sm font-semibold text-zinc-700">예상 경기 수</label>
                <div className="mt-2 rounded-xl bg-zinc-100 px-3 py-3 font-bold">{capacity}경기</div>
              </div>
              <DateField
                label="시작 시간"
                value={startsAt}
                onChange={(value) => {
                  setStartsAt(value);
                  setMatches([]);
                  setResults([]);
                }}
              />
              <DateField
                label="종료 시간"
                value={endsAt}
                onChange={(value) => {
                  setEndsAt(value);
                  setMatches([]);
                  setResults([]);
                }}
              />
            </div>

            <div className="mt-5">
              <label className="text-sm font-semibold text-zinc-700">참가자 이름</label>
              <textarea
                value={namesText}
                onChange={(event) => {
                  setNamesText(event.target.value);
                  resetGeneratedData();
                }}
                placeholder="한 줄에 한 명씩 입력하세요. 비어 있으면 Player 1처럼 자동 이름을 사용합니다."
                className="mt-2 min-h-40 w-full rounded-2xl border border-zinc-200 p-3 text-sm outline-none focus:border-zinc-950"
              />
            </div>

            {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                onClick={handleCreateGroups}
                className="rounded-2xl bg-zinc-950 px-5 py-3 font-bold text-white hover:bg-zinc-800"
              >
                조 편성
              </button>
              <button
                onClick={handleGenerateSchedule}
                disabled={!isGroupingComplete}
                className="rounded-2xl bg-emerald-500 px-5 py-3 font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
              >
                대진표 생성
              </button>
            </div>
            {!isGroupingComplete && (
              <p className="mt-3 text-sm text-zinc-500">
                대진표 생성은 조 편성 완료 후 활성화됩니다.
              </p>
            )}
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">포인트 규칙</h2>
            <div className="mt-5 grid gap-4">
              <NumberField
                label="승리 포인트"
                value={scoringRule.winPoints}
                onChange={(value) => setScoringRule({ ...scoringRule, winPoints: value })}
              />
              <NumberField
                label="패배 포인트"
                value={scoringRule.lossPoints}
                onChange={(value) => setScoringRule({ ...scoringRule, lossPoints: value })}
              />
              <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={scoringRule.usePointDifferential}
                  onChange={(event) =>
                    setScoringRule({
                      ...scoringRule,
                      usePointDifferential: event.target.checked,
                    })
                  }
                />
                득실점 차를 동률 기준에 반영
              </label>
              <p className="rounded-2xl bg-zinc-100 p-4 text-sm leading-6 text-zinc-600">
                기본 동률 기준은 포인트, 득실점 차, 득점, 승리 수, 실점 순서입니다.
              </p>
            </div>
          </div>
        </section>
      )}

      {tab === "groups" && (
        <Panel title="조 편성">
          <div className="mb-4 flex flex-wrap gap-3">
            <button
              onClick={handleExportGrouping}
              disabled={!grouping}
              className="rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
            >
              Export
            </button>
            <button
              onClick={() => importInputRef.current?.click()}
              className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-800 hover:bg-zinc-100"
            >
              Import
            </button>
            <input
              ref={importInputRef}
              data-testid="grouping-import-input"
              type="file"
              accept="application/json,.json"
              onChange={handleImportGrouping}
              className="hidden"
            />
          </div>
          {!schedule ? (
            <EmptyState />
          ) : (
            <>
              <p className="mb-4 rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-600">
                선수를 드래그해서 다른 조 카드 위에 놓으면 조를 이동할 수 있습니다. 조 편성을
                바꾸면 기존 대진표와 결과는 초기화됩니다. Export/Import로 JSON 파일을 저장하거나
                다시 불러올 수 있습니다.
              </p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {schedule.groups.map((group) => (
                  <div
                    key={group.id}
                    data-testid={`group-card-${group.id}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      movePlayerToGroup(event.dataTransfer.getData("text/plain"), group.id);
                    }}
                    className="rounded-2xl border border-dashed border-zinc-300 p-4 transition-colors hover:border-emerald-400 hover:bg-emerald-50/40"
                  >
                    <h3 className="font-bold">{group.name}</h3>
                    <p className="text-sm text-zinc-500" data-testid={`group-count-${group.id}`}>
                      {group.players.length}명
                    </p>
                    <ul className="mt-3 space-y-2 text-sm">
                      {group.players.map((player) => (
                        <li
                          key={player.id}
                          draggable
                          data-testid={`group-player-${player.id}`}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", player.id);
                            event.dataTransfer.effectAllowed = "move";
                          }}
                          className="cursor-grab rounded-xl bg-zinc-100 px-3 py-2 active:cursor-grabbing"
                        >
                          {player.name}
                          {player.isGeneratedName && (
                            <span className="ml-2 text-xs text-zinc-500">자동</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      )}

      {tab === "schedule" && (
        <Panel title="코트별 시간표">
          {!schedule ? (
            <EmptyState />
          ) : !isScheduleGenerated ? (
            <GenerateScheduleState />
          ) : (
            <ScheduleTable schedule={schedule} onUpdate={updateMatch} />
          )}
        </Panel>
      )}

      {tab === "fairness" && (
        <Panel title="테스트 탭: 공평성 통계">
          {!fairness ? <EmptyState /> : <FairnessView report={fairness} />}
        </Panel>
      )}

      {tab === "results" && (
        <Panel title="결과 입력">
          {!schedule ? (
            <EmptyState />
          ) : !isScheduleGenerated ? (
            <GenerateScheduleState />
          ) : (
            <div className="grid gap-3">
              {schedule.matches.map((match) => (
                <ResultRow
                  key={match.id}
                  match={match}
                  schedule={schedule}
                  result={results.find((result) => result.matchId === match.id)}
                  onRecord={recordResult}
                />
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === "rankings" && (
        <Panel title="순위">
          {!schedule ? (
            <EmptyState />
          ) : !isScheduleGenerated ? (
            <GenerateScheduleState />
          ) : (
            <>
              <div className="mb-4 rounded-2xl bg-zinc-100 p-4 text-sm font-semibold">
                {isTournamentComplete(schedule.matches, results)
                  ? "모든 경기 결과가 입력되어 우승 조를 확정할 수 있습니다."
                  : "아직 입력되지 않은 경기 결과가 있어 우승 조는 확정 전입니다."}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-zinc-100 text-zinc-600">
                    <tr>
                      <Th>순위</Th>
                      <Th>조</Th>
                      <Th>경기</Th>
                      <Th>승</Th>
                      <Th>패</Th>
                      <Th>포인트</Th>
                      <Th>득점</Th>
                      <Th>실점</Th>
                      <Th>득실</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((standing, index) => (
                      <tr key={standing.groupId} className="border-b border-zinc-100">
                        <Td>{index + 1}</Td>
                        <Td>{standing.groupName}</Td>
                        <Td>{standing.played}</Td>
                        <Td>{standing.wins}</Td>
                        <Td>{standing.losses}</Td>
                        <Td>{standing.points}</Td>
                        <Td>{standing.pointsFor}</Td>
                        <Td>{standing.pointsAgainst}</Td>
                        <Td>{standing.pointDifferential}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      )}
    </main>
  );
}

function ScheduleTable({
  schedule,
  onUpdate,
}: {
  schedule: Schedule;
  onUpdate: (matchId: string, patch: Partial<Match>) => void;
}) {
  return (
    <div className="grid gap-3">
      {schedule.matches.map((match) => (
        <div key={match.id} className="grid gap-3 rounded-2xl border border-zinc-200 p-4 lg:grid-cols-6">
          <div>
            <p className="text-xs font-semibold text-zinc-500">시간</p>
            <p className="font-bold">
              {timeLabel(match.startsAt)} - {timeLabel(match.endsAt)}
            </p>
          </div>
          <SelectField
            label="코트"
            value={match.courtId}
            options={schedule.courts.map((court) => ({ value: court.id, label: court.name }))}
            onChange={(courtId) => onUpdate(match.id, { courtId })}
          />
          <SelectField
            label="조 A"
            value={match.groupAId}
            options={schedule.groups.map((group) => ({ value: group.id, label: group.name }))}
            onChange={(groupAId) => onUpdate(match.id, { groupAId })}
          />
          <TeamEditor match={match} schedule={schedule} side="A" onUpdate={onUpdate} />
          <SelectField
            label="조 B"
            value={match.groupBId}
            options={schedule.groups.map((group) => ({ value: group.id, label: group.name }))}
            onChange={(groupBId) => onUpdate(match.id, { groupBId })}
          />
          <TeamEditor match={match} schedule={schedule} side="B" onUpdate={onUpdate} />
        </div>
      ))}
    </div>
  );
}

function TeamEditor({
  match,
  schedule,
  side,
  onUpdate,
}: {
  match: Match;
  schedule: Schedule;
  side: "A" | "B";
  onUpdate: (matchId: string, patch: Partial<Match>) => void;
}) {
  const groupId = side === "A" ? match.groupAId : match.groupBId;
  const group = schedule.groups.find((item) => item.id === groupId);
  const players = match.players.filter((player) => player.side === side);

  function setPlayer(index: number, playerId: string) {
    const nextPlayers = match.players.map((player) => {
      if (player.side === side && player.playerId === players[index]?.playerId) {
        return { ...player, playerId, groupId };
      }

      return player;
    });

    onUpdate(match.id, { players: nextPlayers });
  }

  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold text-zinc-500">선수 {side}</p>
      {[0, 1].map((index) => (
        <select
          key={index}
          value={players[index]?.playerId ?? ""}
          onChange={(event) => setPlayer(index, event.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        >
          {group?.players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}

function FairnessView({ report }: { report: ReturnType<typeof buildFairnessReport> }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard title="선수 경기 수" value={`${report.summary.playerMin} - ${report.summary.playerMax}`} />
        <SummaryCard title="조 경기 수" value={`${report.summary.groupMin} - ${report.summary.groupMax}`} />
        <SummaryCard title="코트 경기 수" value={`${report.summary.courtMin} - ${report.summary.courtMax}`} />
      </div>
      <StatsTable
        title="선수별 통계"
        headers={["선수", "조", "경기", "휴식 슬롯", "평균 차이"]}
        rows={report.playerStats.map((stat) => [
          stat.playerName,
          stat.groupName,
          stat.gameCount,
          stat.restSlots,
          stat.averageDelta,
        ])}
      />
      <StatsTable
        title="조별 통계"
        headers={["조", "인원", "경기", "1인 평균 경기"]}
        rows={report.groupStats.map((stat) => [
          stat.groupName,
          stat.playerCount,
          stat.gameCount,
          stat.gamesPerPlayer,
        ])}
      />
      <StatsTable
        title="코트별 통계"
        headers={["코트", "경기", "사용 시간", "평균 차이"]}
        rows={report.courtStats.map((stat) => [
          stat.courtName,
          stat.gameCount,
          `${stat.usedMinutes}분`,
          stat.averageDelta,
        ])}
      />
    </div>
  );
}

function ResultRow({
  match,
  schedule,
  result,
  onRecord,
}: {
  match: Match;
  schedule: Schedule;
  result: MatchResult | undefined;
  onRecord: (match: Match, scoreA: number, scoreB: number) => void;
}) {
  const [scoreA, setScoreA] = useState(result?.scoreA ?? 21);
  const [scoreB, setScoreB] = useState(result?.scoreB ?? 15);
  const groupA = schedule.groups.find((group) => group.id === match.groupAId)?.name;
  const groupB = schedule.groups.find((group) => group.id === match.groupBId)?.name;

  return (
    <div className="grid items-center gap-3 rounded-2xl border border-zinc-200 p-4 md:grid-cols-[1fr_100px_100px_120px]">
      <div>
        <p className="font-bold">
          {timeLabel(match.startsAt)} {groupA} vs {groupB}
        </p>
        <p className="text-sm text-zinc-500">{courtName(schedule, match.courtId)}</p>
      </div>
      <input
        type="number"
        value={scoreA}
        onChange={(event) => setScoreA(Number(event.target.value))}
        className="rounded-xl border border-zinc-200 px-3 py-2"
      />
      <input
        type="number"
        value={scoreB}
        onChange={(event) => setScoreB(Number(event.target.value))}
        className="rounded-xl border border-zinc-200 px-3 py-2"
      />
      <button
        onClick={() => recordResultIfValid(match, scoreA, scoreB, onRecord)}
        className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white"
      >
        {result ? "수정" : "저장"}
      </button>
    </div>
  );
}

function recordResultIfValid(
  match: Match,
  scoreA: number,
  scoreB: number,
  onRecord: (match: Match, scoreA: number, scoreB: number) => void,
) {
  if (scoreA !== scoreB) {
    onRecord(match, scoreA, scoreB);
  }
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-zinc-700">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:border-zinc-950"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-zinc-700">{label}</span>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:border-zinc-950"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="mb-5 text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState() {
  return <p className="rounded-2xl bg-zinc-100 p-6 text-sm text-zinc-600">먼저 설정에서 조 편성을 완료하세요.</p>;
}

function GenerateScheduleState() {
  return (
    <p className="rounded-2xl bg-emerald-50 p-6 text-sm font-semibold text-emerald-800">
      조 편성이 완료되었습니다. 설정 화면에서 대진표 생성을 눌러 시간표를 만드세요.
    </p>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-100 p-4">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function StatsTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div>
      <h3 className="mb-2 font-bold">{title}</h3>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-zinc-100">
            <tr>{headers.map((header) => <Th key={header}>{header}</Th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-zinc-100">
                {row.map((cell, cellIndex) => <Td key={cellIndex}>{cell}</Td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-3 font-bold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3">{children}</td>;
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function courtName(schedule: Schedule, courtId: string) {
  return schedule.courts.find((court) => court.id === courtId)?.name ?? "";
}

function persistenceLabel(status: "disabled" | "loading" | "ready" | "saving" | "error") {
  if (status === "disabled") {
    return "비활성화 (Supabase env 필요)";
  }
  if (status === "loading") {
    return "불러오는 중";
  }
  if (status === "saving") {
    return "저장 중";
  }
  if (status === "error") {
    return "오류";
  }

  return "정상";
}

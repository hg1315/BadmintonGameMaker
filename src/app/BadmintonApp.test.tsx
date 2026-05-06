import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { serializeGrouping } from "@/lib/grouping-io";
import { BadmintonApp } from "./BadmintonApp";

describe("BadmintonApp", () => {
  it("조 편성 전에는 대진표 생성 버튼을 비활성화하고 조 편성 후 활성화한다", () => {
    render(<BadmintonApp />);

    expect(screen.getByRole("button", { name: "대진표 생성" })).toBeDisabled();

    fireEvent.click(screen.getAllByRole("button", { name: "조 편성" }).at(-1)!);
    fireEvent.click(screen.getByRole("button", { name: "설정" }));

    expect(screen.getByRole("button", { name: "대진표 생성" })).toBeEnabled();
  });

  it("조 편성 후 선수를 다른 조로 드래그앤드롭 이동한다", () => {
    render(<BadmintonApp />);

    fireEvent.click(screen.getAllByRole("button", { name: "조 편성" }).at(-1)!);

    expect(screen.getByTestId("group-count-group-1")).toHaveTextContent("8명");
    expect(screen.getByTestId("group-count-group-2")).toHaveTextContent("7명");

    let draggedPlayerId = "";
    const dataTransfer = {
      effectAllowed: "move",
      setData: (_type: string, value: string) => {
        draggedPlayerId = value;
      },
      getData: () => draggedPlayerId,
    };

    fireEvent.dragStart(screen.getByTestId("group-player-player-1"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("group-card-group-2"), { dataTransfer });

    expect(screen.getByTestId("group-count-group-1")).toHaveTextContent("7명");
    expect(screen.getByTestId("group-count-group-2")).toHaveTextContent("8명");
  });

  it("조 편성 JSON을 Import해 조 편성 상태를 복원한다", async () => {
    render(<BadmintonApp />);

    fireEvent.click(screen.getAllByRole("button", { name: "조 편성" })[0]);
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();

    const json = serializeGrouping({
      players: [
        { id: "player-a", name: "A 선수", isGeneratedName: false },
        { id: "player-b", name: "B 선수", isGeneratedName: false },
      ],
      groups: [
        {
          id: "group-a",
          name: "A조",
          order: 1,
          players: [{ id: "player-a", name: "A 선수", isGeneratedName: false }],
        },
        {
          id: "group-b",
          name: "B조",
          order: 2,
          players: [{ id: "player-b", name: "B 선수", isGeneratedName: false }],
        },
      ],
      courts: [{ id: "court-a", name: "A코트" }],
    });
    const file = new File([json], "grouping.json", { type: "application/json" });

    fireEvent.change(screen.getByTestId("grouping-import-input"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByText("A조")).toBeInTheDocument();
    });

    expect(screen.getByText("B조")).toBeInTheDocument();
    expect(screen.getByText("A 선수")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
  });
});

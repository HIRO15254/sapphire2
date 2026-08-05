import { IconCoin } from "@tabler/icons-react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import type { ActiveSessionSceneState } from "./use-active-session-scene-state";

vi.mock("./seat-table", () => ({
	SeatTable: ({
		gameInfo,
		onScanPlayers,
		seats,
	}: {
		gameInfo?: { name?: string | null };
		onScanPlayers: () => void;
		seats: { seatPosition: number }[];
	}) => (
		<div data-testid="seat-table">
			<span>seats:{seats.length}</span>
			<span>game:{gameInfo?.name ?? "none"}</span>
			<button onClick={onScanPlayers} type="button">
				scan
			</button>
		</div>
	),
}));

vi.mock(
	"@/features/live-sessions/components/seat-from-screenshot-sheet",
	() => ({
		SeatFromScreenshotSheet: ({ open }: { open: boolean }) =>
			open ? <div>Seat from screenshot sheet</div> : null,
	})
);

vi.mock("./game-settings-sheet", () => ({
	GameSettingsSheet: ({ open }: { open: boolean }) =>
		open ? <div>Game settings sheet</div> : null,
}));

vi.mock("./history-section", () => ({
	HistorySection: ({
		sessionId,
		sessionType,
	}: {
		sessionId: string;
		sessionType: string;
	}) => (
		<div data-testid="history-section">
			{sessionType}:{sessionId}
		</div>
	),
}));

import { ActiveSessionScene } from "./active-session-scene";

function makeState(
	overrides: Partial<ActiveSessionSceneState> = {}
): ActiveSessionSceneState {
	return {
		excludePlayerIds: [],
		heroAvailable: true,
		heroSeatPosition: null,
		occupiedSeatPositions: new Set<number>(),
		onRemovePlayer: vi.fn(),
		onSeatExisting: vi.fn(),
		onSeatHero: vi.fn(),
		onSeatNew: vi.fn(),
		onSeatTemporary: vi.fn(),
		onUnseatHero: vi.fn(),
		seats: [],
		sessionParam: { liveCashGameSessionId: "s-1" },
		tableSize: 9,
		unseatedPlayers: [],
		...overrides,
	};
}

function setup(
	overrides: Partial<React.ComponentProps<typeof ActiveSessionScene>> = {}
) {
	const props: React.ComponentProps<typeof ActiveSessionScene> = {
		eventMenuExtraItems: [],
		isDiscardPending: false,
		onDiscard: vi.fn(),
		onEndSession: vi.fn(),
		onPause: vi.fn(),
		state: makeState(),
		summary: <div data-testid="summary" />,
		title: "Cash Game",
		...overrides,
	};
	render(<ActiveSessionScene {...props} />);
	return props;
}

describe("ActiveSessionScene", () => {
	it("renders the title, summary, memo, seat table and history", () => {
		setup({ memo: "Session memo" });
		expect(screen.getByText("Cash Game")).toBeInTheDocument();
		expect(screen.getByTestId("summary")).toBeInTheDocument();
		expect(screen.getByText("Session memo")).toBeInTheDocument();
		expect(screen.getByTestId("seat-table")).toBeInTheDocument();
		expect(screen.getByTestId("history-section")).toHaveTextContent(
			"cash_game:s-1"
		);
	});

	it("renders no memo paragraph when memo is null", () => {
		setup({ memo: null });
		expect(screen.queryByText("Session memo")).not.toBeInTheDocument();
	});

	it("renders the topSlot above the summary when given", () => {
		setup({ topSlot: <div data-testid="top-slot" /> });
		expect(screen.getByTestId("top-slot")).toBeInTheDocument();
	});

	it("opens the session menu from the header overflow button", async () => {
		const user = userEvent.setup();
		setup();
		expect(screen.queryByText("Pause session")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Session actions" }));
		expect(screen.getByText("Pause session")).toBeInTheDocument();
		expect(screen.getByText("End session")).toBeInTheDocument();
		expect(screen.getByText("Game settings")).toBeInTheDocument();
		expect(screen.getByText("Discard session")).toBeInTheDocument();
	});

	it("'Pause session' invokes onPause once", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "Session actions" }));
		await user.click(screen.getByRole("button", { name: "Pause session" }));
		expect(props.onPause).toHaveBeenCalledTimes(1);
	});

	it("'End session' invokes onEndSession once", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "Session actions" }));
		await user.click(screen.getByRole("button", { name: "End session" }));
		expect(props.onEndSession).toHaveBeenCalledTimes(1);
	});

	it("'Discard session' opens the confirm dialog and confirming discards", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "Session actions" }));
		await user.click(screen.getByRole("button", { name: "Discard session" }));
		expect(screen.getByText("Discard Session")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Discard" }));
		expect(props.onDiscard).toHaveBeenCalledTimes(1);
	});

	it("'Game settings' opens the game settings sheet", async () => {
		const user = userEvent.setup();
		setup();
		await user.click(screen.getByRole("button", { name: "Session actions" }));
		await user.click(screen.getByRole("button", { name: "Game settings" }));
		expect(screen.getByText("Game settings sheet")).toBeInTheDocument();
	});

	it("lists the type-specific event actions inside the header session menu", async () => {
		const user = userEvent.setup();
		const allIn = vi.fn();
		setup({
			eventMenuExtraItems: [
				{ icon: IconCoin, label: "All-in", onSelect: allIn },
			],
		});
		await user.click(screen.getByRole("button", { name: "Session actions" }));
		expect(screen.getByText("All-in")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "All-in" }));
		expect(allIn).toHaveBeenCalledTimes(1);
	});

	it("renders the seat table with the seats from state", () => {
		setup({
			state: makeState({
				seats: [
					{ isHero: false, player: null, seatPosition: 0 },
					{ isHero: false, player: null, seatPosition: 1 },
				],
			}),
		});
		expect(screen.getByTestId("seat-table")).toHaveTextContent("seats:2");
	});

	it("forwards gameInfo to the seat table", () => {
		setup({ gameInfo: { name: "NLH" } });
		expect(screen.getByTestId("seat-table")).toHaveTextContent("game:NLH");
	});

	it("renders the seat table without game info when none is given", () => {
		setup();
		expect(screen.getByTestId("seat-table")).toHaveTextContent("game:none");
	});

	it("the seat table scan action opens the screenshot sheet", async () => {
		const user = userEvent.setup();
		setup();
		expect(
			screen.queryByText("Seat from screenshot sheet")
		).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "scan" }));
		expect(screen.getByText("Seat from screenshot sheet")).toBeInTheDocument();
	});

	it("derives the tournament history props from the session param", () => {
		setup({
			state: makeState({
				sessionParam: { liveTournamentSessionId: "t-9" },
			}),
			title: "Tournament",
		});
		expect(screen.getByTestId("history-section")).toHaveTextContent(
			"tournament:t-9"
		);
	});
});

import { IconCoin } from "@tabler/icons-react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import type { ActiveSessionSceneState } from "./use-active-session-scene-state";

vi.mock("@/features/live-sessions/components/add-player-sheet", () => ({
	AddPlayerSheet: ({ open }: { open: boolean }) =>
		open ? <div>Add player sheet</div> : null,
}));

vi.mock("@/features/live-sessions/components/player-detail-sheet", () => ({
	PlayerDetailSheet: ({ open }: { open: boolean }) =>
		open ? <div>Player detail sheet</div> : null,
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

const REGEX_ALICE = /Alice/;

function makeState(
	overrides: Partial<ActiveSessionSceneState> = {}
): ActiveSessionSceneState {
	return {
		addPlayerSheetOpen: false,
		availableTags: [],
		createTag: vi.fn(),
		excludePlayerIds: [],
		heroSeatPosition: null,
		isSavingPlayer: false,
		occupiedSeatPositions: new Set<number>(),
		onAddExisting: vi.fn(),
		onAddNew: vi.fn(),
		onAddTemporary: vi.fn(),
		onOpenAddPlayer: vi.fn(),
		onPlayerRemove: vi.fn(),
		onPlayerSave: vi.fn(),
		onPlayerTap: vi.fn(),
		players: [],
		playerSheetOpen: false,
		selectedPlayer: null,
		sessionParam: { liveCashGameSessionId: "s-1" },
		setAddPlayerSheetOpen: vi.fn(),
		setPlayerSheetOpen: vi.fn(),
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
	it("renders the title, summary, memo, player list and history", () => {
		setup({ memo: "Session memo" });
		expect(screen.getByText("Cash Game")).toBeInTheDocument();
		expect(screen.getByTestId("summary")).toBeInTheDocument();
		expect(screen.getByText("Session memo")).toBeInTheDocument();
		expect(screen.getByText("Players")).toBeInTheDocument();
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

	it("tapping a player row reports the playerId", async () => {
		const user = userEvent.setup();
		const state = makeState({
			players: [
				{
					id: "tp-1",
					isLoading: false,
					isTemporary: false,
					name: "Alice",
					playerId: "p-1",
					seatPosition: 0,
					tags: [],
				},
			],
		});
		setup({ state });
		await user.click(screen.getByRole("button", { name: REGEX_ALICE }));
		expect(state.onPlayerTap).toHaveBeenCalledTimes(1);
		expect(state.onPlayerTap).toHaveBeenCalledWith("p-1");
	});

	it("the 'Add player' list action opens the add-player sheet", async () => {
		const user = userEvent.setup();
		const state = makeState();
		setup({ state });
		await user.click(screen.getByRole("button", { name: "Add player" }));
		expect(state.onOpenAddPlayer).toHaveBeenCalledTimes(1);
	});

	it("the scan list action opens the screenshot sheet", async () => {
		const user = userEvent.setup();
		setup();
		await user.click(
			screen.getByRole("button", { name: "Seat from screenshot" })
		);
		expect(screen.getByText("Seat from screenshot sheet")).toBeInTheDocument();
	});

	it("renders the player detail sheet when a player is selected", () => {
		setup({ state: makeState({ playerSheetOpen: true }) });
		expect(screen.getByText("Player detail sheet")).toBeInTheDocument();
	});

	it("renders the add player sheet when open", () => {
		setup({ state: makeState({ addPlayerSheetOpen: true }) });
		expect(screen.getByText("Add player sheet")).toBeInTheDocument();
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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
	ActiveSessionScene,
	type ActiveSessionSceneState,
} from "../active-session-scene";

vi.mock("@/live-sessions/components/poker-table", () => ({
	PokerTable: ({
		onEmptySeatTap,
		onPlayerSeatTap,
	}: {
		onEmptySeatTap: (seatPosition: number) => void;
		onPlayerSeatTap: (
			player: {
				id: string;
				isActive: boolean;
				player: { id: string; name: string };
				seatPosition: number | null;
			},
			seatPosition: number
		) => void;
	}) => (
		<div>
			<button onClick={() => onEmptySeatTap(3)} type="button">
				Tap empty seat
			</button>
			<button
				onClick={() =>
					onPlayerSeatTap(
						{
							id: "table-player-1",
							isActive: true,
							player: { id: "player-1", name: "Alice" },
							seatPosition: 1,
						},
						1
					)
				}
				type="button"
			>
				Tap player seat
			</button>
		</div>
	),
}));

vi.mock("@/live-sessions/components/add-player-sheet", () => ({
	AddPlayerSheet: ({ open }: { open: boolean }) =>
		open ? <div>Add player sheet</div> : null,
}));

vi.mock("@/live-sessions/components/player-detail-sheet", () => ({
	PlayerDetailSheet: ({ open }: { open: boolean }) =>
		open ? <div>Player detail sheet</div> : null,
}));

vi.mock("@/shared/components/ui/responsive-dialog", () => ({
	ResponsiveDialog: ({
		children,
		description,
		open,
		title,
	}: {
		children: ReactNode;
		description?: ReactNode;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div>
				<h2>{title}</h2>
				{description}
				{children}
			</div>
		) : null,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveCashGameSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["cash-session", id],
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["tournament-session", id],
				}),
			},
		},
		player: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["player", id],
				}),
			},
		},
		playerTag: {
			list: {
				queryOptions: () => ({
					queryKey: ["player-tags"],
				}),
			},
		},
	},
	trpcClient: {
		liveCashGameSession: {
			updateHeroSeat: { mutate: vi.fn() },
		},
		liveTournamentSession: {
			updateHeroSeat: { mutate: vi.fn() },
		},
		player: {
			update: { mutate: vi.fn() },
		},
		playerTag: {
			create: { mutate: vi.fn() },
		},
	},
}));

function createState(
	overrides: Partial<ActiveSessionSceneState> = {}
): ActiveSessionSceneState {
	return {
		addPlayerSheetOpen: false,
		availableTags: [],
		createTag: vi.fn(async () => ({
			color: "blue",
			id: "tag-1",
			name: "VIP",
		})),
		excludePlayerIds: [],
		heroSeatPosition: null,
		isSavingPlayer: false,
		onAddExisting: vi.fn(),
		onAddNew: vi.fn(),
		onEmptySeatTap: vi.fn(),
		onHeroSeatTap: vi.fn(),
		onPlayerRemove: vi.fn(),
		onPlayerSave: vi.fn(),
		onPlayerSeatTap: vi.fn(),
		players: [],
		playerSheetOpen: false,
		selectedPlayer: null,
		setAddPlayerSheetOpen: vi.fn(),
		setPlayerSheetOpen: vi.fn(),
		waitingForHero: true,
		...overrides,
	};
}

describe("ActiveSessionScene", () => {
	it("renders the session title and summary content", () => {
		render(
			<ActiveSessionScene
				isDiscardPending={false}
				onDiscard={vi.fn()}
				state={createState()}
				summary={<div>Cash summary</div>}
				title="Cash Game"
			/>
		);

		expect(screen.getByText("Cash Game")).toBeInTheDocument();
		expect(screen.getByText("Cash summary")).toBeInTheDocument();
	});

	it("opens and closes the discard dialog and confirms discard", async () => {
		const user = userEvent.setup();
		const onDiscard = vi.fn();

		render(
			<ActiveSessionScene
				isDiscardPending={false}
				onDiscard={onDiscard}
				state={createState()}
				summary={<div>Tournament summary</div>}
				title="Tournament"
			/>
		);

		await user.click(screen.getByRole("button", { name: "Discard" }));
		expect(screen.getByText("Discard Session")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByText("Discard Session")).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Discard" }));
		const discardButtons = screen.getAllByRole("button", { name: "Discard" });
		const confirmDiscardButton = discardButtons[1];
		expect(confirmDiscardButton).toBeDefined();
		if (!confirmDiscardButton) {
			throw new Error("Expected discard confirmation button");
		}
		await user.click(confirmDiscardButton);

		expect(onDiscard).toHaveBeenCalled();
	});

	it("keeps the add-player and player-detail connections wired through the scene", async () => {
		const user = userEvent.setup();
		const state = createState({
			addPlayerSheetOpen: true,
			onEmptySeatTap: vi.fn(),
			onPlayerSeatTap: vi.fn(),
			playerSheetOpen: true,
			selectedPlayer: {
				id: "player-1",
				memo: null,
				name: "Alice",
				tags: [],
			},
		});

		render(
			<ActiveSessionScene
				isDiscardPending={false}
				onDiscard={vi.fn()}
				state={state}
				summary={<div>Scene summary</div>}
				title="Cash Game"
			/>
		);

		expect(screen.getByText("Add player sheet")).toBeInTheDocument();
		expect(screen.getByText("Player detail sheet")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Tap empty seat" }));
		await user.click(screen.getByRole("button", { name: "Tap player seat" }));

		expect(state.onEmptySeatTap).toHaveBeenCalledWith(3);
		expect(state.onPlayerSeatTap).toHaveBeenCalledWith(
			expect.objectContaining({
				player: { id: "player-1", name: "Alice" },
			}),
			1
		);
	});
});

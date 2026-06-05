import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tournament } from "@/features/rooms/hooks/use-tournaments";

const hoisted = vi.hoisted(() => ({
	useTournamentTab: vi.fn(),
}));

vi.mock("./use-tournament-tab", () => ({
	useTournamentTab: hoisted.useTournamentTab,
}));

vi.mock("@/features/rooms/components/tournament-form-sheet", () => ({
	TournamentFormSheet: ({ open, title }: { open: boolean; title: string }) =>
		open ? <div data-testid="tournament-sheet">{title}</div> : null,
}));

vi.mock("@/features/rooms/components/game-actions-drawer", () => ({
	GameActionsDrawer: ({
		open,
		isArchived,
		onArchive,
		onDelete,
		onEdit,
		onRestore,
	}: {
		isArchived: boolean;
		onArchive: () => void;
		onDelete: () => void;
		onEdit: () => void;
		onRestore: () => void;
		open: boolean;
	}) =>
		open ? (
			<div data-archived={String(isArchived)} data-testid="game-actions">
				<button onClick={onEdit} type="button">
					drawer-edit
				</button>
				<button onClick={onArchive} type="button">
					drawer-archive
				</button>
				<button onClick={onRestore} type="button">
					drawer-restore
				</button>
				<button onClick={onDelete} type="button">
					drawer-delete
				</button>
			</div>
		) : null,
}));

vi.mock("@/features/rooms/components/delete-game-dialog", () => ({
	DeleteGameDialog: ({ open, name }: { name: string; open: boolean }) =>
		open ? <div data-testid="delete-dialog">{name}</div> : null,
}));

import { TournamentTab } from "./tournament-tab";

const LEVELS_RE = /12 levels/;

const baseTournament = (overrides: Partial<Tournament> = {}): Tournament =>
	({
		archivedAt: null,
		blindLevelCount: 0,
		bountyAmount: null,
		buyIn: 10_000,
		chipPurchases: [],
		createdAt: "",
		currencyId: "currency-1",
		entryFee: 1000,
		id: "tournament-1",
		memo: null,
		name: "Sunday Major",
		startingStack: 20_000,
		roomId: "room-1",
		tableSize: 9,
		tags: [],
		updatedAt: "",
		variant: "nlh",
		...overrides,
	}) as Tournament;

interface TabState {
	actionsTarget: Tournament | null;
	activeLoading: boolean;
	activeTournaments: Tournament[];
	archivedLoading: boolean;
	archivedTournaments: Tournament[];
	cancelDelete: ReturnType<typeof vi.fn>;
	closeActions: ReturnType<typeof vi.fn>;
	currencies: { id: string; name: string; unit?: string | null }[];
	editBlindLevelsLoading: boolean;
	editInitialFormValues: undefined;
	editInitialLevels: never[];
	editingTournament: Tournament | null;
	handleArchiveFromActions: ReturnType<typeof vi.fn>;
	handleConfirmDelete: ReturnType<typeof vi.fn>;
	handleCreate: ReturnType<typeof vi.fn>;
	handleRestoreFromActions: ReturnType<typeof vi.fn>;
	handleUpdate: ReturnType<typeof vi.fn>;
	isCreateLoading: boolean;
	isCreateOpen: boolean;
	isUpdateLoading: boolean;
	openActions: ReturnType<typeof vi.fn>;
	openDeleteFromActions: ReturnType<typeof vi.fn>;
	openEditFromActions: ReturnType<typeof vi.fn>;
	pendingDelete: Tournament | null;
	setEditingTournament: ReturnType<typeof vi.fn>;
	setIsCreateOpen: ReturnType<typeof vi.fn>;
	showArchived: boolean;
	toggleArchived: ReturnType<typeof vi.fn>;
}

function setState(overrides: Partial<TabState> = {}): TabState {
	const state: TabState = {
		activeTournaments: [],
		archivedTournaments: [],
		currencies: [],
		activeLoading: false,
		archivedLoading: false,
		showArchived: false,
		toggleArchived: vi.fn(),
		isCreateOpen: false,
		setIsCreateOpen: vi.fn(),
		editingTournament: null,
		setEditingTournament: vi.fn(),
		actionsTarget: null,
		pendingDelete: null,
		isCreateLoading: false,
		isUpdateLoading: false,
		editBlindLevelsLoading: false,
		editInitialFormValues: undefined,
		editInitialLevels: [],
		handleCreate: vi.fn(),
		handleUpdate: vi.fn(),
		openActions: vi.fn(),
		closeActions: vi.fn(),
		openEditFromActions: vi.fn(),
		openDeleteFromActions: vi.fn(),
		handleArchiveFromActions: vi.fn(),
		handleRestoreFromActions: vi.fn(),
		cancelDelete: vi.fn(),
		handleConfirmDelete: vi.fn(),
		...overrides,
	};
	hoisted.useTournamentTab.mockReturnValue(state);
	return state;
}

describe("TournamentTab", () => {
	beforeEach(() => {
		hoisted.useTournamentTab.mockReset();
	});

	it("renders the add control without a redundant section heading", () => {
		setState();
		render(<TournamentTab roomId="room-1" />);
		// The enclosing tab already names the section, so no in-panel heading.
		expect(
			screen.queryByRole("heading", { name: "Tournaments" })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Add tournament" })
		).toBeInTheDocument();
	});

	it("renders a row per active tournament with its level count", () => {
		setState({
			activeTournaments: [baseTournament({ blindLevelCount: 12 })],
		});
		render(<TournamentTab roomId="room-1" />);
		expect(screen.getByText("Sunday Major")).toBeInTheDocument();
		expect(screen.getByText(LEVELS_RE)).toBeInTheDocument();
	});

	it("shows the empty state when there are no active tournaments", () => {
		setState({ activeTournaments: [] });
		render(<TournamentTab roomId="room-1" />);
		expect(screen.getByText("No tournaments yet.")).toBeInTheDocument();
	});

	it("opens the create sheet when the add button is clicked", async () => {
		const user = userEvent.setup();
		const state = setState();
		render(<TournamentTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name: "Add tournament" }));
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("toggles the archived view from the disclosure control", async () => {
		const user = userEvent.setup();
		const state = setState();
		render(<TournamentTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name: "Show archived" }));
		expect(state.toggleArchived).toHaveBeenCalledTimes(1);
	});

	it("opens the actions drawer for a row via its overflow button", async () => {
		const user = userEvent.setup();
		const t = baseTournament();
		const state = setState({ activeTournaments: [t] });
		render(<TournamentTab roomId="room-1" />);
		await user.click(
			screen.getByRole("button", { name: "Actions for Sunday Major" })
		);
		expect(state.openActions).toHaveBeenCalledWith(t);
	});

	it("wires the actions drawer to the hook handlers when a target is set", async () => {
		const user = userEvent.setup();
		const state = setState({ actionsTarget: baseTournament() });
		render(<TournamentTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name: "drawer-edit" }));
		expect(state.openEditFromActions).toHaveBeenCalledTimes(1);
		await user.click(screen.getByRole("button", { name: "drawer-delete" }));
		expect(state.openDeleteFromActions).toHaveBeenCalledTimes(1);
	});

	it("opens the create tournament sheet when isCreateOpen is true", () => {
		setState({ isCreateOpen: true });
		render(<TournamentTab roomId="room-1" />);
		// The add button also reads "Add tournament", so assert on the sheet itself.
		expect(screen.getByTestId("tournament-sheet")).toHaveTextContent(
			"Add tournament"
		);
	});

	it("opens the edit tournament sheet when a tournament is being edited", () => {
		setState({ editingTournament: baseTournament() });
		render(<TournamentTab roomId="room-1" />);
		expect(screen.getByText("Edit tournament")).toBeInTheDocument();
	});

	it("shows the delete dialog with the pending tournament name", () => {
		setState({ pendingDelete: baseTournament({ name: "Doomed Series" }) });
		render(<TournamentTab roomId="room-1" />);
		expect(screen.getByTestId("delete-dialog")).toHaveTextContent(
			"Doomed Series"
		);
	});
});

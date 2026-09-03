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
	TournamentFormSheet: ({
		editBlindLevelsError,
		formId,
		onOpenChange,
		onRetryBlindLevels,
		onSave,
		open,
		title,
	}: {
		editBlindLevelsError?: boolean;
		formId: string;
		onOpenChange: (open: boolean) => void;
		onRetryBlindLevels?: () => void;
		onSave: (values: unknown, levels: unknown[]) => void;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div
				data-blind-level-error={String(editBlindLevelsError ?? false)}
				data-testid="tournament-sheet"
			>
				{title}
				<button onClick={onRetryBlindLevels} type="button">
					Retry blind levels
				</button>
				<button onClick={() => onSave({ name: "Saved" }, [])} type="button">
					{`save-${formId}`}
				</button>
				<button onClick={() => onOpenChange(false)} type="button">
					{`cancel-${formId}`}
				</button>
			</div>
		) : null,
}));

vi.mock("@/features/rooms/components/game-actions-drawer", () => ({
	GameActionsDrawer: ({
		open,
		isArchived,
		onArchive,
		onDelete,
		onEdit,
		onOpenChange,
		onRestore,
	}: {
		isArchived: boolean;
		onArchive: () => void;
		onDelete: () => void;
		onEdit: () => void;
		onOpenChange: (open: boolean) => void;
		onRestore: () => void;
		open: boolean;
	}) =>
		open ? (
			<div data-archived={String(isArchived)} data-testid="game-actions">
				<button onClick={() => onEdit()} type="button">
					drawer-edit
				</button>
				<button onClick={onArchive} type="button">
					drawer-archive
				</button>
				<button onClick={onRestore} type="button">
					drawer-restore
				</button>
				<button onClick={() => onDelete()} type="button">
					drawer-delete
				</button>
				<button onClick={() => onOpenChange(false)} type="button">
					drawer-dismiss
				</button>
			</div>
		) : null,
}));

vi.mock("@/features/rooms/components/delete-game-dialog", () => ({
	DeleteGameDialog: ({
		name,
		onConfirm,
		onOpenChange,
		open,
	}: {
		name: string;
		onConfirm: () => void;
		onOpenChange: (open: boolean) => void;
		open: boolean;
	}) =>
		open ? (
			<div data-testid="delete-dialog">
				{name}
				<button onClick={() => onConfirm()} type="button">
					dialog-confirm
				</button>
				<button onClick={() => onOpenChange(false)} type="button">
					dialog-dismiss
				</button>
			</div>
		) : null,
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
	editBlindLevelsError: boolean;
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
	isInitialLoadError: boolean;
	isUpdateLoading: boolean;
	onRetry: ReturnType<typeof vi.fn>;
	openActions: ReturnType<typeof vi.fn>;
	openDeleteFromActions: ReturnType<typeof vi.fn>;
	openEditFromActions: ReturnType<typeof vi.fn>;
	pendingDelete: Tournament | null;
	retryEditBlindLevels: ReturnType<typeof vi.fn>;
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
		isInitialLoadError: false,
		onRetry: vi.fn(),
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
		editBlindLevelsError: false,
		editBlindLevelsLoading: false,
		editInitialFormValues: undefined,
		editInitialLevels: [],
		retryEditBlindLevels: vi.fn(),
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

	it("renders skeleton cards instead of the empty state while loading", () => {
		setState({ activeLoading: true });
		const { container } = render(<TournamentTab roomId="room-1" />);
		expect(
			container.querySelectorAll("[data-slot='skeleton']").length
		).toBeGreaterThan(0);
		expect(screen.queryByText("No tournaments yet.")).not.toBeInTheDocument();
	});

	it("shows the tournament load error and retries the active list", async () => {
		const user = userEvent.setup();
		const state = setState({ isInitialLoadError: true });
		render(<TournamentTab roomId="room-1" />);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Unable to load tournaments"
		);
		expect(screen.queryByText("No tournaments yet.")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Retry" }));
		expect(state.onRetry).toHaveBeenCalledTimes(1);
	});

	it("shows the empty state when there are no active tournaments", () => {
		setState({ activeTournaments: [] });
		render(<TournamentTab roomId="room-1" />);
		expect(screen.getByText("No tournaments yet.")).toBeInTheDocument();
	});

	it("renders a row per active tournament with its level count", () => {
		setState({
			activeTournaments: [
				baseTournament({ blindLevelCount: 12 }),
				baseTournament({ id: "t2", name: "Monday Turbo" }),
			],
		});
		render(<TournamentTab roomId="room-1" />);
		expect(screen.getByText("Sunday Major")).toBeInTheDocument();
		expect(screen.getByText(LEVELS_RE)).toBeInTheDocument();
		expect(screen.getByText("Monday Turbo")).toBeInTheDocument();
		expect(screen.queryByText("No tournaments yet.")).not.toBeInTheDocument();
	});

	it("opens the create sheet when the add button is clicked", async () => {
		const user = userEvent.setup();
		const state = setState();
		render(<TournamentTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name: "Add tournament" }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("labels the archived toggle by showArchived and routes clicks to toggleArchived", async () => {
		const user = userEvent.setup();
		const state = setState({ showArchived: false });
		const { rerender } = render(<TournamentTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name: "Show archived" }));
		expect(state.toggleArchived).toHaveBeenCalledTimes(1);

		setState({ showArchived: true });
		rerender(<TournamentTab roomId="room-1" />);
		expect(
			screen.getByRole("button", { name: "Hide archived" })
		).toBeInTheDocument();
		expect(screen.getByText("Archived")).toBeInTheDocument();
	});

	it("opens the actions drawer for a row via its overflow button", async () => {
		const user = userEvent.setup();
		const t = baseTournament();
		const state = setState({ activeTournaments: [t] });
		render(<TournamentTab roomId="room-1" />);
		await user.click(
			screen.getByRole("button", { name: "Actions for Sunday Major" })
		);
		expect(state.openActions).toHaveBeenCalledTimes(1);
		expect(state.openActions).toHaveBeenCalledWith(t);
	});

	it.each([
		["drawer-edit", "openEditFromActions"],
		["drawer-archive", "handleArchiveFromActions"],
		["drawer-restore", "handleRestoreFromActions"],
		["drawer-delete", "openDeleteFromActions"],
	] as const)("routes %s to %s", async (name, handler) => {
		const user = userEvent.setup();
		const state = setState({ actionsTarget: baseTournament() });
		render(<TournamentTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name }));
		expect(state[handler]).toHaveBeenCalledTimes(1);
	});

	it("marks the actions drawer as archived only when the target is archived", () => {
		setState({ actionsTarget: baseTournament() });
		const { rerender } = render(<TournamentTab roomId="room-1" />);
		expect(screen.getByTestId("game-actions")).toHaveAttribute(
			"data-archived",
			"false"
		);

		setState({
			actionsTarget: baseTournament({ archivedAt: "2026-01-01" }),
		});
		rerender(<TournamentTab roomId="room-1" />);
		expect(screen.getByTestId("game-actions")).toHaveAttribute(
			"data-archived",
			"true"
		);
	});

	it("opens the create sheet only while isCreateOpen is true", () => {
		setState({ isCreateOpen: false });
		const { rerender } = render(<TournamentTab roomId="room-1" />);
		expect(screen.queryByTestId("tournament-sheet")).not.toBeInTheDocument();

		setState({ isCreateOpen: true });
		rerender(<TournamentTab roomId="room-1" />);
		expect(screen.getByTestId("tournament-sheet")).toHaveTextContent(
			"Add tournament"
		);
	});

	it("opens the edit sheet only while a tournament is being edited", () => {
		setState({ editingTournament: null });
		const { rerender } = render(<TournamentTab roomId="room-1" />);
		expect(screen.queryByText("Edit tournament")).not.toBeInTheDocument();

		setState({ editingTournament: baseTournament() });
		rerender(<TournamentTab roomId="room-1" />);
		expect(screen.getByTestId("tournament-sheet")).toHaveTextContent(
			"Edit tournament"
		);
	});

	it("passes blind-level load errors and retry to the edit sheet", async () => {
		const user = userEvent.setup();
		const state = setState({
			editBlindLevelsError: true,
			editingTournament: baseTournament(),
		});
		render(<TournamentTab roomId="room-1" />);

		expect(screen.getByTestId("tournament-sheet")).toHaveAttribute(
			"data-blind-level-error",
			"true"
		);
		await user.click(
			screen.getByRole("button", { name: "Retry blind levels" })
		);
		expect(state.retryEditBlindLevels).toHaveBeenCalledTimes(1);
	});

	it.each([
		["tournament-create-form", "handleCreate", { isCreateOpen: true }],
		[
			"tournament-edit-form",
			"handleUpdate",
			{ editingTournament: baseTournament() },
		],
	] as const)("saves %s through %s", async (formId, handler, overrides: Partial<TabState>) => {
		const user = userEvent.setup();
		const state = setState(overrides);
		render(<TournamentTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name: `save-${formId}` }));
		expect(state[handler]).toHaveBeenCalledTimes(1);
		expect(state[handler]).toHaveBeenCalledWith({ name: "Saved" }, []);
	});

	it("shows the delete dialog with the pending tournament name only while a delete is pending", () => {
		setState({ pendingDelete: null });
		const { rerender } = render(<TournamentTab roomId="room-1" />);
		expect(screen.queryByTestId("delete-dialog")).not.toBeInTheDocument();

		setState({ pendingDelete: baseTournament({ name: "Doomed Series" }) });
		rerender(<TournamentTab roomId="room-1" />);
		expect(screen.getByTestId("delete-dialog")).toHaveTextContent(
			"Doomed Series"
		);
	});

	it.each([
		[
			"dialog-confirm",
			"handleConfirmDelete",
			{ pendingDelete: baseTournament() },
			[],
		],
		["dialog-dismiss", "cancelDelete", { pendingDelete: baseTournament() }, []],
		["drawer-dismiss", "closeActions", { actionsTarget: baseTournament() }, []],
		[
			"cancel-tournament-edit-form",
			"setEditingTournament",
			{ editingTournament: baseTournament() },
			[null],
		],
		[
			"cancel-tournament-create-form",
			"setIsCreateOpen",
			{ isCreateOpen: true },
			[false],
		],
	] as const)("routes %s to %s", async (name, handler, overrides: Partial<TabState>, args) => {
		const user = userEvent.setup();
		const state = setState(overrides);
		render(<TournamentTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name }));
		expect(state[handler]).toHaveBeenCalledTimes(1);
		expect(state[handler]).toHaveBeenCalledWith(...args);
	});
});

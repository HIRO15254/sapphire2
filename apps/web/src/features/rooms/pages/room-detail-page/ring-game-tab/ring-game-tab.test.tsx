import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	RingGame,
	RingGameFormValues,
} from "@/features/rooms/hooks/use-ring-games";

const hoisted = vi.hoisted(() => ({
	useRingGameTab: vi.fn(),
}));

vi.mock("./use-ring-game-tab", () => ({
	useRingGameTab: hoisted.useRingGameTab,
}));

vi.mock("@/features/rooms/components/ring-game-form", () => ({
	RingGameForm: ({ defaultValues }: { defaultValues?: RingGameFormValues }) => (
		<div
			data-testid="ring-game-form"
			data-variant-id={defaultValues?.variantId ?? ""}
		/>
	),
}));

vi.mock("@/shared/components/form-sheet", () => ({
	FormSheet: ({
		children,
		open,
		title,
	}: {
		children: React.ReactNode;
		open: boolean;
		title: string;
	}) => (open ? <div data-sheet={title}>{children}</div> : null),
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

import { RingGameTab } from "./ring-game-tab";

const baseGame = (overrides: Partial<RingGame> = {}): RingGame =>
	({
		ante: null,
		anteType: "none",
		archivedAt: null,
		blind1: 1,
		blind2: 2,
		blind3: null,
		createdAt: "",
		currencyId: "currency-1",
		id: "game-1",
		maxBuyIn: 400,
		memo: null,
		minBuyIn: 100,
		name: "1/2 NLH",
		roomId: "room-1",
		tableSize: 9,
		updatedAt: "",
		variant: "nlh",
		variantId: null,
		...overrides,
	}) as RingGame;

interface TabState {
	actionsTarget: RingGame | null;
	activeGames: RingGame[];
	activeLoading: boolean;
	archivedGames: RingGame[];
	archivedLoading: boolean;
	cancelDelete: ReturnType<typeof vi.fn>;
	closeActions: ReturnType<typeof vi.fn>;
	currencies: { id: string; name: string; unit?: string | null }[];
	editingGame: RingGame | null;
	handleArchiveFromActions: ReturnType<typeof vi.fn>;
	handleConfirmDelete: ReturnType<typeof vi.fn>;
	handleCreate: ReturnType<typeof vi.fn>;
	handleRestoreFromActions: ReturnType<typeof vi.fn>;
	handleUpdate: ReturnType<typeof vi.fn>;
	isCreateOpen: boolean;
	isCreatePending: boolean;
	isUpdatePending: boolean;
	openActions: ReturnType<typeof vi.fn>;
	openDeleteFromActions: ReturnType<typeof vi.fn>;
	openEditFromActions: ReturnType<typeof vi.fn>;
	pendingDelete: RingGame | null;
	setEditingGame: ReturnType<typeof vi.fn>;
	setIsCreateOpen: ReturnType<typeof vi.fn>;
	showArchived: boolean;
	toggleArchived: ReturnType<typeof vi.fn>;
}

function setState(overrides: Partial<TabState> = {}): TabState {
	const state: TabState = {
		showArchived: false,
		toggleArchived: vi.fn(),
		isCreateOpen: false,
		setIsCreateOpen: vi.fn(),
		editingGame: null,
		setEditingGame: vi.fn(),
		actionsTarget: null,
		pendingDelete: null,
		activeGames: [],
		archivedGames: [],
		currencies: [{ id: "currency-1", name: "USD", unit: "$" }],
		activeLoading: false,
		archivedLoading: false,
		isCreatePending: false,
		isUpdatePending: false,
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
	hoisted.useRingGameTab.mockReturnValue(state);
	return state;
}

describe("RingGameTab", () => {
	beforeEach(() => {
		hoisted.useRingGameTab.mockReset();
	});

	it("renders the add control without a redundant section heading", () => {
		setState();
		render(<RingGameTab roomId="room-1" />);
		// The enclosing tab already names the section, so no in-panel heading.
		expect(
			screen.queryByRole("heading", { name: "Cash games" })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Add cash game" })
		).toBeInTheDocument();
	});

	it("renders a row per active game", () => {
		setState({
			activeGames: [baseGame(), baseGame({ id: "g2", name: "5/10" })],
		});
		render(<RingGameTab roomId="room-1" />);
		expect(screen.getByText("1/2 NLH")).toBeInTheDocument();
		expect(screen.getByText("5/10")).toBeInTheDocument();
	});

	it("shows the empty state when there are no active games and archived is hidden", () => {
		setState({ activeGames: [] });
		render(<RingGameTab roomId="room-1" />);
		expect(screen.getByText("No cash games yet.")).toBeInTheDocument();
	});

	it("renders skeletons (not the empty state) while loading", () => {
		setState({ activeLoading: true });
		render(<RingGameTab roomId="room-1" />);
		expect(screen.queryByText("No cash games yet.")).not.toBeInTheDocument();
	});

	it("opens the create sheet when the add button is clicked", async () => {
		const user = userEvent.setup();
		const state = setState();
		render(<RingGameTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name: "Add cash game" }));
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("toggles the archived view from the disclosure control", async () => {
		const user = userEvent.setup();
		const state = setState();
		render(<RingGameTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name: "Show archived" }));
		expect(state.toggleArchived).toHaveBeenCalledTimes(1);
	});

	it("opens the actions drawer for a row via its overflow button", async () => {
		const user = userEvent.setup();
		const game = baseGame();
		const state = setState({ activeGames: [game] });
		render(<RingGameTab roomId="room-1" />);
		await user.click(
			screen.getByRole("button", { name: "Actions for 1/2 NLH" })
		);
		expect(state.openActions).toHaveBeenCalledWith(game);
	});

	it("wires the actions drawer to the hook handlers when a target is set", async () => {
		const user = userEvent.setup();
		const state = setState({ actionsTarget: baseGame() });
		render(<RingGameTab roomId="room-1" />);
		expect(screen.getByTestId("game-actions")).toHaveAttribute(
			"data-archived",
			"false"
		);
		await user.click(screen.getByRole("button", { name: "drawer-archive" }));
		expect(state.handleArchiveFromActions).toHaveBeenCalledTimes(1);
		await user.click(screen.getByRole("button", { name: "drawer-delete" }));
		expect(state.openDeleteFromActions).toHaveBeenCalledTimes(1);
	});

	it("marks the actions drawer as archived when the target is archived", () => {
		setState({ actionsTarget: baseGame({ archivedAt: "2026-01-01" }) });
		render(<RingGameTab roomId="room-1" />);
		expect(screen.getByTestId("game-actions")).toHaveAttribute(
			"data-archived",
			"true"
		);
	});

	it("mounts the create form inside the sheet when open", () => {
		setState({ isCreateOpen: true });
		render(<RingGameTab roomId="room-1" />);
		expect(screen.getByTestId("ring-game-form")).toBeInTheDocument();
	});

	it("forwards the editing game's variantId into the edit form's defaultValues", () => {
		setState({ editingGame: baseGame({ variantId: "gv-1" }) });
		render(<RingGameTab roomId="room-1" />);
		expect(screen.getByTestId("ring-game-form")).toHaveAttribute(
			"data-variant-id",
			"gv-1"
		);
	});

	it("omits variantId from the edit form's defaultValues when the game has none", () => {
		setState({ editingGame: baseGame({ variantId: null }) });
		render(<RingGameTab roomId="room-1" />);
		expect(screen.getByTestId("ring-game-form")).toHaveAttribute(
			"data-variant-id",
			""
		);
	});

	it("shows the delete dialog with the pending game name", () => {
		setState({ pendingDelete: baseGame({ name: "Doomed game" }) });
		render(<RingGameTab roomId="room-1" />);
		expect(screen.getByTestId("delete-dialog")).toHaveTextContent(
			"Doomed game"
		);
	});
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RingGame } from "@/features/rooms/hooks/use-ring-games";

const hoisted = vi.hoisted(() => ({
	useRingGameTab: vi.fn(),
	ringGameFormProps: vi.fn(),
}));

vi.mock("./use-ring-game-tab", () => ({
	useRingGameTab: hoisted.useRingGameTab,
}));

vi.mock("@/features/rooms/components/ring-game-form", () => ({
	RingGameForm: (props: {
		formId: string;
		onSubmit: (values: unknown) => void;
	}) => {
		hoisted.ringGameFormProps(props);
		return (
			<button
				data-testid="ring-game-form"
				onClick={() => props.onSubmit({ name: "Submitted" })}
				type="button"
			>
				{`submit-${props.formId}`}
			</button>
		);
	},
}));

vi.mock("@/shared/components/form-sheet", () => ({
	FormSheet: ({
		children,
		onOpenChange,
		open,
		title,
	}: {
		children: React.ReactNode;
		onOpenChange: (open: boolean) => void;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div data-sheet={title}>
				<button onClick={() => onOpenChange(false)} type="button">
					{`cancel-${title}`}
				</button>
				{children}
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
	isInitialLoadError: boolean;
	isUpdatePending: boolean;
	onRetry: ReturnType<typeof vi.fn>;
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
		isInitialLoadError: false,
		onRetry: vi.fn(),
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
		hoisted.ringGameFormProps.mockReset();
	});

	it("renders skeleton cards instead of the empty state while loading", () => {
		setState({ activeLoading: true });
		const { container } = render(<RingGameTab roomId="room-1" />);
		expect(
			container.querySelectorAll("[data-slot='skeleton']").length
		).toBeGreaterThan(0);
		expect(screen.queryByText("No cash games yet.")).not.toBeInTheDocument();
	});

	it("shows a retryable error instead of the empty state when the initial list fails", async () => {
		const state = setState({ isInitialLoadError: true });
		render(<RingGameTab roomId="room-1" />);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Unable to load cash games"
		);
		expect(screen.queryByText("No cash games yet.")).not.toBeInTheDocument();
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "Retry" }));
		expect(state.onRetry).toHaveBeenCalledTimes(1);
	});

	it("shows the empty state when there are no active games and archived is hidden", () => {
		setState({ activeGames: [] });
		render(<RingGameTab roomId="room-1" />);
		expect(screen.getByText("No cash games yet.")).toBeInTheDocument();
	});

	it("renders a row per active game", () => {
		setState({
			activeGames: [baseGame(), baseGame({ id: "g2", name: "5/10" })],
		});
		render(<RingGameTab roomId="room-1" />);
		expect(screen.getByText("1/2 NLH")).toBeInTheDocument();
		expect(screen.getByText("5/10")).toBeInTheDocument();
		expect(screen.queryByText("No cash games yet.")).not.toBeInTheDocument();
	});

	it("opens the create sheet when the add button is clicked", async () => {
		const user = userEvent.setup();
		const state = setState();
		render(<RingGameTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name: "Add cash game" }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("labels the archived toggle by showArchived and routes clicks to toggleArchived", async () => {
		const user = userEvent.setup();
		const state = setState({ showArchived: false });
		const { rerender } = render(<RingGameTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name: "Show archived" }));
		expect(state.toggleArchived).toHaveBeenCalledTimes(1);

		setState({ showArchived: true });
		rerender(<RingGameTab roomId="room-1" />);
		expect(
			screen.getByRole("button", { name: "Hide archived" })
		).toBeInTheDocument();
		expect(screen.getByText("Archived")).toBeInTheDocument();
	});

	it("opens the actions drawer for a row via its overflow button", async () => {
		const user = userEvent.setup();
		const game = baseGame();
		const state = setState({ activeGames: [game] });
		render(<RingGameTab roomId="room-1" />);
		await user.click(
			screen.getByRole("button", { name: "Actions for 1/2 NLH" })
		);
		expect(state.openActions).toHaveBeenCalledTimes(1);
		expect(state.openActions).toHaveBeenCalledWith(game);
	});

	it.each([
		["drawer-edit", "openEditFromActions"],
		["drawer-archive", "handleArchiveFromActions"],
		["drawer-restore", "handleRestoreFromActions"],
		["drawer-delete", "openDeleteFromActions"],
	] as const)("routes %s to %s", async (name, handler) => {
		const user = userEvent.setup();
		const state = setState({ actionsTarget: baseGame() });
		render(<RingGameTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name }));
		expect(state[handler]).toHaveBeenCalledTimes(1);
	});

	it("marks the actions drawer as archived only when the target is archived", () => {
		setState({ actionsTarget: baseGame() });
		const { rerender } = render(<RingGameTab roomId="room-1" />);
		expect(screen.getByTestId("game-actions")).toHaveAttribute(
			"data-archived",
			"false"
		);

		setState({ actionsTarget: baseGame({ archivedAt: "2026-01-01" }) });
		rerender(<RingGameTab roomId="room-1" />);
		expect(screen.getByTestId("game-actions")).toHaveAttribute(
			"data-archived",
			"true"
		);
	});

	it("mounts the create form only while the create sheet is open", () => {
		setState({ isCreateOpen: false });
		const { rerender } = render(<RingGameTab roomId="room-1" />);
		expect(screen.queryByTestId("ring-game-form")).not.toBeInTheDocument();

		setState({ isCreateOpen: true });
		rerender(<RingGameTab roomId="room-1" />);
		expect(screen.getByTestId("ring-game-form")).toBeInTheDocument();
	});

	it("mounts the edit form seeded from the editing game's stored values", () => {
		setState({ editingGame: null });
		const { rerender } = render(<RingGameTab roomId="room-1" />);
		expect(screen.queryByTestId("ring-game-form")).not.toBeInTheDocument();

		const mixGames = [
			{
				name: null,
				variants: ["NL Hold'em", "PL Omaha"],
				blind1: 10,
				blind2: 20,
				blind3: null,
				ante: null,
				anteType: "none" as const,
			},
		];
		setState({ editingGame: baseGame({ variant: "8-Game", mixGames }) });
		rerender(<RingGameTab roomId="room-1" />);
		expect(hoisted.ringGameFormProps).toHaveBeenCalledWith(
			expect.objectContaining({
				formId: "ring-game-edit-form",
				defaultValues: expect.objectContaining({
					name: "1/2 NLH",
					variant: "8-Game",
					mixGames,
					blind1: 1,
					blind2: 2,
					blind3: undefined,
					minBuyIn: 100,
					maxBuyIn: 400,
					currencyId: "currency-1",
				}),
			})
		);
	});

	it.each([
		["ring-game-create-form", "handleCreate", { isCreateOpen: true }],
		["ring-game-edit-form", "handleUpdate", { editingGame: baseGame() }],
	] as const)("submits %s through %s", async (formId, handler, overrides: Partial<TabState>) => {
		const user = userEvent.setup();
		const state = setState(overrides);
		render(<RingGameTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name: `submit-${formId}` }));
		expect(state[handler]).toHaveBeenCalledTimes(1);
		expect(state[handler]).toHaveBeenCalledWith({ name: "Submitted" });
	});

	it("shows the delete dialog with the pending game name only while a delete is pending", () => {
		setState({ pendingDelete: null });
		const { rerender } = render(<RingGameTab roomId="room-1" />);
		expect(screen.queryByTestId("delete-dialog")).not.toBeInTheDocument();

		setState({ pendingDelete: baseGame({ name: "Doomed game" }) });
		rerender(<RingGameTab roomId="room-1" />);
		expect(screen.getByTestId("delete-dialog")).toHaveTextContent(
			"Doomed game"
		);
	});

	it.each([
		[
			"dialog-confirm",
			"handleConfirmDelete",
			{ pendingDelete: baseGame() },
			[],
		],
		["dialog-dismiss", "cancelDelete", { pendingDelete: baseGame() }, []],
		["drawer-dismiss", "closeActions", { actionsTarget: baseGame() }, []],
		[
			"cancel-Edit cash game",
			"setEditingGame",
			{ editingGame: baseGame() },
			[null],
		],
		[
			"cancel-Add cash game",
			"setIsCreateOpen",
			{ isCreateOpen: true },
			[false],
		],
	] as const)("routes %s to %s", async (name, handler, overrides: Partial<TabState>, args) => {
		const user = userEvent.setup();
		const state = setState(overrides);
		render(<RingGameTab roomId="room-1" />);
		await user.click(screen.getByRole("button", { name }));
		expect(state[handler]).toHaveBeenCalledTimes(1);
		expect(state[handler]).toHaveBeenCalledWith(...args);
	});
});

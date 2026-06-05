import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
	useStoreDetailPage: vi.fn(),
}));

vi.mock(
	"@/features/stores/pages/store-detail-page/use-store-detail-page",
	() => ({
		useStoreDetailPage: hoisted.useStoreDetailPage,
	})
);

vi.mock("@/features/stores/components/ring-game-tab", () => ({
	RingGameTab: ({ storeId }: { storeId: string }) => (
		<div data-testid="ring-game-tab">{storeId}</div>
	),
}));

vi.mock("@/features/stores/components/tournament-tab", () => ({
	TournamentTab: ({ storeId }: { storeId: string }) => (
		<div data-testid="tournament-tab">{storeId}</div>
	),
}));

vi.mock("@/features/stores/components/store-form", () => ({
	StoreForm: () => <div data-testid="store-form" />,
}));

vi.mock("@/features/stores/components/store-actions-drawer", () => ({
	StoreActionsDrawer: ({
		open,
		onDelete,
		onEdit,
	}: {
		onDelete: () => void;
		onEdit: () => void;
		open: boolean;
	}) =>
		open ? (
			<div data-testid="store-actions">
				<button onClick={onEdit} type="button">
					drawer-edit
				</button>
				<button onClick={onDelete} type="button">
					drawer-delete
				</button>
			</div>
		) : null,
}));

vi.mock("@/features/stores/components/delete-store-dialog", () => ({
	DeleteStoreDialog: ({
		open,
		storeName,
	}: {
		open: boolean;
		storeName: string;
	}) =>
		open ? <div data-testid="delete-store-dialog">{storeName}</div> : null,
}));

// Stub the back-link TopBar so the page test needs no router context.
vi.mock("@/features/stores/pages/store-detail-page/top-bar", () => ({
	TopBar: ({ onOpenActions }: { onOpenActions?: () => void }) => (
		<button onClick={onOpenActions} type="button">
			top-bar-actions
		</button>
	),
}));

import { StoreDetailPage } from "@/features/stores/pages/store-detail-page/store-detail-page";

interface State {
	confirmingDelete: boolean;
	handleConfirmDelete: ReturnType<typeof vi.fn>;
	handleEdit: ReturnType<typeof vi.fn>;
	isActionsOpen: boolean;
	isEditOpen: boolean;
	isLoading: boolean;
	isUpdatePending: boolean;
	openDeleteFromActions: ReturnType<typeof vi.fn>;
	openEditFromActions: ReturnType<typeof vi.fn>;
	setConfirmingDelete: ReturnType<typeof vi.fn>;
	setIsActionsOpen: ReturnType<typeof vi.fn>;
	setIsEditOpen: ReturnType<typeof vi.fn>;
	store: { memo?: string | null; name: string } | null;
}

function setState(overrides: Partial<State> = {}): State {
	const state: State = {
		store: { name: "Akiba", memo: "late nights" },
		isLoading: false,
		isUpdatePending: false,
		isActionsOpen: false,
		isEditOpen: false,
		confirmingDelete: false,
		setIsActionsOpen: vi.fn(),
		setIsEditOpen: vi.fn(),
		setConfirmingDelete: vi.fn(),
		openEditFromActions: vi.fn(),
		openDeleteFromActions: vi.fn(),
		handleEdit: vi.fn(),
		handleConfirmDelete: vi.fn(),
		...overrides,
	};
	hoisted.useStoreDetailPage.mockReturnValue(state);
	return state;
}

describe("StoreDetailPage", () => {
	beforeEach(() => {
		hoisted.useStoreDetailPage.mockReset();
	});

	it("renders the skeleton while loading", () => {
		setState({ isLoading: true });
		render(<StoreDetailPage storeId="s1" />);
		expect(screen.getByTestId("store-detail-skeleton")).toBeInTheDocument();
	});

	it("renders a not-found message when the store is missing", () => {
		setState({ store: null, isLoading: false });
		render(<StoreDetailPage storeId="s1" />);
		expect(
			screen.getByRole("heading", { name: "Store not found" })
		).toBeInTheDocument();
	});

	it("renders the store name and memo in the header", () => {
		setState();
		render(<StoreDetailPage storeId="s1" />);
		expect(screen.getByRole("heading", { name: "Akiba" })).toBeInTheDocument();
		expect(screen.getByText("late nights")).toBeInTheDocument();
	});

	it("renders the cash-games tab content with the store id", () => {
		setState();
		render(<StoreDetailPage storeId="store-42" />);
		expect(screen.getByTestId("ring-game-tab")).toHaveTextContent("store-42");
	});

	it("opens the actions drawer from the top bar", async () => {
		const user = userEvent.setup();
		const state = setState();
		render(<StoreDetailPage storeId="s1" />);
		await user.click(screen.getByRole("button", { name: "top-bar-actions" }));
		expect(state.setIsActionsOpen).toHaveBeenCalledWith(true);
	});

	it("wires the actions drawer to edit and delete handlers", async () => {
		const user = userEvent.setup();
		const state = setState({ isActionsOpen: true });
		render(<StoreDetailPage storeId="s1" />);
		await user.click(screen.getByRole("button", { name: "drawer-edit" }));
		expect(state.openEditFromActions).toHaveBeenCalledTimes(1);
		await user.click(screen.getByRole("button", { name: "drawer-delete" }));
		expect(state.openDeleteFromActions).toHaveBeenCalledTimes(1);
	});

	it("mounts the edit form when the edit sheet is open", () => {
		setState({ isEditOpen: true });
		render(<StoreDetailPage storeId="s1" />);
		expect(screen.getByTestId("store-form")).toBeInTheDocument();
	});

	it("shows the delete dialog with the store name when confirming", () => {
		setState({ confirmingDelete: true });
		render(<StoreDetailPage storeId="s1" />);
		expect(screen.getByTestId("delete-store-dialog")).toHaveTextContent(
			"Akiba"
		);
	});
});

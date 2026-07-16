import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// The detail page component owns a lot of conditional rendering (loading /
// not-found / loaded), three FormSheets, two action drawers, and two delete
// dialogs. We drive all of that through the page hook, which is mocked here so
// the component's own wiring (which handler each control fires, what mounts
// when) is the thing under test — the hook's logic is covered separately in
// use-item-detail-page.test.ts. The component takes `itemId` as a prop (the
// route file reads the param and passes it down), so no router param mock is
// needed; only `Link` (used by TopBar) is stubbed.
// ---------------------------------------------------------------------------

const BACK_RE = /back/i;
const ADD_TRANSACTION_RE = /add transaction/i;
const DELETE_GOLD_HINT_RE = /Gold Ticket will be removed/i;

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));

const hoisted = vi.hoisted(() => ({
	useItemDetailPage: vi.fn(),
}));

vi.mock("@/features/items/pages/item-detail-page/use-item-detail-page", () => ({
	useItemDetailPage: hoisted.useItemDetailPage,
}));

// Heavy children are stubbed so this test exercises the page component's own
// markup/wiring, not theirs (each has its own colocated test). Stubs expose the
// callbacks they receive as buttons so the prop wiring is observable.
vi.mock("@/features/items/pages/item-detail-page/item-holdings-hero", () => ({
	ItemHoldingsHero: ({
		currencyName,
		currencyUnit,
		holdings,
		unitValue,
	}: {
		currencyName?: string | null;
		currencyUnit?: string | null;
		holdings: number;
		unitValue: number;
	}) => (
		<div
			data-currency-name={currencyName ?? ""}
			data-currency-unit={currencyUnit ?? ""}
			data-holdings={holdings}
			data-testid="holdings-hero-stub"
			data-unit-value={unitValue}
		>
			holdings-hero
		</div>
	),
}));

vi.mock("@/features/items/pages/item-detail-page/item-description", () => ({
	ItemDescription: ({ html }: { html: string }) => (
		<div data-html={html} data-testid="description-stub">
			description
		</div>
	),
}));

vi.mock("@/features/items/pages/item-detail-page/item-detail-skeleton", () => ({
	ItemDetailSkeleton: () => (
		<div data-testid="detail-skeleton-stub">skeleton</div>
	),
}));

vi.mock("@/features/items/components/item-form", () => ({
	ItemFormV2: ({
		defaultValues,
		onSubmit,
	}: {
		defaultValues?: { name?: string };
		onSubmit: (values: {
			currencyId: string;
			name: string;
			unitValue: number;
		}) => void;
	}) => (
		<div
			data-default-name={defaultValues?.name ?? ""}
			data-testid="item-form-stub"
		>
			<button
				onClick={() =>
					onSubmit({ name: "Submitted", currencyId: "c1", unitValue: 1 })
				}
				type="button"
			>
				stub-submit-item
			</button>
		</div>
	),
}));

vi.mock("@/features/items/pages/item-detail-page/transaction-form", () => ({
	TransactionFormV2: ({
		defaultValues,
		onSubmit,
	}: {
		defaultValues?: { count?: number };
		onSubmit: (values: { count: number; transactedAt: string }) => void;
	}) => (
		<div
			data-default-count={String(defaultValues?.count ?? "")}
			data-testid="transaction-form-stub"
		>
			<button
				onClick={() => onSubmit({ count: 5, transactedAt: "2026-01-01" })}
				type="button"
			>
				stub-submit-transaction
			</button>
		</div>
	),
}));

vi.mock("@/features/items/pages/item-detail-page/transaction-list", () => ({
	TransactionListV2: ({
		onLoadMore,
		onNavigateToSession,
		onOpenActions,
	}: {
		onLoadMore?: () => void;
		onNavigateToSession?: (sessionId: string) => void;
		onOpenActions?: (tx: { id: string }) => void;
	}) => (
		<div data-testid="transaction-list-stub">
			<button onClick={() => onOpenActions?.({ id: "tx-row" })} type="button">
				stub-open-tx-actions
			</button>
			<button onClick={() => onLoadMore?.()} type="button">
				stub-load-more
			</button>
			<button
				onClick={() => onNavigateToSession?.("session-xyz")}
				type="button"
			>
				stub-navigate-to-session
			</button>
		</div>
	),
}));

import { ItemDetailPage } from "@/features/items/pages/item-detail-page/item-detail-page";

function Component() {
	return <ItemDetailPage itemId="i1" />;
}

const itemI1 = {
	currencyId: "c1",
	currencyName: "USD" as string | null,
	currencyUnit: "$" as string | null,
	description: null as string | null,
	holdings: 3,
	id: "i1",
	name: "Ticket",
	unitValue: 100,
};

interface ItemTransaction {
	count: number;
	id: string;
	memo?: string | null;
	sessionId?: string | null;
	sessionName?: string | null;
	transactedAt: string;
}

const editingTx: ItemTransaction = {
	count: 2,
	id: "tx1",
	memo: "note",
	transactedAt: "2026-03-01",
	sessionId: null,
	sessionName: null,
};

type State = ReturnType<typeof buildState>;

function buildState(overrides: Partial<ReturnType<typeof baseState>> = {}) {
	return { ...baseState(), ...overrides };
}

function baseState() {
	return {
		item: { ...itemI1 } as typeof itemI1 | null,
		isLoading: false,
		isInitialLoadError: false,
		onRetry: vi.fn(),
		transactions: [] as ItemTransaction[],
		isTransactionsLoading: false,
		isTransactionsInitialLoadError: false,
		onRetryTransactions: vi.fn(),
		hasNextPage: false,
		isFetchingNextPage: false,
		isUpdatePending: false,
		isAddTransactionPending: false,
		isEditTransactionPending: false,
		isActionsOpen: false,
		isEditOpen: false,
		isAddTransactionOpen: false,
		transactionActionsTarget: null as ItemTransaction | null,
		editingTransaction: null as ItemTransaction | null,
		pendingDeleteTransaction: null as ItemTransaction | null,
		confirmingDeleteItem: false,
		setIsActionsOpen: vi.fn(),
		setIsEditOpen: vi.fn(),
		setIsAddTransactionOpen: vi.fn(),
		setEditingTransaction: vi.fn(),
		setConfirmingDeleteItem: vi.fn(),
		handleEdit: vi.fn(),
		handleConfirmDelete: vi.fn(),
		handleAddTransaction: vi.fn(),
		handleEditTransaction: vi.fn(),
		fetchNextPage: vi.fn(),
		openEditFromActions: vi.fn(),
		openDeleteFromActions: vi.fn(),
		openTransactionActions: vi.fn(),
		closeTransactionActions: vi.fn(),
		openEditFromTransactionActions: vi.fn(),
		openDeleteFromTransactionActions: vi.fn(),
		cancelDeleteTransaction: vi.fn(),
		handleConfirmDeleteTransaction: vi.fn(),
		handleNavigateToSession: vi.fn(),
	};
}

function setState(
	overrides: Partial<ReturnType<typeof baseState>> = {}
): State {
	const state = buildState(overrides);
	hoisted.useItemDetailPage.mockReturnValue(state);
	return state;
}

describe("ItemDetailPage", () => {
	beforeEach(() => {
		hoisted.useItemDetailPage.mockReset();
	});

	describe("loading state", () => {
		it("renders only the skeleton while isLoading and never the page body", () => {
			setState({ isLoading: true });
			render(<Component />);
			expect(screen.getByTestId("detail-skeleton-stub")).toBeInTheDocument();
			expect(screen.queryByText("Ticket")).not.toBeInTheDocument();
			expect(
				screen.queryByTestId("holdings-hero-stub")
			).not.toBeInTheDocument();
		});

		it("passes the itemId prop straight to the page hook", () => {
			setState({ isLoading: true });
			render(<ItemDetailPage itemId="i99" />);
			expect(hoisted.useItemDetailPage).toHaveBeenCalledWith("i99");
		});
	});

	describe("query error state", () => {
		it("shows a retryable error instead of not-found when the initial query fails", () => {
			const onRetry = vi.fn();
			setState({ item: null, isInitialLoadError: true, onRetry });
			render(<Component />);
			expect(screen.getByRole("alert")).toHaveTextContent(
				"Unable to load item. Please try again."
			);
			expect(
				screen.queryByRole("heading", { name: "Item not found" })
			).not.toBeInTheDocument();
			fireEvent.click(screen.getByRole("button", { name: "Retry" }));
			expect(onRetry).toHaveBeenCalledTimes(1);
		});
	});

	describe("not-found state", () => {
		it("shows the not-found heading and deletion hint with a Back link and no actions button", () => {
			setState({ item: null });
			render(<Component />);
			expect(
				screen.getByRole("heading", { name: "Item not found" })
			).toBeInTheDocument();
			expect(
				screen.getByText("This item may have been deleted.")
			).toBeInTheDocument();
			expect(screen.getByRole("link", { name: BACK_RE })).toHaveAttribute(
				"href",
				"/items"
			);
			expect(
				screen.queryByRole("button", { name: "More actions" })
			).not.toBeInTheDocument();
		});

		it("does not render the holdings hero or transactions when the item is missing", () => {
			setState({ item: null });
			render(<Component />);
			expect(
				screen.queryByTestId("holdings-hero-stub")
			).not.toBeInTheDocument();
			expect(
				screen.queryByTestId("transaction-list-stub")
			).not.toBeInTheDocument();
		});
	});

	describe("loaded item", () => {
		it("renders the name, holdings hero (with unit value / currency), Back link, and transactions list", () => {
			setState();
			render(<Component />);
			expect(screen.getByText("Ticket")).toBeInTheDocument();
			const hero = screen.getByTestId("holdings-hero-stub");
			expect(hero).toHaveAttribute("data-holdings", "3");
			expect(hero).toHaveAttribute("data-unit-value", "100");
			expect(hero).toHaveAttribute("data-currency-name", "USD");
			expect(hero).toHaveAttribute("data-currency-unit", "$");
			expect(screen.getByRole("link", { name: BACK_RE })).toHaveAttribute(
				"href",
				"/items"
			);
			expect(screen.getByTestId("transaction-list-stub")).toBeInTheDocument();
			expect(
				screen.getByRole("heading", { name: "Transactions" })
			).toBeInTheDocument();
		});

		it("renders the description block only when the item has a description", () => {
			setState({ item: { ...itemI1, description: "<p>memo</p>" } });
			render(<Component />);
			const desc = screen.getByTestId("description-stub");
			expect(desc).toHaveAttribute("data-html", "<p>memo</p>");
		});

		it("omits the description block when description is null", () => {
			setState({ item: { ...itemI1, description: null } });
			render(<Component />);
			expect(screen.queryByTestId("description-stub")).not.toBeInTheDocument();
		});

		it("opens the actions sheet when the More actions button is clicked", async () => {
			const user = userEvent.setup();
			const state = setState();
			render(<Component />);
			await user.click(screen.getByRole("button", { name: "More actions" }));
			expect(state.setIsActionsOpen).toHaveBeenCalledWith(true);
		});

		it("opens the add-transaction sheet when the Add transaction button is clicked", async () => {
			const user = userEvent.setup();
			const state = setState();
			render(<Component />);
			await user.click(
				screen.getByRole("button", { name: ADD_TRANSACTION_RE })
			);
			expect(state.setIsAddTransactionOpen).toHaveBeenCalledWith(true);
		});

		it("wires the transaction list onOpenActions to openTransactionActions", async () => {
			const user = userEvent.setup();
			const state = setState();
			render(<Component />);
			await user.click(
				screen.getByRole("button", { name: "stub-open-tx-actions" })
			);
			expect(state.openTransactionActions).toHaveBeenCalledWith({
				id: "tx-row",
			});
		});

		it("wires the transaction list onLoadMore to fetchNextPage", async () => {
			const user = userEvent.setup();
			const state = setState();
			render(<Component />);
			await user.click(screen.getByRole("button", { name: "stub-load-more" }));
			expect(state.fetchNextPage).toHaveBeenCalledTimes(1);
		});

		it("wires the transaction list onNavigateToSession to handleNavigateToSession", async () => {
			const user = userEvent.setup();
			const state = setState();
			render(<Component />);
			await user.click(
				screen.getByRole("button", { name: "stub-navigate-to-session" })
			);
			expect(state.handleNavigateToSession).toHaveBeenCalledTimes(1);
			expect(state.handleNavigateToSession).toHaveBeenCalledWith("session-xyz");
		});
	});

	describe("item actions drawer", () => {
		it("renders edit / delete actions when open", () => {
			setState({ isActionsOpen: true });
			render(<Component />);
			expect(
				screen.getByRole("button", { name: "Edit item" })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Delete item" })
			).toBeInTheDocument();
		});

		it("fires openEditFromActions from the Edit item action", async () => {
			const user = userEvent.setup();
			const state = setState({ isActionsOpen: true });
			render(<Component />);
			await user.click(screen.getByRole("button", { name: "Edit item" }));
			expect(state.openEditFromActions).toHaveBeenCalledTimes(1);
		});

		it("fires openDeleteFromActions from the Delete item action", async () => {
			const user = userEvent.setup();
			const state = setState({ isActionsOpen: true });
			render(<Component />);
			await user.click(screen.getByRole("button", { name: "Delete item" }));
			expect(state.openDeleteFromActions).toHaveBeenCalledTimes(1);
		});
	});

	describe("transaction actions drawer", () => {
		it("renders Edit / Delete transaction actions when a target is set", () => {
			setState({ transactionActionsTarget: editingTx });
			render(<Component />);
			expect(
				screen.getByRole("button", { name: "Edit transaction" })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Delete transaction" })
			).toBeInTheDocument();
		});

		it("does not render the transaction actions drawer when no target is set", () => {
			setState({ transactionActionsTarget: null });
			render(<Component />);
			expect(
				screen.queryByRole("button", { name: "Edit transaction" })
			).not.toBeInTheDocument();
		});

		it("fires openEditFromTransactionActions from the Edit transaction action", async () => {
			const user = userEvent.setup();
			const state = setState({ transactionActionsTarget: editingTx });
			render(<Component />);
			await user.click(
				screen.getByRole("button", { name: "Edit transaction" })
			);
			expect(state.openEditFromTransactionActions).toHaveBeenCalledTimes(1);
		});

		it("fires openDeleteFromTransactionActions from the Delete transaction action", async () => {
			const user = userEvent.setup();
			const state = setState({ transactionActionsTarget: editingTx });
			render(<Component />);
			await user.click(
				screen.getByRole("button", { name: "Delete transaction" })
			);
			expect(state.openDeleteFromTransactionActions).toHaveBeenCalledTimes(1);
		});
	});

	describe("edit item sheet", () => {
		it("does not mount the form when isEditOpen is false", () => {
			setState({ isEditOpen: false });
			render(<Component />);
			expect(screen.queryByTestId("item-form-stub")).not.toBeInTheDocument();
		});

		it("mounts the form seeded with the item name when open", () => {
			setState({
				item: { ...itemI1, name: "Gold Ticket" },
				isEditOpen: true,
			});
			render(<Component />);
			expect(screen.getByTestId("item-form-stub")).toHaveAttribute(
				"data-default-name",
				"Gold Ticket"
			);
		});

		it("disables the Save button while isUpdatePending", () => {
			setState({ isEditOpen: true, isUpdatePending: true });
			render(<Component />);
			expect(screen.getByLabelText("Save")).toBeDisabled();
		});

		it("forwards the form submission to handleEdit", async () => {
			const user = userEvent.setup();
			const state = setState({ isEditOpen: true });
			render(<Component />);
			await user.click(
				screen.getByRole("button", { name: "stub-submit-item" })
			);
			expect(state.handleEdit).toHaveBeenCalledWith({
				name: "Submitted",
				currencyId: "c1",
				unitValue: 1,
			});
		});

		it("closes via the Cancel button (onOpenChange → setIsEditOpen false)", async () => {
			const user = userEvent.setup();
			const state = setState({ isEditOpen: true });
			render(<Component />);
			await user.click(screen.getByLabelText("Cancel"));
			expect(state.setIsEditOpen).toHaveBeenCalledWith(false);
		});
	});

	describe("add transaction sheet", () => {
		it("does not mount the form when closed", () => {
			setState({ isAddTransactionOpen: false });
			render(<Component />);
			expect(
				screen.queryByTestId("transaction-form-stub")
			).not.toBeInTheDocument();
		});

		it("mounts the transaction form when open", () => {
			setState({ isAddTransactionOpen: true });
			render(<Component />);
			expect(screen.getByTestId("transaction-form-stub")).toBeInTheDocument();
		});

		it("forwards the form submission to handleAddTransaction", async () => {
			const user = userEvent.setup();
			const state = setState({ isAddTransactionOpen: true });
			render(<Component />);
			await user.click(
				screen.getByRole("button", { name: "stub-submit-transaction" })
			);
			expect(state.handleAddTransaction).toHaveBeenCalledWith({
				count: 5,
				transactedAt: "2026-01-01",
			});
		});

		it("closes via the Cancel button (onOpenChange → setIsAddTransactionOpen false)", async () => {
			const user = userEvent.setup();
			const state = setState({ isAddTransactionOpen: true });
			render(<Component />);
			await user.click(screen.getByLabelText("Cancel"));
			expect(state.setIsAddTransactionOpen).toHaveBeenCalledWith(false);
		});
	});

	describe("edit transaction sheet", () => {
		it("does not mount the form when there is no editing target", () => {
			setState({ editingTransaction: null });
			render(<Component />);
			expect(
				screen.queryByTestId("transaction-form-stub")
			).not.toBeInTheDocument();
		});

		it("mounts the form seeded with the editing transaction count", () => {
			setState({ editingTransaction: editingTx });
			render(<Component />);
			expect(screen.getByTestId("transaction-form-stub")).toHaveAttribute(
				"data-default-count",
				"2"
			);
		});

		it("forwards the form submission to handleEditTransaction", async () => {
			const user = userEvent.setup();
			const state = setState({ editingTransaction: editingTx });
			render(<Component />);
			await user.click(
				screen.getByRole("button", { name: "stub-submit-transaction" })
			);
			expect(state.handleEditTransaction).toHaveBeenCalledWith({
				count: 5,
				transactedAt: "2026-01-01",
			});
		});

		it("clears the editing target when cancelled (onOpenChange false → setEditingTransaction null)", async () => {
			const user = userEvent.setup();
			const state = setState({ editingTransaction: editingTx });
			render(<Component />);
			await user.click(screen.getByLabelText("Cancel"));
			expect(state.setEditingTransaction).toHaveBeenCalledWith(null);
		});
	});

	describe("delete item dialog", () => {
		it("is closed by default", () => {
			setState({ confirmingDeleteItem: false });
			render(<Component />);
			expect(screen.queryByText("Delete this item?")).not.toBeInTheDocument();
		});

		it("shows the confirmation with the item name when open", () => {
			setState({
				confirmingDeleteItem: true,
				item: { ...itemI1, name: "Gold Ticket" },
			});
			render(<Component />);
			expect(screen.getByText("Delete this item?")).toBeInTheDocument();
			expect(screen.getByText(DELETE_GOLD_HINT_RE)).toBeInTheDocument();
		});

		it("fires handleConfirmDelete from the Delete button", async () => {
			const user = userEvent.setup();
			const state = setState({ confirmingDeleteItem: true });
			render(<Component />);
			const dialog = within(screen.getByRole("dialog"));
			await user.click(dialog.getByRole("button", { name: "Delete" }));
			expect(state.handleConfirmDelete).toHaveBeenCalledTimes(1);
		});

		it("closes via Cancel (setConfirmingDeleteItem false)", async () => {
			const user = userEvent.setup();
			const state = setState({ confirmingDeleteItem: true });
			render(<Component />);
			const dialog = within(screen.getByRole("dialog"));
			await user.click(dialog.getByRole("button", { name: "Cancel" }));
			expect(state.setConfirmingDeleteItem).toHaveBeenCalledWith(false);
		});
	});

	describe("delete transaction dialog", () => {
		it("is closed when there is no pending delete target", () => {
			setState({ pendingDeleteTransaction: null });
			render(<Component />);
			expect(
				screen.queryByText("Delete this transaction?")
			).not.toBeInTheDocument();
		});

		it("shows the confirmation when a transaction is pending deletion", () => {
			setState({ pendingDeleteTransaction: editingTx });
			render(<Component />);
			expect(screen.getByText("Delete this transaction?")).toBeInTheDocument();
		});

		it("fires handleConfirmDeleteTransaction from the Delete button", async () => {
			const user = userEvent.setup();
			const state = setState({ pendingDeleteTransaction: editingTx });
			render(<Component />);
			const dialog = within(screen.getByRole("dialog"));
			await user.click(dialog.getByRole("button", { name: "Delete" }));
			expect(state.handleConfirmDeleteTransaction).toHaveBeenCalledTimes(1);
		});

		it("closes via Cancel (cancelDeleteTransaction)", async () => {
			const user = userEvent.setup();
			const state = setState({ pendingDeleteTransaction: editingTx });
			render(<Component />);
			const dialog = within(screen.getByRole("dialog"));
			await user.click(dialog.getByRole("button", { name: "Cancel" }));
			expect(state.cancelDeleteTransaction).toHaveBeenCalledTimes(1);
		});
	});
});

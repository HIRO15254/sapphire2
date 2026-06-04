import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// The detail page component owns a lot of conditional rendering (loading /
// not-found / loaded), three FormSheets, two action drawers, and two delete
// dialogs. We drive all of that through the page hook, which is mocked here so
// the component's own wiring (which handler each control fires, what mounts
// when) is the thing under test — the hook's logic is covered separately in
// use-currency-detail-page.test.ts. The component takes `currencyId` as a prop
// (the route file reads the param and passes it down), so no router param mock
// is needed; only `Link` (used by TopBar) is stubbed.
// ---------------------------------------------------------------------------

const BACK_RE = /back/i;
const ADD_TRANSACTION_RE = /add transaction/i;
const DELETE_GOLD_HINT_RE = /Gold and all of its transactions will be removed/i;
const ADD_FAV_RE = "Add to favorites";
const REMOVE_FAV_RE = "Remove from favorites";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));

const hoisted = vi.hoisted(() => ({
	useCurrencyDetailPage: vi.fn(),
}));

vi.mock(
	"@/features/currencies/pages/currency-detail-page/use-currency-detail-page",
	() => ({
		useCurrencyDetailPage: hoisted.useCurrencyDetailPage,
	})
);

// Heavy children are stubbed so this test exercises the page component's own
// markup/wiring, not theirs (each has its own colocated test). Stubs expose the
// callbacks they receive as buttons so the prop wiring is observable.
vi.mock(
	"@/features/currencies/pages/currency-detail-page/currency-balance-hero",
	() => ({
		CurrencyBalanceHero: ({
			balance,
			unit,
		}: {
			balance: number;
			unit?: string | null;
		}) => (
			<div
				data-balance={balance}
				data-testid="balance-hero-stub"
				data-unit={unit ?? ""}
			>
				balance-hero
			</div>
		),
	})
);

vi.mock(
	"@/features/currencies/pages/currency-detail-page/currency-description",
	() => ({
		CurrencyDescription: ({ html }: { html: string }) => (
			<div data-html={html} data-testid="description-stub">
				description
			</div>
		),
	})
);

vi.mock(
	"@/features/currencies/pages/currency-detail-page/currency-detail-skeleton",
	() => ({
		CurrencyDetailSkeleton: () => (
			<div data-testid="detail-skeleton-stub">skeleton</div>
		),
	})
);

vi.mock("@/features/currencies/components/currency-form", () => ({
	CurrencyFormV2: ({
		defaultValues,
		onSubmit,
	}: {
		defaultValues?: { name?: string };
		onSubmit: (values: { name: string }) => void;
	}) => (
		<div
			data-default-name={defaultValues?.name ?? ""}
			data-testid="currency-form-stub"
		>
			<button onClick={() => onSubmit({ name: "Submitted" })} type="button">
				stub-submit-currency
			</button>
		</div>
	),
}));

vi.mock("@/features/currencies/components/transaction-form", () => ({
	TransactionFormV2: ({
		defaultValues,
		onSubmit,
	}: {
		defaultValues?: { amount?: number };
		onSubmit: (values: {
			amount: number;
			transactedAt: string;
			transactionTypeId: string;
		}) => void;
	}) => (
		<div
			data-default-amount={String(defaultValues?.amount ?? "")}
			data-testid="transaction-form-stub"
		>
			<button
				onClick={() =>
					onSubmit({
						amount: 5,
						transactedAt: "2026-01-01",
						transactionTypeId: "t1",
					})
				}
				type="button"
			>
				stub-submit-transaction
			</button>
		</div>
	),
}));

vi.mock(
	"@/features/currencies/pages/currency-detail-page/transaction-list",
	() => ({
		TransactionListV2: ({
			onLoadMore,
			onOpenActions,
		}: {
			onLoadMore?: () => void;
			onOpenActions?: (tx: { id: string }) => void;
		}) => (
			<div data-testid="transaction-list-stub">
				<button onClick={() => onOpenActions?.({ id: "tx-row" })} type="button">
					stub-open-tx-actions
				</button>
				<button onClick={() => onLoadMore?.()} type="button">
					stub-load-more
				</button>
			</div>
		),
	})
);

import { CurrencyDetailPage } from "@/features/currencies/pages/currency-detail-page/currency-detail-page";

function Component() {
	return <CurrencyDetailPage currencyId="c1" />;
}

const currencyC1 = {
	balance: 1000,
	description: null as string | null,
	id: "c1",
	isFavorite: false,
	name: "Chips",
	unit: "pt" as string | null,
};

interface Transaction {
	amount: number;
	id: string;
	memo?: string | null;
	transactedAt: string;
	transactionTypeId?: string;
	transactionTypeName: string;
}

const editingTx: Transaction = {
	amount: 250,
	id: "tx1",
	memo: "note",
	transactedAt: "2026-03-01",
	transactionTypeId: "t1",
	transactionTypeName: "Deposit",
};

type State = ReturnType<typeof buildState>;

function buildState(overrides: Partial<ReturnType<typeof baseState>> = {}) {
	return { ...baseState(), ...overrides };
}

function baseState() {
	return {
		currency: { ...currencyC1 } as typeof currencyC1 | null,
		isLoading: false,
		transactions: [] as Transaction[],
		isTransactionsLoading: false,
		hasNextPage: false,
		isFetchingNextPage: false,
		isUpdatePending: false,
		isAddTransactionPending: false,
		isEditTransactionPending: false,
		isActionsOpen: false,
		isEditOpen: false,
		isAddTransactionOpen: false,
		transactionActionsTarget: null as Transaction | null,
		editingTransaction: null as Transaction | null,
		pendingDeleteTransaction: null as Transaction | null,
		confirmingDeleteCurrency: false,
		setIsActionsOpen: vi.fn(),
		setIsEditOpen: vi.fn(),
		setIsAddTransactionOpen: vi.fn(),
		setEditingTransaction: vi.fn(),
		setConfirmingDeleteCurrency: vi.fn(),
		handleEdit: vi.fn(),
		handleConfirmDelete: vi.fn(),
		handleAddTransaction: vi.fn(),
		handleEditTransaction: vi.fn(),
		fetchNextPage: vi.fn(),
		openEditFromActions: vi.fn(),
		openDeleteFromActions: vi.fn(),
		handleToggleFavorite: vi.fn(),
		openTransactionActions: vi.fn(),
		closeTransactionActions: vi.fn(),
		openEditFromTransactionActions: vi.fn(),
		openDeleteFromTransactionActions: vi.fn(),
		cancelDeleteTransaction: vi.fn(),
		handleConfirmDeleteTransaction: vi.fn(),
	};
}

function setState(
	overrides: Partial<ReturnType<typeof baseState>> = {}
): State {
	const state = buildState(overrides);
	hoisted.useCurrencyDetailPage.mockReturnValue(state);
	return state;
}

describe("CurrencyDetailPage", () => {
	beforeEach(() => {
		hoisted.useCurrencyDetailPage.mockReset();
	});

	describe("loading state", () => {
		it("renders only the skeleton while isLoading and never the page body", () => {
			setState({ isLoading: true });
			render(<Component />);
			expect(screen.getByTestId("detail-skeleton-stub")).toBeInTheDocument();
			expect(screen.queryByText("Chips")).not.toBeInTheDocument();
			expect(screen.queryByTestId("balance-hero-stub")).not.toBeInTheDocument();
		});

		it("passes the currencyId prop straight to the page hook", () => {
			setState({ isLoading: true });
			render(<CurrencyDetailPage currencyId="c99" />);
			expect(hoisted.useCurrencyDetailPage).toHaveBeenCalledWith("c99");
		});
	});

	describe("not-found state", () => {
		it("shows the not-found heading and deletion hint with a Back link and no actions button", () => {
			setState({ currency: null });
			render(<Component />);
			expect(
				screen.getByRole("heading", { name: "Currency not found" })
			).toBeInTheDocument();
			expect(
				screen.getByText("This currency may have been deleted.")
			).toBeInTheDocument();
			expect(screen.getByRole("link", { name: BACK_RE })).toHaveAttribute(
				"href",
				"/currencies"
			);
			expect(
				screen.queryByRole("button", { name: "More actions" })
			).not.toBeInTheDocument();
		});

		it("does not render the balance hero or transactions when the currency is missing", () => {
			setState({ currency: null });
			render(<Component />);
			expect(screen.queryByTestId("balance-hero-stub")).not.toBeInTheDocument();
			expect(
				screen.queryByTestId("transaction-list-stub")
			).not.toBeInTheDocument();
		});
	});

	describe("loaded currency", () => {
		it("renders the name, balance hero (with unit), Back link, and transactions list", () => {
			setState();
			render(<Component />);
			expect(screen.getByText("Chips")).toBeInTheDocument();
			const hero = screen.getByTestId("balance-hero-stub");
			expect(hero).toHaveAttribute("data-balance", "1000");
			expect(hero).toHaveAttribute("data-unit", "pt");
			expect(screen.getByRole("link", { name: BACK_RE })).toHaveAttribute(
				"href",
				"/currencies"
			);
			expect(screen.getByTestId("transaction-list-stub")).toBeInTheDocument();
			expect(
				screen.getByRole("heading", { name: "Transactions" })
			).toBeInTheDocument();
		});

		it("renders the description block only when the currency has a description", () => {
			setState({ currency: { ...currencyC1, description: "<p>memo</p>" } });
			render(<Component />);
			const desc = screen.getByTestId("description-stub");
			expect(desc).toHaveAttribute("data-html", "<p>memo</p>");
		});

		it("omits the description block when description is null", () => {
			setState({ currency: { ...currencyC1, description: null } });
			render(<Component />);
			expect(screen.queryByTestId("description-stub")).not.toBeInTheDocument();
		});

		it("shows the 'Add to favorites' header star for a non-favorited currency", () => {
			setState({ currency: { ...currencyC1, isFavorite: false } });
			render(<Component />);
			expect(
				screen.getByRole("button", { name: ADD_FAV_RE })
			).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: REMOVE_FAV_RE })
			).not.toBeInTheDocument();
		});

		it("shows the 'Remove from favorites' header star for a favorited currency", () => {
			setState({ currency: { ...currencyC1, isFavorite: true } });
			render(<Component />);
			expect(
				screen.getByRole("button", { name: REMOVE_FAV_RE })
			).toBeInTheDocument();
		});

		it("fires handleToggleFavorite when the header star is clicked", async () => {
			const user = userEvent.setup();
			const state = setState();
			render(<Component />);
			await user.click(screen.getByRole("button", { name: ADD_FAV_RE }));
			expect(state.handleToggleFavorite).toHaveBeenCalledTimes(1);
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
	});

	describe("currency actions drawer", () => {
		it("renders favorite / edit / delete actions when open", () => {
			setState({ isActionsOpen: true });
			render(<Component />);
			expect(
				screen.getByRole("button", { name: "Edit currency" })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Delete currency" })
			).toBeInTheDocument();
		});

		it("fires openEditFromActions from the Edit currency action", async () => {
			const user = userEvent.setup();
			const state = setState({ isActionsOpen: true });
			render(<Component />);
			await user.click(screen.getByRole("button", { name: "Edit currency" }));
			expect(state.openEditFromActions).toHaveBeenCalledTimes(1);
		});

		it("fires openDeleteFromActions from the Delete currency action", async () => {
			const user = userEvent.setup();
			const state = setState({ isActionsOpen: true });
			render(<Component />);
			await user.click(screen.getByRole("button", { name: "Delete currency" }));
			expect(state.openDeleteFromActions).toHaveBeenCalledTimes(1);
		});

		it("labels the drawer favorite action 'Remove from favorites' for a favorited currency", () => {
			setState({
				currency: { ...currencyC1, isFavorite: true },
				isActionsOpen: true,
			});
			render(<Component />);
			// The header star exposes the label via aria-label (no text node); the
			// drawer action renders it as visible text, so getByText targets the
			// drawer action specifically.
			expect(screen.getByText(REMOVE_FAV_RE)).toBeInTheDocument();
		});

		it("labels the drawer favorite action 'Add to favorites' for a non-favorited currency", () => {
			setState({
				currency: { ...currencyC1, isFavorite: false },
				isActionsOpen: true,
			});
			render(<Component />);
			expect(screen.getByText(ADD_FAV_RE)).toBeInTheDocument();
		});

		it("fires handleToggleFavorite from the drawer favorite action", async () => {
			const user = userEvent.setup();
			const state = setState({ isActionsOpen: true });
			render(<Component />);
			await user.click(screen.getByText(ADD_FAV_RE));
			expect(state.handleToggleFavorite).toHaveBeenCalledTimes(1);
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

	describe("edit currency sheet", () => {
		it("does not mount the form when isEditOpen is false", () => {
			setState({ isEditOpen: false });
			render(<Component />);
			expect(
				screen.queryByTestId("currency-form-stub")
			).not.toBeInTheDocument();
		});

		it("mounts the form seeded with the currency name when open", () => {
			setState({
				currency: { ...currencyC1, name: "Gold" },
				isEditOpen: true,
			});
			render(<Component />);
			expect(screen.getByTestId("currency-form-stub")).toHaveAttribute(
				"data-default-name",
				"Gold"
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
				screen.getByRole("button", { name: "stub-submit-currency" })
			);
			expect(state.handleEdit).toHaveBeenCalledWith({ name: "Submitted" });
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
				amount: 5,
				transactedAt: "2026-01-01",
				transactionTypeId: "t1",
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

		it("mounts the form seeded with the editing transaction amount", () => {
			setState({ editingTransaction: editingTx });
			render(<Component />);
			expect(screen.getByTestId("transaction-form-stub")).toHaveAttribute(
				"data-default-amount",
				"250"
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
				amount: 5,
				transactedAt: "2026-01-01",
				transactionTypeId: "t1",
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

	describe("delete currency dialog", () => {
		it("is closed by default", () => {
			setState({ confirmingDeleteCurrency: false });
			render(<Component />);
			expect(
				screen.queryByText("Delete this currency?")
			).not.toBeInTheDocument();
		});

		it("shows the confirmation with the currency name when open", () => {
			setState({
				confirmingDeleteCurrency: true,
				currency: { ...currencyC1, name: "Gold" },
			});
			render(<Component />);
			expect(screen.getByText("Delete this currency?")).toBeInTheDocument();
			expect(screen.getByText(DELETE_GOLD_HINT_RE)).toBeInTheDocument();
		});

		it("fires handleConfirmDelete from the Delete button", async () => {
			const user = userEvent.setup();
			const state = setState({ confirmingDeleteCurrency: true });
			render(<Component />);
			const dialog = within(screen.getByRole("dialog"));
			await user.click(dialog.getByRole("button", { name: "Delete" }));
			expect(state.handleConfirmDelete).toHaveBeenCalledTimes(1);
		});

		it("closes via Cancel (setConfirmingDeleteCurrency false)", async () => {
			const user = userEvent.setup();
			const state = setState({ confirmingDeleteCurrency: true });
			render(<Component />);
			const dialog = within(screen.getByRole("dialog"));
			await user.click(dialog.getByRole("button", { name: "Cancel" }));
			expect(state.setConfirmingDeleteCurrency).toHaveBeenCalledWith(false);
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

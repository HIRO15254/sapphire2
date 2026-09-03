import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const BACK_RE = /back/i;
const ADD_TRANSACTION_RE = /add transaction/i;
const DELETE_CHIPS_HINT_RE =
	/Chips and all of its transactions will be removed/i;
const DELETE_TX_HINT_RE = /This transaction will be removed permanently/i;
const ADD_FAV = "Add to favorites";
const REMOVE_FAV = "Remove from favorites";

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

vi.mock(
	"@/features/currencies/pages/currency-detail-page/transaction-form",
	() => ({
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
	})
);

vi.mock(
	"@/features/currencies/pages/currency-detail-page/transaction-list",
	() => ({
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

const TX_PAYLOAD = {
	amount: 5,
	transactedAt: "2026-01-01",
	transactionTypeId: "t1",
};

function baseState() {
	return {
		currency: { ...currencyC1 } as typeof currencyC1 | null,
		isLoading: false,
		isInitialLoadError: false,
		onRetry: vi.fn(),
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
		handleNavigateToSession: vi.fn(),
	};
}

type State = ReturnType<typeof baseState>;
type Overrides = Partial<State>;
type Handler = {
	[K in keyof State]: State[K] extends ReturnType<typeof vi.fn> ? K : never;
}[keyof State];

function setState(overrides: Overrides = {}): State {
	const state = { ...baseState(), ...overrides };
	hoisted.useCurrencyDetailPage.mockReturnValue(state);
	return state;
}

interface SheetRow {
	closeArgs: unknown[];
	closer: Handler;
	formStub: string;
	handler: Handler;
	label: string;
	open: Overrides;
	payload: unknown;
	pending:
		| "isAddTransactionPending"
		| "isEditTransactionPending"
		| "isUpdatePending";
	seedAttribute: string;
	seedValue: string;
	submit: string;
}

const SHEETS: SheetRow[] = [
	{
		label: "edit currency",
		open: { isEditOpen: true },
		formStub: "currency-form-stub",
		seedAttribute: "data-default-name",
		seedValue: "Chips",
		submit: "stub-submit-currency",
		handler: "handleEdit",
		payload: { name: "Submitted" },
		closer: "setIsEditOpen",
		closeArgs: [false],
		pending: "isUpdatePending",
	},
	{
		label: "add transaction",
		open: { isAddTransactionOpen: true },
		formStub: "transaction-form-stub",
		seedAttribute: "data-default-amount",
		seedValue: "",
		submit: "stub-submit-transaction",
		handler: "handleAddTransaction",
		payload: TX_PAYLOAD,
		closer: "setIsAddTransactionOpen",
		closeArgs: [false],
		pending: "isAddTransactionPending",
	},
	{
		label: "edit transaction",
		open: { editingTransaction: editingTx },
		formStub: "transaction-form-stub",
		seedAttribute: "data-default-amount",
		seedValue: "250",
		submit: "stub-submit-transaction",
		handler: "handleEditTransaction",
		payload: TX_PAYLOAD,
		closer: "setEditingTransaction",
		closeArgs: [null],
		pending: "isEditTransactionPending",
	},
];

interface DialogRow {
	cancel: Handler;
	cancelArgs: unknown[];
	confirm: Handler;
	hint: RegExp;
	label: string;
	open: Overrides;
	title: string;
}

const DIALOGS: DialogRow[] = [
	{
		label: "delete currency",
		open: { confirmingDeleteCurrency: true },
		title: "Delete this currency?",
		hint: DELETE_CHIPS_HINT_RE,
		confirm: "handleConfirmDelete",
		cancel: "setConfirmingDeleteCurrency",
		cancelArgs: [false],
	},
	{
		label: "delete transaction",
		open: { pendingDeleteTransaction: editingTx },
		title: "Delete this transaction?",
		hint: DELETE_TX_HINT_RE,
		confirm: "handleConfirmDeleteTransaction",
		cancel: "cancelDeleteTransaction",
		cancelArgs: [expect.anything()],
	},
];

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

	describe("query error state", () => {
		it("shows a retryable error instead of not-found when the initial query fails", () => {
			const onRetry = vi.fn();
			setState({ currency: null, isInitialLoadError: true, onRetry });
			render(<Component />);
			expect(screen.getByRole("alert")).toHaveTextContent(
				"Unable to load currency. Please try again."
			);
			expect(
				screen.queryByRole("heading", { name: "Currency not found" })
			).not.toBeInTheDocument();
			fireEvent.click(screen.getByRole("button", { name: "Retry" }));
			expect(onRetry).toHaveBeenCalledTimes(1);
		});
	});

	describe("not-found state", () => {
		it("shows the not-found heading with a Back link and none of the page body", () => {
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
			expect(screen.queryByTestId("balance-hero-stub")).not.toBeInTheDocument();
			expect(
				screen.queryByTestId("transaction-list-stub")
			).not.toBeInTheDocument();
		});
	});

	describe("loaded currency", () => {
		it("renders the name, balance hero with unit, Back link, and transactions list", () => {
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

		it("renders the description block only when the currency has one", () => {
			setState({ currency: { ...currencyC1, description: "<p>memo</p>" } });
			const { rerender } = render(<Component />);
			expect(screen.getByTestId("description-stub")).toHaveAttribute(
				"data-html",
				"<p>memo</p>"
			);
			setState({ currency: { ...currencyC1, description: null } });
			rerender(<Component />);
			expect(screen.queryByTestId("description-stub")).not.toBeInTheDocument();
		});

		it("labels the header star by the favorite state", () => {
			setState({ currency: { ...currencyC1, isFavorite: false } });
			const { rerender } = render(<Component />);
			expect(screen.getByRole("button", { name: ADD_FAV })).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: REMOVE_FAV })
			).not.toBeInTheDocument();
			setState({ currency: { ...currencyC1, isFavorite: true } });
			rerender(<Component />);
			expect(
				screen.getByRole("button", { name: REMOVE_FAV })
			).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: ADD_FAV })
			).not.toBeInTheDocument();
		});

		it.each<[string, Overrides, () => HTMLElement]>([
			[
				"the header star",
				{},
				() => screen.getByRole("button", { name: ADD_FAV }),
			],
			[
				"the actions drawer favorite action",
				{ isActionsOpen: true },
				() => screen.getByText(ADD_FAV),
			],
		])("fires handleToggleFavorite from %s", async (_, overrides, target) => {
			const user = userEvent.setup();
			const state = setState(overrides);
			render(<Component />);
			await user.click(target());
			expect(state.handleToggleFavorite).toHaveBeenCalledTimes(1);
		});

		it.each<[string, string | RegExp, Handler]>([
			["actions drawer", "More actions", "setIsActionsOpen"],
			["add-transaction sheet", ADD_TRANSACTION_RE, "setIsAddTransactionOpen"],
		])("opens the %s from its button", async (_, buttonName, setter) => {
			const user = userEvent.setup();
			const state = setState();
			render(<Component />);
			await user.click(screen.getByRole("button", { name: buttonName }));
			expect(state[setter]).toHaveBeenCalledTimes(1);
			expect(state[setter]).toHaveBeenCalledWith(true);
		});

		it.each<[string, Handler, unknown[]]>([
			["stub-open-tx-actions", "openTransactionActions", [{ id: "tx-row" }]],
			["stub-load-more", "fetchNextPage", []],
			["stub-navigate-to-session", "handleNavigateToSession", ["session-xyz"]],
		])("routes the transaction list's %s to %s", async (button, handler, args) => {
			const user = userEvent.setup();
			const state = setState();
			render(<Component />);
			await user.click(screen.getByRole("button", { name: button }));
			expect(state[handler]).toHaveBeenCalledTimes(1);
			expect(state[handler]).toHaveBeenCalledWith(...args);
		});
	});

	describe("currency actions drawer", () => {
		it("mounts its actions only while open", () => {
			setState({ isActionsOpen: false });
			const { rerender } = render(<Component />);
			expect(
				screen.queryByRole("button", { name: "Edit currency" })
			).not.toBeInTheDocument();
			setState({ isActionsOpen: true });
			rerender(<Component />);
			expect(
				screen.getByRole("button", { name: "Edit currency" })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Delete currency" })
			).toBeInTheDocument();
		});

		it.each<[string, Handler]>([
			["Edit currency", "openEditFromActions"],
			["Delete currency", "openDeleteFromActions"],
		])("fires %s to %s", async (button, handler) => {
			const user = userEvent.setup();
			const state = setState({ isActionsOpen: true });
			render(<Component />);
			await user.click(screen.getByRole("button", { name: button }));
			expect(state[handler]).toHaveBeenCalledTimes(1);
		});

		it("labels the favorite action by the favorite state", () => {
			setState({
				currency: { ...currencyC1, isFavorite: false },
				isActionsOpen: true,
			});
			const { rerender } = render(<Component />);
			expect(screen.getByText(ADD_FAV)).toBeInTheDocument();
			setState({
				currency: { ...currencyC1, isFavorite: true },
				isActionsOpen: true,
			});
			rerender(<Component />);
			expect(screen.getByText(REMOVE_FAV)).toBeInTheDocument();
			expect(screen.queryByText(ADD_FAV)).not.toBeInTheDocument();
		});
	});

	describe("transaction actions drawer", () => {
		it("mounts its actions only while a target is set", () => {
			setState({ transactionActionsTarget: null });
			const { rerender } = render(<Component />);
			expect(
				screen.queryByRole("button", { name: "Edit transaction" })
			).not.toBeInTheDocument();
			setState({ transactionActionsTarget: editingTx });
			rerender(<Component />);
			expect(
				screen.getByRole("button", { name: "Edit transaction" })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Delete transaction" })
			).toBeInTheDocument();
		});

		it.each<[string, Handler]>([
			["Edit transaction", "openEditFromTransactionActions"],
			["Delete transaction", "openDeleteFromTransactionActions"],
		])("fires %s to %s", async (button, handler) => {
			const user = userEvent.setup();
			const state = setState({ transactionActionsTarget: editingTx });
			render(<Component />);
			await user.click(screen.getByRole("button", { name: button }));
			expect(state[handler]).toHaveBeenCalledTimes(1);
		});
	});

	describe("form sheets", () => {
		it.each(
			SHEETS
		)("mounts the $label form only while open, seeded from the page state", ({
			open,
			formStub,
			seedAttribute,
			seedValue,
		}) => {
			setState();
			const { rerender } = render(<Component />);
			expect(screen.queryByTestId(formStub)).not.toBeInTheDocument();
			setState(open);
			rerender(<Component />);
			expect(screen.getByTestId(formStub)).toHaveAttribute(
				seedAttribute,
				seedValue
			);
		});

		it.each(SHEETS)("forwards the $label form submission to $handler", async ({
			open,
			submit,
			handler,
			payload,
		}) => {
			const user = userEvent.setup();
			const state = setState(open);
			render(<Component />);
			await user.click(screen.getByRole("button", { name: submit }));
			expect(state[handler]).toHaveBeenCalledTimes(1);
			expect(state[handler]).toHaveBeenCalledWith(payload);
		});

		it.each(SHEETS)("closes the $label sheet from Cancel via $closer", async ({
			open,
			closer,
			closeArgs,
		}) => {
			const user = userEvent.setup();
			const state = setState(open);
			render(<Component />);
			await user.click(screen.getByLabelText("Cancel"));
			expect(state[closer]).toHaveBeenCalledTimes(1);
			expect(state[closer]).toHaveBeenCalledWith(...closeArgs);
		});

		it.each(SHEETS)("disables Save on the $label sheet while $pending", ({
			open,
			pending,
		}) => {
			setState({ ...open, [pending]: true });
			render(<Component />);
			expect(screen.getByLabelText("Save")).toBeDisabled();
		});
	});

	describe("delete dialogs", () => {
		it.each(DIALOGS)("mounts the $label confirmation only while open", ({
			open,
			title,
			hint,
		}) => {
			setState();
			const { rerender } = render(<Component />);
			expect(screen.queryByText(title)).not.toBeInTheDocument();
			setState(open);
			rerender(<Component />);
			expect(screen.getByText(title)).toBeInTheDocument();
			expect(screen.getByText(hint)).toBeInTheDocument();
		});

		it.each(DIALOGS)("fires $confirm from the $label Delete button", async ({
			open,
			confirm,
		}) => {
			const user = userEvent.setup();
			const state = setState(open);
			render(<Component />);
			const dialog = within(screen.getByRole("dialog"));
			await user.click(dialog.getByRole("button", { name: "Delete" }));
			expect(state[confirm]).toHaveBeenCalledTimes(1);
		});

		it.each(
			DIALOGS
		)("closes the $label dialog from Cancel via $cancel", async ({
			open,
			cancel,
			cancelArgs,
		}) => {
			const user = userEvent.setup();
			const state = setState(open);
			render(<Component />);
			const dialog = within(screen.getByRole("dialog"));
			await user.click(dialog.getByRole("button", { name: "Cancel" }));
			expect(state[cancel]).toHaveBeenCalledTimes(1);
			expect(state[cancel]).toHaveBeenCalledWith(...cancelArgs);
		});
	});
});

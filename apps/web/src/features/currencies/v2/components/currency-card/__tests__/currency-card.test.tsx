import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CurrencyCardV2 } from "@/features/currencies/v2/components/currency-card";

const baseCurrency = {
	id: "cur-1",
	name: "Chips",
	unit: "USD",
	balance: 1234,
};

const HEADER_BUTTON = /Chips/;
const ADD_TRANSACTION_BUTTON = /Add transaction/;

function renderCard(
	overrides: Partial<React.ComponentProps<typeof CurrencyCardV2>> = {}
) {
	const defaults: React.ComponentProps<typeof CurrencyCardV2> = {
		currency: baseCurrency,
		isExpanded: false,
		onAddTransaction: vi.fn(),
		onDelete: vi.fn(),
		onDeleteTransaction: vi.fn(),
		onEdit: vi.fn(),
		onExpandChange: vi.fn(),
		transactions: [],
	};
	return render(<CurrencyCardV2 {...defaults} {...overrides} />);
}

describe("CurrencyCardV2", () => {
	describe("header", () => {
		it("renders currency name and balance with the unit pill", () => {
			renderCard();
			expect(
				screen.getByRole("button", { name: HEADER_BUTTON })
			).toBeInTheDocument();
			expect(screen.getByText("USD")).toBeInTheDocument();
			expect(screen.getByText("1,234")).toBeInTheDocument();
		});

		it("omits the unit pill when unit is null", () => {
			renderCard({ currency: { ...baseCurrency, unit: null } });
			expect(screen.queryByText("USD")).not.toBeInTheDocument();
		});

		it("omits the unit pill when unit is an empty string (no truthy unit)", () => {
			renderCard({ currency: { ...baseCurrency, unit: "" } });
			expect(screen.queryByText("USD")).not.toBeInTheDocument();
		});

		it("uses compact notation for balances ≥10k", () => {
			renderCard({ currency: { ...baseCurrency, balance: 12_345 } });
			expect(screen.getByText("12.3k")).toBeInTheDocument();
		});

		it("renders balance 0 without unit suffix", () => {
			renderCard({ currency: { ...baseCurrency, balance: 0, unit: null } });
			expect(screen.getByText("0")).toBeInTheDocument();
		});

		it("renders negative balance with sign", () => {
			renderCard({ currency: { ...baseCurrency, balance: -500 } });
			expect(screen.getByText("-500")).toBeInTheDocument();
		});

		it("reflects aria-expanded based on isExpanded", () => {
			const { rerender } = renderCard({ isExpanded: false });
			expect(
				screen.getByRole("button", { name: HEADER_BUTTON })
			).toHaveAttribute("aria-expanded", "false");
			rerender(
				<CurrencyCardV2
					currency={baseCurrency}
					isExpanded
					onAddTransaction={vi.fn()}
					onDelete={vi.fn()}
					onDeleteTransaction={vi.fn()}
					onEdit={vi.fn()}
					onExpandChange={vi.fn()}
					transactions={[]}
				/>
			);
			expect(
				screen.getByRole("button", { name: HEADER_BUTTON })
			).toHaveAttribute("aria-expanded", "true");
		});
	});

	describe("expand / collapse", () => {
		it("calls onExpandChange(true) when clicked while collapsed", async () => {
			const user = userEvent.setup();
			const onExpandChange = vi.fn();
			renderCard({ isExpanded: false, onExpandChange });
			await user.click(screen.getByRole("button", { name: HEADER_BUTTON }));
			expect(onExpandChange).toHaveBeenCalledTimes(1);
			expect(onExpandChange).toHaveBeenCalledWith(true);
		});

		it("calls onExpandChange(false) when clicked while expanded", async () => {
			const user = userEvent.setup();
			const onExpandChange = vi.fn();
			renderCard({ isExpanded: true, onExpandChange });
			await user.click(screen.getByRole("button", { name: HEADER_BUTTON }));
			expect(onExpandChange).toHaveBeenCalledTimes(1);
			expect(onExpandChange).toHaveBeenCalledWith(false);
		});

		it("hides the expanded body when collapsed", () => {
			renderCard({ isExpanded: false });
			expect(screen.queryByText("Transactions")).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: ADD_TRANSACTION_BUTTON })
			).not.toBeInTheDocument();
		});

		it("shows the transactions section and footer actions when expanded", () => {
			renderCard({ isExpanded: true });
			expect(screen.getByText("Transactions")).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: ADD_TRANSACTION_BUTTON })
			).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Delete" })
			).toBeInTheDocument();
		});
	});

	describe("actions", () => {
		it("forwards Add transaction click", async () => {
			const user = userEvent.setup();
			const onAddTransaction = vi.fn();
			renderCard({ isExpanded: true, onAddTransaction });
			await user.click(
				screen.getByRole("button", { name: ADD_TRANSACTION_BUTTON })
			);
			expect(onAddTransaction).toHaveBeenCalledTimes(1);
		});

		it("forwards Edit click with the full currency", async () => {
			const user = userEvent.setup();
			const onEdit = vi.fn();
			renderCard({ isExpanded: true, onEdit });
			await user.click(screen.getByRole("button", { name: "Edit" }));
			expect(onEdit).toHaveBeenCalledTimes(1);
			expect(onEdit).toHaveBeenCalledWith(baseCurrency);
		});
	});

	describe("delete confirmation", () => {
		it("enters confirmation state on first delete click without calling onDelete", async () => {
			const user = userEvent.setup();
			const onDelete = vi.fn();
			renderCard({ isExpanded: true, onDelete });
			await user.click(screen.getByRole("button", { name: "Delete" }));
			expect(screen.getByText("Delete this currency?")).toBeInTheDocument();
			expect(onDelete).not.toHaveBeenCalled();
		});

		it("fires onDelete with the currency id when confirm is clicked", async () => {
			const user = userEvent.setup();
			const onDelete = vi.fn();
			renderCard({ isExpanded: true, onDelete });
			await user.click(screen.getByRole("button", { name: "Delete" }));
			await user.click(screen.getByLabelText("Confirm delete"));
			expect(onDelete).toHaveBeenCalledTimes(1);
			expect(onDelete).toHaveBeenCalledWith("cur-1");
		});

		it("cancels the confirmation prompt without calling onDelete", async () => {
			const user = userEvent.setup();
			const onDelete = vi.fn();
			renderCard({ isExpanded: true, onDelete });
			await user.click(screen.getByRole("button", { name: "Delete" }));
			await user.click(screen.getByLabelText("Cancel delete"));
			expect(
				screen.queryByText("Delete this currency?")
			).not.toBeInTheDocument();
			expect(onDelete).not.toHaveBeenCalled();
		});
	});

	describe("nested transaction list", () => {
		it("renders transactions when expanded", () => {
			renderCard({
				isExpanded: true,
				transactions: [
					{
						id: "tx-1",
						amount: 500,
						transactionTypeName: "Buy-in",
						transactedAt: "2026-03-20T10:00:00Z",
						memo: null,
						sessionId: null,
					},
				],
			});
			expect(screen.getByText("Buy-in")).toBeInTheDocument();
			expect(screen.getByText("+500")).toBeInTheDocument();
		});

		it("renders the empty-list message when expanded with no transactions", () => {
			renderCard({ isExpanded: true, transactions: [] });
			expect(screen.getByText("No transactions yet")).toBeInTheDocument();
		});
	});
});

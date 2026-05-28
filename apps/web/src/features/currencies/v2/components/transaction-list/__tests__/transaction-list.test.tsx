import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionListV2 } from "@/features/currencies/v2/components/transaction-list";

const regularTransaction = {
	id: "tx1",
	amount: 5000,
	transactionTypeName: "Purchase",
	transactedAt: "2026-03-20T10:00:00Z",
	sessionId: null,
	memo: "Regular transaction",
};

const sessionTransaction = {
	id: "tx2",
	amount: -3000,
	transactionTypeName: "Session Result",
	transactedAt: "2026-03-20T12:00:00Z",
	sessionId: "session-1",
	memo: null,
};

describe("TransactionListV2", () => {
	it("renders empty state when no transactions", () => {
		render(<TransactionListV2 transactions={[]} />);
		expect(screen.getByText("No transactions yet")).toBeInTheDocument();
	});

	it("renders the type badge, date, and signed amount", () => {
		render(<TransactionListV2 transactions={[regularTransaction]} />);
		expect(screen.getByText("Purchase")).toBeInTheDocument();
		expect(screen.getByText("2026/03/20")).toBeInTheDocument();
		expect(screen.getByText("+5,000")).toBeInTheDocument();
	});

	it("colors positive amounts with the success token utility", () => {
		render(<TransactionListV2 transactions={[regularTransaction]} />);
		expect(screen.getByText("+5,000")).toHaveClass("text-success");
	});

	it("colors negative amounts with text-destructive", () => {
		render(<TransactionListV2 transactions={[sessionTransaction]} />);
		expect(screen.getByText("-3,000")).toHaveClass("text-destructive");
	});

	it("shows memo truncated in the row when present", () => {
		render(<TransactionListV2 transactions={[regularTransaction]} />);
		expect(screen.getByText("Regular transaction")).toBeInTheDocument();
	});

	it("does not render the memo block when memo is null", () => {
		render(
			<TransactionListV2
				transactions={[{ ...regularTransaction, memo: null }]}
			/>
		);
		expect(screen.queryByText("Regular transaction")).not.toBeInTheDocument();
	});

	it("renders a 3-dots actions button on non-session rows when onOpenActions is provided", () => {
		render(
			<TransactionListV2
				onOpenActions={vi.fn()}
				transactions={[regularTransaction]}
			/>
		);
		expect(
			screen.getByRole("button", { name: "Transaction actions" })
		).toBeInTheDocument();
	});

	it("does not render the 3-dots button on session-generated rows", () => {
		render(
			<TransactionListV2
				onOpenActions={vi.fn()}
				transactions={[sessionTransaction]}
			/>
		);
		expect(
			screen.queryByRole("button", { name: "Transaction actions" })
		).not.toBeInTheDocument();
	});

	it("does not render the 3-dots button when onOpenActions is not provided", () => {
		render(<TransactionListV2 transactions={[regularTransaction]} />);
		expect(
			screen.queryByRole("button", { name: "Transaction actions" })
		).not.toBeInTheDocument();
	});

	it("invokes onOpenActions with the full transaction when the 3-dots button is tapped", async () => {
		const user = userEvent.setup();
		const onOpenActions = vi.fn();
		render(
			<TransactionListV2
				onOpenActions={onOpenActions}
				transactions={[regularTransaction]}
			/>
		);
		await user.click(
			screen.getByRole("button", { name: "Transaction actions" })
		);
		expect(onOpenActions).toHaveBeenCalledTimes(1);
		expect(onOpenActions).toHaveBeenCalledWith(regularTransaction);
	});

	it("renders Session badge for session-generated transactions", () => {
		render(<TransactionListV2 transactions={[sessionTransaction]} />);
		expect(screen.getByText("Session")).toBeInTheDocument();
		expect(screen.queryByText("Session Result")).not.toBeInTheDocument();
	});

	it("shows the Load more button when hasMore is true", () => {
		render(<TransactionListV2 hasMore transactions={[regularTransaction]} />);
		expect(
			screen.getByRole("button", { name: "Load more" })
		).toBeInTheDocument();
	});

	it("hides the Load more button when hasMore is false", () => {
		render(<TransactionListV2 transactions={[regularTransaction]} />);
		expect(
			screen.queryByRole("button", { name: "Load more" })
		).not.toBeInTheDocument();
	});

	it("disables the Load more button and swaps the label when isLoadingMore is true", () => {
		render(
			<TransactionListV2
				hasMore
				isLoadingMore
				transactions={[regularTransaction]}
			/>
		);
		expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
	});

	it("calls onLoadMore when the Load more button is clicked", async () => {
		const user = userEvent.setup();
		const onLoadMore = vi.fn();
		render(
			<TransactionListV2
				hasMore
				onLoadMore={onLoadMore}
				transactions={[regularTransaction]}
			/>
		);
		await user.click(screen.getByRole("button", { name: "Load more" }));
		expect(onLoadMore).toHaveBeenCalledTimes(1);
	});
});

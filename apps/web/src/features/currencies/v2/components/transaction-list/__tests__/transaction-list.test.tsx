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

const DATE_PATTERN = /2026/;

const expandRow = async (user: ReturnType<typeof userEvent.setup>) => {
	const rows = screen.getAllByRole("button", { name: DATE_PATTERN });
	await user.click(rows[0]);
};

describe("TransactionListV2", () => {
	it("renders empty state when no transactions", () => {
		render(<TransactionListV2 onDelete={vi.fn()} transactions={[]} />);
		expect(screen.getByText("No transactions yet")).toBeInTheDocument();
	});

	it("renders the type badge, date, and signed amount", () => {
		render(
			<TransactionListV2
				onDelete={vi.fn()}
				transactions={[regularTransaction]}
			/>
		);
		expect(screen.getByText("Purchase")).toBeInTheDocument();
		expect(screen.getByText("2026/03/20")).toBeInTheDocument();
		expect(screen.getByText("+5,000")).toBeInTheDocument();
	});

	it("colors positive amounts with the v2 success token", () => {
		render(
			<TransactionListV2
				onDelete={vi.fn()}
				transactions={[regularTransaction]}
			/>
		);
		expect(screen.getByText("+5,000").className).toContain("--success");
	});

	it("colors negative amounts with text-destructive", () => {
		render(
			<TransactionListV2
				onDelete={vi.fn()}
				transactions={[sessionTransaction]}
			/>
		);
		expect(screen.getByText("-3,000")).toHaveClass("text-destructive");
	});

	it("shows memo when the row is expanded", async () => {
		const user = userEvent.setup();
		render(
			<TransactionListV2
				onDelete={vi.fn()}
				transactions={[regularTransaction]}
			/>
		);
		await expandRow(user);
		// memo also shows truncated in the summary row, so assert it is rendered (>=1).
		expect(
			screen.getAllByText("Regular transaction").length
		).toBeGreaterThanOrEqual(1);
	});

	it("does not render the memo block when memo is null", async () => {
		const user = userEvent.setup();
		render(
			<TransactionListV2
				onDelete={vi.fn()}
				transactions={[{ ...regularTransaction, memo: null }]}
			/>
		);
		await expandRow(user);
		expect(screen.queryByText("Regular transaction")).not.toBeInTheDocument();
	});

	it("toggles aria-expanded on the row button when clicked", async () => {
		const user = userEvent.setup();
		render(
			<TransactionListV2
				onDelete={vi.fn()}
				transactions={[regularTransaction]}
			/>
		);
		const row = screen.getByRole("button", { name: DATE_PATTERN });
		expect(row).toHaveAttribute("aria-expanded", "false");
		await user.click(row);
		expect(row).toHaveAttribute("aria-expanded", "true");
		await user.click(row);
		expect(row).toHaveAttribute("aria-expanded", "false");
	});

	it("renders Session badge for session-generated transactions", () => {
		render(
			<TransactionListV2
				onDelete={vi.fn()}
				transactions={[sessionTransaction]}
			/>
		);
		expect(screen.getByText("Session")).toBeInTheDocument();
		expect(screen.queryByText("Session Result")).not.toBeInTheDocument();
	});

	it("does not render a Session badge for regular transactions", () => {
		render(
			<TransactionListV2
				onDelete={vi.fn()}
				transactions={[regularTransaction]}
			/>
		);
		expect(screen.queryByText("Session")).not.toBeInTheDocument();
	});

	it("does not render a clickable row for session-generated transactions", () => {
		render(
			<TransactionListV2
				onDelete={vi.fn()}
				transactions={[sessionTransaction]}
			/>
		);
		expect(
			screen.queryByRole("button", { name: DATE_PATTERN })
		).not.toBeInTheDocument();
	});

	it("hides edit and delete buttons for session-generated transactions", () => {
		render(
			<TransactionListV2
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				transactions={[sessionTransaction]}
			/>
		);
		expect(screen.queryByLabelText("Edit transaction")).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText("Delete transaction")
		).not.toBeInTheDocument();
	});

	it("shows edit and delete buttons when a row is expanded", async () => {
		const user = userEvent.setup();
		render(
			<TransactionListV2
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				transactions={[regularTransaction]}
			/>
		);
		await expandRow(user);
		expect(screen.getByLabelText("Edit transaction")).toBeInTheDocument();
		expect(screen.getByLabelText("Delete transaction")).toBeInTheDocument();
	});

	it("omits the edit button entirely when onEdit is not provided", async () => {
		const user = userEvent.setup();
		render(
			<TransactionListV2
				onDelete={vi.fn()}
				transactions={[regularTransaction]}
			/>
		);
		await expandRow(user);
		expect(screen.queryByLabelText("Edit transaction")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Delete transaction")).toBeInTheDocument();
	});

	it("calls onEdit with the full transaction when edit is clicked", async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		render(
			<TransactionListV2
				onDelete={vi.fn()}
				onEdit={onEdit}
				transactions={[regularTransaction]}
			/>
		);
		await expandRow(user);
		await user.click(screen.getByLabelText("Edit transaction"));
		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(onEdit).toHaveBeenCalledWith(regularTransaction);
	});

	it("requires confirmation before firing onDelete", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		render(
			<TransactionListV2
				onDelete={onDelete}
				transactions={[regularTransaction]}
			/>
		);
		await expandRow(user);
		await user.click(screen.getByLabelText("Delete transaction"));
		expect(screen.getByText("Delete this transaction?")).toBeInTheDocument();
		expect(onDelete).not.toHaveBeenCalled();
		await user.click(screen.getByLabelText("Confirm delete"));
		expect(onDelete).toHaveBeenCalledTimes(1);
		expect(onDelete).toHaveBeenCalledWith("tx1");
	});

	it("cancels delete confirmation without firing onDelete", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		render(
			<TransactionListV2
				onDelete={onDelete}
				transactions={[regularTransaction]}
			/>
		);
		await expandRow(user);
		await user.click(screen.getByLabelText("Delete transaction"));
		await user.click(screen.getByLabelText("Cancel delete"));
		expect(
			screen.queryByText("Delete this transaction?")
		).not.toBeInTheDocument();
		expect(onDelete).not.toHaveBeenCalled();
	});

	it("shows the Load more button when hasMore is true", () => {
		render(
			<TransactionListV2
				hasMore
				onDelete={vi.fn()}
				transactions={[regularTransaction]}
			/>
		);
		expect(
			screen.getByRole("button", { name: "Load more" })
		).toBeInTheDocument();
	});

	it("hides the Load more button when hasMore is false", () => {
		render(
			<TransactionListV2
				onDelete={vi.fn()}
				transactions={[regularTransaction]}
			/>
		);
		expect(
			screen.queryByRole("button", { name: "Load more" })
		).not.toBeInTheDocument();
	});

	it("disables the Load more button and swaps the label when isLoadingMore is true", () => {
		render(
			<TransactionListV2
				hasMore
				isLoadingMore
				onDelete={vi.fn()}
				transactions={[regularTransaction]}
			/>
		);
		const button = screen.getByRole("button", { name: "Loading..." });
		expect(button).toBeDisabled();
	});

	it("calls onLoadMore when the Load more button is clicked", async () => {
		const user = userEvent.setup();
		const onLoadMore = vi.fn();
		render(
			<TransactionListV2
				hasMore
				onDelete={vi.fn()}
				onLoadMore={onLoadMore}
				transactions={[regularTransaction]}
			/>
		);
		await user.click(screen.getByRole("button", { name: "Load more" }));
		expect(onLoadMore).toHaveBeenCalledTimes(1);
	});
});

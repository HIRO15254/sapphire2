import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionList } from "../transaction-list";

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

describe("TransactionList", () => {
	it("renders empty state when no transactions", () => {
		render(<TransactionList onDelete={vi.fn()} transactions={[]} />);

		expect(screen.getByText("No transactions yet.")).toBeInTheDocument();
	});

	it("renders transaction with amount and type", () => {
		render(
			<TransactionList onDelete={vi.fn()} transactions={[regularTransaction]} />
		);

		expect(screen.getByText("Purchase")).toBeInTheDocument();
		expect(screen.getByText("· Regular transaction")).toBeInTheDocument();
	});

	it("shows Session badge for session-generated transactions", () => {
		render(
			<TransactionList onDelete={vi.fn()} transactions={[sessionTransaction]} />
		);

		expect(screen.getByText("Session")).toBeInTheDocument();
		expect(screen.getByText("Session Result")).toBeInTheDocument();
	});

	it("does not show Session badge for regular transactions", () => {
		render(
			<TransactionList onDelete={vi.fn()} transactions={[regularTransaction]} />
		);

		expect(screen.queryByText("Session")).not.toBeInTheDocument();
	});

	it("shows edit and delete buttons for regular transactions", () => {
		const onEdit = vi.fn();
		render(
			<TransactionList
				onDelete={vi.fn()}
				onEdit={onEdit}
				transactions={[regularTransaction]}
			/>
		);

		expect(screen.getByLabelText("Edit transaction")).toBeInTheDocument();
		expect(screen.getByLabelText("Delete transaction")).toBeInTheDocument();
	});

	it("hides edit and delete buttons for session-generated transactions", () => {
		const onEdit = vi.fn();
		render(
			<TransactionList
				onDelete={vi.fn()}
				onEdit={onEdit}
				transactions={[sessionTransaction]}
			/>
		);

		expect(screen.queryByLabelText("Edit transaction")).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText("Delete transaction")
		).not.toBeInTheDocument();
	});

	it("shows edit for regular but hides for session in mixed list", () => {
		const onEdit = vi.fn();
		render(
			<TransactionList
				onDelete={vi.fn()}
				onEdit={onEdit}
				transactions={[regularTransaction, sessionTransaction]}
			/>
		);

		const editButtons = screen.getAllByLabelText("Edit transaction");
		expect(editButtons).toHaveLength(1);

		const deleteButtons = screen.getAllByLabelText("Delete transaction");
		expect(deleteButtons).toHaveLength(1);
	});

	it("calls onDelete when delete button is clicked", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		render(
			<TransactionList
				onDelete={onDelete}
				transactions={[regularTransaction]}
			/>
		);

		await user.click(screen.getByLabelText("Delete transaction"));
		expect(onDelete).toHaveBeenCalledWith("tx1");
	});

	it("calls onEdit when edit button is clicked", async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		render(
			<TransactionList
				onDelete={vi.fn()}
				onEdit={onEdit}
				transactions={[regularTransaction]}
			/>
		);

		await user.click(screen.getByLabelText("Edit transaction"));
		expect(onEdit).toHaveBeenCalledWith(regularTransaction);
	});

	it("shows load more button when hasMore is true", () => {
		render(
			<TransactionList
				hasMore
				onDelete={vi.fn()}
				transactions={[regularTransaction]}
			/>
		);

		expect(screen.getByText("Load more")).toBeInTheDocument();
	});
});

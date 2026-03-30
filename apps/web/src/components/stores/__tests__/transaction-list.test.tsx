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

const DATE_PATTERN = /2026/;

const expandRow = async (user: ReturnType<typeof userEvent.setup>) => {
	const rows = screen.getAllByRole("button", { name: DATE_PATTERN });
	await user.click(rows[0]);
};

describe("TransactionList", () => {
	it("renders empty state when no transactions", () => {
		render(<TransactionList onDelete={vi.fn()} transactions={[]} />);

		expect(screen.getByText("No transactions yet.")).toBeInTheDocument();
	});

	it("renders transaction with type badge and date", () => {
		render(
			<TransactionList onDelete={vi.fn()} transactions={[regularTransaction]} />
		);

		expect(screen.getByText("Purchase")).toBeInTheDocument();
		expect(screen.getByText("2026/03/20")).toBeInTheDocument();
	});

	it("shows memo in expanded detail", async () => {
		const user = userEvent.setup();
		render(
			<TransactionList onDelete={vi.fn()} transactions={[regularTransaction]} />
		);

		await expandRow(user);
		expect(screen.getByText("Regular transaction")).toBeInTheDocument();
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

	it("shows edit and delete buttons when row is expanded", async () => {
		const user = userEvent.setup();
		render(
			<TransactionList
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				transactions={[regularTransaction]}
			/>
		);

		await expandRow(user);
		expect(screen.getByText("Edit")).toBeInTheDocument();
		expect(screen.getByText("Delete")).toBeInTheDocument();
	});

	it("hides edit and delete buttons for session-generated transactions", async () => {
		const user = userEvent.setup();
		render(
			<TransactionList
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				transactions={[sessionTransaction]}
			/>
		);

		const row = screen.getByRole("button", { name: DATE_PATTERN });
		await user.click(row);
		expect(screen.queryByText("Edit")).not.toBeInTheDocument();
		expect(screen.queryByText("Delete")).not.toBeInTheDocument();
	});

	it("calls onDelete after confirmation when delete is clicked", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		render(
			<TransactionList
				onDelete={onDelete}
				transactions={[regularTransaction]}
			/>
		);

		await expandRow(user);
		await user.click(screen.getByText("Delete"));
		expect(screen.getByText("Delete?")).toBeInTheDocument();

		await user.click(screen.getByLabelText("Confirm delete"));
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

		await expandRow(user);
		await user.click(screen.getByText("Edit"));
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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionListV2 } from "@/features/items/pages/item-detail-page/transaction-list";

// Class-presence matcher for `size-8` (whole-word, single tailwind class).
const SIZE_8_CLASS = /(^| )size-8( |$)/;
// Accessible-name matcher for the row-level "View session" navigation button.
const VIEW_SESSION_NAME = /view session/i;

const manualTransaction = {
	id: "tx1",
	count: 5,
	transactedAt: "2026-03-20T10:00:00Z",
	sessionId: null,
	sessionName: null,
	memo: "Manual transaction",
};

const sessionTransaction = {
	id: "tx2",
	count: -3,
	transactedAt: "2026-03-20T12:00:00Z",
	sessionId: "session-1",
	sessionName: "NLH 1/2",
	memo: null,
};

describe("TransactionListV2 (item)", () => {
	it("renders a retryable error instead of the empty state when the initial query fails", async () => {
		const user = userEvent.setup();
		const onRetry = vi.fn();
		render(<TransactionListV2 isError onRetry={onRetry} transactions={[]} />);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Unable to load transactions. Please try again."
		);
		expect(screen.queryByText("No transactions yet")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Retry" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("keeps existing transactions visible when a refetch fails", () => {
		render(
			<TransactionListV2 isError={false} transactions={[manualTransaction]} />
		);
		expect(screen.getByText("Manual transaction")).toBeInTheDocument();
	});

	it("renders empty state when no transactions", () => {
		render(<TransactionListV2 transactions={[]} />);
		expect(screen.getByText("No transactions yet")).toBeInTheDocument();
	});

	it("renders skeleton placeholders (and no empty state) while isLoading", () => {
		render(<TransactionListV2 isLoading transactions={[]} />);
		expect(screen.getByTestId("transaction-list-skeleton")).toBeInTheDocument();
		expect(screen.queryByText("No transactions yet")).not.toBeInTheDocument();
	});

	it("shows the empty state (not the skeleton) once loading has finished", () => {
		render(<TransactionListV2 transactions={[]} />);
		expect(
			screen.queryByTestId("transaction-list-skeleton")
		).not.toBeInTheDocument();
		expect(screen.getByText("No transactions yet")).toBeInTheDocument();
	});

	it("renders the Manual badge, date, and signed count", () => {
		render(<TransactionListV2 transactions={[manualTransaction]} />);
		expect(screen.getByText("Manual")).toBeInTheDocument();
		expect(screen.getByText("2026/03/20")).toBeInTheDocument();
		expect(screen.getByText("+5")).toBeInTheDocument();
	});

	it("colors positive counts with the success token utility", () => {
		render(<TransactionListV2 transactions={[manualTransaction]} />);
		expect(screen.getByText("+5")).toHaveClass("text-success");
	});

	it("colors negative counts with text-destructive", () => {
		render(<TransactionListV2 transactions={[sessionTransaction]} />);
		expect(screen.getByText("-3")).toHaveClass("text-destructive");
	});

	it("shows memo truncated in the row when present", () => {
		render(<TransactionListV2 transactions={[manualTransaction]} />);
		expect(screen.getByText("Manual transaction")).toBeInTheDocument();
	});

	it("does not render the memo block when memo is null", () => {
		render(
			<TransactionListV2
				transactions={[{ ...manualTransaction, memo: null }]}
			/>
		);
		expect(screen.queryByText("Manual transaction")).not.toBeInTheDocument();
	});

	it("renders a 3-dots actions button on manual rows when onOpenActions is provided", () => {
		render(
			<TransactionListV2
				onOpenActions={vi.fn()}
				transactions={[manualTransaction]}
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
		render(<TransactionListV2 transactions={[manualTransaction]} />);
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
				transactions={[manualTransaction]}
			/>
		);
		await user.click(
			screen.getByRole("button", { name: "Transaction actions" })
		);
		expect(onOpenActions).toHaveBeenCalledTimes(1);
		expect(onOpenActions).toHaveBeenCalledWith(manualTransaction);
	});

	it("renders Session badge for session-generated transactions", () => {
		render(<TransactionListV2 transactions={[sessionTransaction]} />);
		expect(screen.getByText("Session")).toBeInTheDocument();
		expect(screen.queryByText("Manual")).not.toBeInTheDocument();
	});

	it("shows the Load more button when hasMore is true", () => {
		render(<TransactionListV2 hasMore transactions={[manualTransaction]} />);
		expect(
			screen.getByRole("button", { name: "Load more" })
		).toBeInTheDocument();
	});

	it("hides the Load more button when hasMore is false", () => {
		render(<TransactionListV2 transactions={[manualTransaction]} />);
		expect(
			screen.queryByRole("button", { name: "Load more" })
		).not.toBeInTheDocument();
	});

	it("disables the Load more button and swaps the label when isLoadingMore is true", () => {
		render(
			<TransactionListV2
				hasMore
				isLoadingMore
				transactions={[manualTransaction]}
			/>
		);
		expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
	});

	it("reserves the same width on session rows as the action button takes on editable rows (no onNavigateToSession)", () => {
		const { container } = render(
			<TransactionListV2
				onOpenActions={vi.fn()}
				transactions={[sessionTransaction]}
			/>
		);
		const placeholder = container.querySelector("span[aria-hidden]");
		expect(placeholder).not.toBeNull();
		expect(placeholder?.className).toMatch(SIZE_8_CLASS);
	});

	it("displays the session name in the memo column for session-generated rows", () => {
		render(<TransactionListV2 transactions={[sessionTransaction]} />);
		expect(screen.getByText("NLH 1/2")).toBeInTheDocument();
	});

	it("does not show the session name for manual (non-session) rows", () => {
		render(<TransactionListV2 transactions={[manualTransaction]} />);
		expect(screen.queryByText("NLH 1/2")).not.toBeInTheDocument();
	});

	it("shows a chevron indicator on session rows when onNavigateToSession is provided", () => {
		const { container } = render(
			<TransactionListV2
				onNavigateToSession={vi.fn()}
				transactions={[sessionTransaction]}
			/>
		);
		// The chevron span preserves size-8 alignment like the action button
		const chevronSpan = container.querySelector("span[aria-hidden]");
		expect(chevronSpan).not.toBeNull();
		expect(chevronSpan?.className).toMatch(SIZE_8_CLASS);
	});

	it("calls onNavigateToSession with the sessionId when a session row is clicked", async () => {
		const user = userEvent.setup();
		const onNavigateToSession = vi.fn();
		render(
			<TransactionListV2
				onNavigateToSession={onNavigateToSession}
				transactions={[sessionTransaction]}
			/>
		);
		await user.click(screen.getByText("NLH 1/2"));
		expect(onNavigateToSession).toHaveBeenCalledTimes(1);
		expect(onNavigateToSession).toHaveBeenCalledWith("session-1");
	});

	it("does not call onNavigateToSession when a manual transaction row is clicked", async () => {
		const user = userEvent.setup();
		const onNavigateToSession = vi.fn();
		render(
			<TransactionListV2
				onNavigateToSession={onNavigateToSession}
				transactions={[manualTransaction]}
			/>
		);
		await user.click(screen.getByText("Manual transaction"));
		expect(onNavigateToSession).not.toHaveBeenCalled();
	});

	it("calls onLoadMore when the Load more button is clicked", async () => {
		const user = userEvent.setup();
		const onLoadMore = vi.fn();
		render(
			<TransactionListV2
				hasMore
				onLoadMore={onLoadMore}
				transactions={[manualTransaction]}
			/>
		);
		await user.click(screen.getByRole("button", { name: "Load more" }));
		expect(onLoadMore).toHaveBeenCalledTimes(1);
	});

	it("renders a single date header for transactions on the same day", () => {
		render(
			<TransactionListV2
				transactions={[
					{
						...manualTransaction,
						id: "a",
						transactedAt: "2026-03-20T10:00:00",
					},
					{
						...manualTransaction,
						id: "b",
						transactedAt: "2026-03-20T18:00:00",
					},
				]}
			/>
		);
		expect(screen.getAllByText("2026/03/20")).toHaveLength(1);
	});

	it("renders a separate date header per distinct day", () => {
		render(
			<TransactionListV2
				transactions={[
					{
						...manualTransaction,
						id: "a",
						transactedAt: "2026-03-20T10:00:00",
					},
					{
						...manualTransaction,
						id: "b",
						transactedAt: "2026-03-19T10:00:00",
					},
				]}
			/>
		);
		expect(screen.getByText("2026/03/20")).toBeInTheDocument();
		expect(screen.getByText("2026/03/19")).toBeInTheDocument();
	});

	it("marks navigable session rows as a keyboard-operable button with an accessible name", () => {
		render(
			<TransactionListV2
				onNavigateToSession={vi.fn()}
				transactions={[sessionTransaction]}
			/>
		);
		expect(
			screen.getByRole("button", { name: "View session NLH 1/2" })
		).toBeInTheDocument();
	});

	it("falls back to a generic label when a navigable session row has no name", () => {
		render(
			<TransactionListV2
				onNavigateToSession={vi.fn()}
				transactions={[{ ...sessionTransaction, sessionName: null }]}
			/>
		);
		expect(
			screen.getByRole("button", { name: "View session" })
		).toBeInTheDocument();
	});

	it("navigates with the sessionId when Enter is pressed on a focused session row", async () => {
		const user = userEvent.setup();
		const onNavigateToSession = vi.fn();
		render(
			<TransactionListV2
				onNavigateToSession={onNavigateToSession}
				transactions={[sessionTransaction]}
			/>
		);
		screen.getByRole("button", { name: "View session NLH 1/2" }).focus();
		await user.keyboard("{Enter}");
		expect(onNavigateToSession).toHaveBeenCalledTimes(1);
		expect(onNavigateToSession).toHaveBeenCalledWith("session-1");
	});

	it("navigates with the sessionId when Space is pressed on a focused session row", async () => {
		const user = userEvent.setup();
		const onNavigateToSession = vi.fn();
		render(
			<TransactionListV2
				onNavigateToSession={onNavigateToSession}
				transactions={[sessionTransaction]}
			/>
		);
		screen.getByRole("button", { name: "View session NLH 1/2" }).focus();
		await user.keyboard("[Space]");
		expect(onNavigateToSession).toHaveBeenCalledTimes(1);
		expect(onNavigateToSession).toHaveBeenCalledWith("session-1");
	});

	it("ignores unrelated keys on a focused session row", async () => {
		const user = userEvent.setup();
		const onNavigateToSession = vi.fn();
		render(
			<TransactionListV2
				onNavigateToSession={onNavigateToSession}
				transactions={[sessionTransaction]}
			/>
		);
		screen.getByRole("button", { name: "View session NLH 1/2" }).focus();
		await user.keyboard("{Escape}");
		await user.keyboard("a");
		expect(onNavigateToSession).not.toHaveBeenCalled();
	});

	it("does not expose a navigation button on manual (non-session) rows", () => {
		render(
			<TransactionListV2
				onNavigateToSession={vi.fn()}
				transactions={[manualTransaction]}
			/>
		);
		expect(
			screen.queryByRole("button", { name: VIEW_SESSION_NAME })
		).not.toBeInTheDocument();
	});

	it("does not expose a navigation button when onNavigateToSession is not provided", () => {
		render(<TransactionListV2 transactions={[sessionTransaction]} />);
		expect(
			screen.queryByRole("button", { name: VIEW_SESSION_NAME })
		).not.toBeInTheDocument();
	});
});

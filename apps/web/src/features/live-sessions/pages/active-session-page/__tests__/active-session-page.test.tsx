import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	useActiveSessionPage: vi.fn(),
}));

vi.mock("../use-active-session-page", () => ({
	useActiveSessionPage: mocks.useActiveSessionPage,
}));

vi.mock("../cash-game-session", () => ({
	CashGameSession: () => <div>Cash game session</div>,
}));

vi.mock("../tournament-session", () => ({
	TournamentSession: () => <div>Tournament session</div>,
}));

import { ActiveSessionPage } from "../active-session-page";

describe("ActiveSessionPage", () => {
	beforeEach(() => {
		mocks.useActiveSessionPage.mockReset();
	});

	it("shows a retryable query error instead of the empty state when a query fails", () => {
		const onRetry = vi.fn();
		mocks.useActiveSessionPage.mockReturnValue({
			activeSession: null,
			isError: true,
			isLoading: false,
			onRetry,
		});

		render(<ActiveSessionPage />);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Unable to load the active session"
		);
		expect(screen.queryByText("No active session")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("shows the empty state only when the queries completed without an active session", () => {
		mocks.useActiveSessionPage.mockReturnValue({
			activeSession: null,
			isError: false,
			isLoading: false,
			onRetry: vi.fn(),
		});

		render(<ActiveSessionPage />);

		expect(screen.getByText("No active session")).toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});
});

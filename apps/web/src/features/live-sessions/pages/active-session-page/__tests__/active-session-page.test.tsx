import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CRYST_SCOPE } from "@/shared/lib/theme";

const mocks = vi.hoisted(() => ({
	useActiveSessionPage: vi.fn(),
	cashGameSession: vi.fn(),
	tournamentSession: vi.fn(),
}));

vi.mock("../use-active-session-page", () => ({
	useActiveSessionPage: mocks.useActiveSessionPage,
}));

vi.mock("../cash-game-session", () => ({
	CashGameSession: (props: { sessionId: string }) => {
		mocks.cashGameSession(props);
		return <div>Cash game session</div>;
	},
}));

vi.mock("../tournament-session", () => ({
	TournamentSession: (props: { sessionId: string }) => {
		mocks.tournamentSession(props);
		return <div>Tournament session</div>;
	},
}));

import { ActiveSessionPage } from "../active-session-page";

describe("ActiveSessionPage", () => {
	beforeEach(() => {
		mocks.useActiveSessionPage.mockReset();
		mocks.cashGameSession.mockReset();
		mocks.tournamentSession.mockReset();
	});

	it("shows a loading state inside the cryst-scoped frame", () => {
		mocks.useActiveSessionPage.mockReturnValue({
			activeSession: null,
			isError: false,
			isLoading: true,
			onRetry: vi.fn(),
		});

		const { container } = render(<ActiveSessionPage />);

		expect(screen.getByText("Loading...")).toBeInTheDocument();
		expect(container.firstElementChild).toHaveClass(CRYST_SCOPE);
	});

	it("shows a retryable query error instead of the empty state when a query fails", () => {
		const onRetry = vi.fn();
		mocks.useActiveSessionPage.mockReturnValue({
			activeSession: null,
			isError: true,
			isLoading: false,
			onRetry,
		});

		const { container } = render(<ActiveSessionPage />);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Unable to load the active session"
		);
		expect(screen.queryByText("No active session")).not.toBeInTheDocument();
		expect(container.firstElementChild).toHaveClass(CRYST_SCOPE);
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

		const { container } = render(<ActiveSessionPage />);

		expect(screen.getByText("No active session")).toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(container.firstElementChild).toHaveClass(CRYST_SCOPE);
	});

	describe("session dispatch", () => {
		it("renders CashGameSession with the active session id for a cash game", () => {
			mocks.useActiveSessionPage.mockReturnValue({
				activeSession: { id: "cash-1", type: "cash_game" },
				isError: false,
				isLoading: false,
				onRetry: vi.fn(),
			});

			const { container } = render(<ActiveSessionPage />);

			expect(screen.getByText("Cash game session")).toBeInTheDocument();
			expect(mocks.cashGameSession).toHaveBeenCalledTimes(1);
			expect(mocks.cashGameSession).toHaveBeenNthCalledWith(1, {
				sessionId: "cash-1",
			});
			expect(mocks.tournamentSession).not.toHaveBeenCalled();
			expect(container.firstElementChild).toHaveClass(CRYST_SCOPE);
		});

		it("renders TournamentSession with the active session id for a tournament", () => {
			mocks.useActiveSessionPage.mockReturnValue({
				activeSession: { id: "tourn-1", type: "tournament" },
				isError: false,
				isLoading: false,
				onRetry: vi.fn(),
			});

			const { container } = render(<ActiveSessionPage />);

			expect(screen.getByText("Tournament session")).toBeInTheDocument();
			expect(mocks.tournamentSession).toHaveBeenCalledTimes(1);
			expect(mocks.tournamentSession).toHaveBeenNthCalledWith(1, {
				sessionId: "tourn-1",
			});
			expect(mocks.cashGameSession).not.toHaveBeenCalled();
			expect(container.firstElementChild).toHaveClass(CRYST_SCOPE);
		});
	});
});

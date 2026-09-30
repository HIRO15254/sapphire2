import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderIntegrationPage } from "@/__tests__/integration";
import { createTestQueryClient } from "@/__tests__/test-utils";

const mocks = vi.hoisted(() => ({ useActiveSession: vi.fn() }));

vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: mocks.useActiveSession,
}));

vi.mock("../cash-cockpit", () => ({
	CashCockpit: ({ sessionId }: { sessionId: string }) => (
		<div>Cash cockpit {sessionId}</div>
	),
}));

vi.mock("../tournament-cockpit", () => ({
	TournamentCockpit: ({ sessionId }: { sessionId: string }) => (
		<div>Tournament cockpit {sessionId}</div>
	),
}));

import { LiveSessionPage } from "../live-session-page";

function renderPage() {
	return renderIntegrationPage(<LiveSessionPage />, {
		path: "/active-session",
		queryClient: createTestQueryClient(),
	});
}

describe("LiveSessionPage", () => {
	beforeEach(() => {
		mocks.useActiveSession.mockReset();
		mocks.useActiveSession.mockReturnValue({
			activeSession: null,
			isError: false,
			isLoading: false,
			onRetry: vi.fn(),
		});
	});

	it("shows a retryable query error instead of claiming no session exists", async () => {
		const onRetry = vi.fn();
		mocks.useActiveSession.mockReturnValue({
			activeSession: null,
			isError: true,
			isLoading: false,
			onRetry,
		});
		renderPage();

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Unable to load the active session"
		);
		expect(screen.queryByText("No active session")).not.toBeInTheDocument();
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "Retry" }));
		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("shows the empty state with a route back to sessions after discovery finishes", async () => {
		renderPage();

		expect(await screen.findByText("No active session")).toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Go to sessions" })
		).toHaveAttribute("href", "/sessions");
	});

	it("shows loading rather than the empty state while discovery is pending", async () => {
		mocks.useActiveSession.mockReturnValue({
			activeSession: null,
			isError: false,
			isLoading: true,
			onRetry: vi.fn(),
		});
		renderPage();

		expect(
			await screen.findByRole("status", { name: "Loading the active session" })
		).toBeInTheDocument();
		expect(screen.queryByText("No active session")).not.toBeInTheDocument();
	});

	it.each([
		["cash_game", "Cash cockpit cash-1", "cash-1"],
		["tournament", "Tournament cockpit tournament-1", "tournament-1"],
	])("opens the %s cockpit for the discovered session", async (type, text, id) => {
		mocks.useActiveSession.mockReturnValue({
			activeSession: { id, type },
			isError: false,
			isLoading: false,
			onRetry: vi.fn(),
		});
		renderPage();

		expect(await screen.findByText(text)).toBeInTheDocument();
		expect(screen.queryByText("No active session")).not.toBeInTheDocument();
	});
});

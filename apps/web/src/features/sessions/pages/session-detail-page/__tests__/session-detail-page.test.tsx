import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	state: {} as Record<string, unknown>,
}));

vi.mock(
	"@/features/sessions/pages/session-detail-page/use-session-detail-page",
	() => ({
		useSessionDetailPage: () => mocks.state,
	})
);

vi.mock("@/features/sessions/pages/session-detail-page/top-bar", () => ({
	TopBar: () => <div data-testid="top-bar" />,
}));

vi.mock(
	"@/features/sessions/pages/session-detail-page/live-result-chart",
	() => ({
		LiveResultChart: () => <div data-testid="live-result-chart" />,
	})
);

vi.mock(
	"@/features/sessions/pages/session-detail-page/session-timeline",
	() => ({
		SessionTimeline: () => <div data-testid="session-timeline" />,
	})
);

vi.mock(
	"@/features/sessions/pages/session-detail-page/session-edit-form",
	() => ({
		SessionEditForm: () => <div data-testid="session-edit-form" />,
	})
);

vi.mock("@/features/sessions/hooks/use-sessions", () => ({
	buildEditDefaults: () => ({}),
}));

import { SessionDetailPage } from "@/features/sessions/pages/session-detail-page/session-detail-page";

const handlers = {
	availableTags: [],
	rooms: [],
	currencies: [],
	editGames: { ringGames: [], tournaments: [] },
	isUpdatePending: false,
	isInitialLoadError: false,
	onRetry: vi.fn(),
	isActionsOpen: false,
	isEditOpen: false,
	confirmingDelete: false,
	setIsActionsOpen: vi.fn(),
	setIsEditOpen: vi.fn(),
	setConfirmingDelete: vi.fn(),
	setEditRoomId: vi.fn(),
	openEditFromActions: vi.fn(),
	openDeleteFromActions: vi.fn(),
	handleEdit: vi.fn(),
	handleConfirmDelete: vi.fn(),
	handleReopen: vi.fn(),
	createTag: vi.fn(),
};

const manualCashSession = {
	id: "s1",
	type: "cash_game",
	source: "manual",
	sessionDate: "2026-01-15",
	roomName: "Aria",
	currencyName: "USD",
	currencyUnit: "$",
	ringGameName: "1/2 NLH",
	tournamentName: null,
	profitLoss: 1500,
	evProfitLoss: null,
	buyIn: 10_000,
	cashOut: 11_500,
	evCashOut: null,
	cashVariant: "NL Hold'em",
	cashBlind1: 1,
	ringGameBlind2: 2,
	cashBlind3: null,
	cashAnte: null,
	cashAnteType: null,
	cashTableSize: 6,
	tournamentBuyIn: null,
	entryFee: null,
	prizeMoney: null,
	bountyPrizes: null,
	placement: null,
	totalEntries: null,
	tournamentStartingStack: null,
	tournamentTableSize: null,
	tournamentVariant: null,
	chipPurchases: [],
	startedAt: null,
	endedAt: null,
	breakMinutes: null,
	memo: "good session",
	tags: [{ id: "t1", name: "Profit" }],
	roomId: "r1",
};

const liveCashSession = {
	...manualCashSession,
	id: "s2",
	source: "live",
	memo: null,
	tags: [],
	liveCashGameSessionId: "s2",
	liveTournamentSessionId: null,
};

function renderPage() {
	return render(<SessionDetailPage sessionId="s1" />);
}

describe("SessionDetailPage", () => {
	beforeEach(() => {
		mocks.state = {
			...handlers,
			session: manualCashSession,
			isLoading: false,
			isLiveLinked: false,
			canReopen: false,
		};
	});

	it("renders the skeleton while loading", () => {
		mocks.state = { ...mocks.state, session: null, isLoading: true };
		renderPage();
		expect(screen.getByTestId("session-detail-skeleton")).toBeInTheDocument();
	});

	it("shows an error and retries when the initial session query fails", async () => {
		const user = userEvent.setup();
		const onRetry = vi.fn();
		mocks.state = {
			...mocks.state,
			session: null,
			isInitialLoadError: true,
			isLoading: false,
			onRetry,
		};
		renderPage();

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Unable to load session. Please try again."
		);
		expect(
			screen.queryByRole("heading", { name: "Session not found" })
		).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Retry" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("renders a not-found message when the session is missing", () => {
		mocks.state = { ...mocks.state, session: null, isLoading: false };
		renderPage();
		expect(
			screen.getByRole("heading", { name: "Session not found" })
		).toBeInTheDocument();
	});

	it("renders the game name and P&L hero for a loaded session", () => {
		renderPage();
		expect(screen.getByText("1/2 NLH")).toBeInTheDocument();
		expect(screen.getByText("+1,500 $")).toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("renders the Rule, Result and Details stat lists from the session", () => {
		renderPage();
		expect(screen.getByRole("heading", { name: "Rule" })).toBeInTheDocument();
		expect(screen.getByText("NL Hold'em")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Result" })).toBeInTheDocument();
		expect(screen.getByText("Cash-out")).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Details" })
		).toBeInTheDocument();
	});

	it("labels the badge Manual or Live and mounts the chart + timeline only for a live session", () => {
		const { rerender } = renderPage();
		expect(screen.getByText("Manual")).toBeInTheDocument();
		expect(screen.queryByTestId("live-result-chart")).not.toBeInTheDocument();
		expect(screen.queryByTestId("session-timeline")).not.toBeInTheDocument();

		mocks.state = {
			...mocks.state,
			session: liveCashSession,
			isLiveLinked: true,
			canReopen: true,
		};
		rerender(<SessionDetailPage sessionId="s2" />);
		expect(screen.getByText("Live")).toBeInTheDocument();
		expect(screen.getByTestId("live-result-chart")).toBeInTheDocument();
		expect(screen.getByTestId("session-timeline")).toBeInTheDocument();
	});

	it("renders the memo section only when the session has a memo", () => {
		const { rerender } = renderPage();
		expect(screen.getByText("good session")).toBeInTheDocument();

		mocks.state = {
			...mocks.state,
			session: { ...manualCashSession, memo: null },
		};
		rerender(<SessionDetailPage sessionId="s1" />);
		expect(screen.queryByText("good session")).not.toBeInTheDocument();
	});

	it("renders one tag badge per tag and none for an untagged session", () => {
		const { rerender } = renderPage();
		expect(screen.getByText("Profit")).toBeInTheDocument();

		mocks.state = {
			...mocks.state,
			session: { ...manualCashSession, tags: [] },
		};
		rerender(<SessionDetailPage sessionId="s1" />);
		expect(screen.queryByText("Profit")).not.toBeInTheDocument();
	});

	it("lays a live session out as chart, then info sections, then timeline", () => {
		mocks.state = {
			...mocks.state,
			session: liveCashSession,
			isLiveLinked: true,
			canReopen: true,
		};
		renderPage();
		const chart = screen.getByTestId("live-result-chart");
		const ruleHeading = screen.getByRole("heading", { name: "Rule" });
		const details = screen.getByRole("heading", { name: "Details" });
		const timeline = screen.getByTestId("session-timeline");
		expect(chart.compareDocumentPosition(ruleHeading)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		);
		expect(details.compareDocumentPosition(timeline)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		);
	});
});

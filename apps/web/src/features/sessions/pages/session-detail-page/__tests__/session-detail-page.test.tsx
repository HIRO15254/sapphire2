import { render, screen } from "@testing-library/react";
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
	});

	it("labels a manual session with the Manual badge and hides the chart + timeline", () => {
		renderPage();
		expect(screen.getByText("Manual")).toBeInTheDocument();
		expect(screen.queryByTestId("live-result-chart")).not.toBeInTheDocument();
		expect(screen.queryByTestId("session-timeline")).not.toBeInTheDocument();
	});

	it("renders the Result section with buy-in and cash-out for a manual cash session", () => {
		renderPage();
		expect(screen.getByRole("heading", { name: "Result" })).toBeInTheDocument();
		expect(screen.getByText("Buy-in")).toBeInTheDocument();
		expect(screen.getByText("Cash-out")).toBeInTheDocument();
	});

	it("renders the Rule section with the cash game's variant and blinds", () => {
		renderPage();
		expect(screen.getByRole("heading", { name: "Rule" })).toBeInTheDocument();
		expect(screen.getByText("Variant")).toBeInTheDocument();
		expect(screen.getByText("Blinds")).toBeInTheDocument();
		expect(screen.getByText("NL Hold'em")).toBeInTheDocument();
	});

	it("renders the memo when present", () => {
		renderPage();
		expect(screen.getByText("good session")).toBeInTheDocument();
	});

	it("renders the tags when present", () => {
		renderPage();
		expect(screen.getByText("Profit")).toBeInTheDocument();
	});

	it("labels a live session with the Live badge and shows the chart + timeline", () => {
		mocks.state = {
			...mocks.state,
			session: liveCashSession,
			isLiveLinked: true,
			canReopen: true,
		};
		renderPage();
		expect(screen.getByText("Live")).toBeInTheDocument();
		// The Live badge is colored with the green success token.
		expect(screen.getByText("Live")).toHaveClass("bg-success");
		expect(screen.getByTestId("live-result-chart")).toBeInTheDocument();
		expect(screen.getByTestId("session-timeline")).toBeInTheDocument();
	});

	it("composites the chart into the P&L card, above the game info", () => {
		mocks.state = {
			...mocks.state,
			session: liveCashSession,
			isLiveLinked: true,
			canReopen: true,
		};
		renderPage();
		const chart = screen.getByTestId("live-result-chart");
		const ruleHeading = screen.getByRole("heading", { name: "Rule" });
		// The chart sits inside the P&L card, which precedes the Rule section.
		// Neither node contains the other, so the position is exactly FOLLOWING.
		expect(chart.compareDocumentPosition(ruleHeading)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		);
	});

	it("places the game and session info above the timeline for a live session", () => {
		mocks.state = {
			...mocks.state,
			session: liveCashSession,
			isLiveLinked: true,
			canReopen: true,
		};
		renderPage();
		const details = screen.getByRole("heading", { name: "Details" });
		const timeline = screen.getByTestId("session-timeline");
		// The timeline is a sibling section after the Details card.
		expect(details.compareDocumentPosition(timeline)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		);
	});
});

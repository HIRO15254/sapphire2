import {
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	SessionListCard,
	type SessionListCardItem,
} from "@/features/sessions/pages/sessions-page/session-list-card";

const OVERFLOW_RE = /^\+\d+$/;
const DURATION_RE = /h$/;
const EV_PREFIX = /^EV/;

const baseSession: SessionListCardItem = {
	beforeDeadline: null,
	breakMinutes: null,
	chipPurchaseCost: 0,
	currencyUnit: null,
	endedAt: null,
	entryFee: null,
	evProfitLoss: null,
	id: "s1",
	placement: null,
	profitLoss: 1200,
	ringGameBlind2: 200,
	ringGameName: "1/2 NLH",
	roomName: "Aria",
	sessionDate: "2026-01-15",
	source: "manual",
	startedAt: null,
	tags: [],
	totalEntries: null,
	tournamentBuyIn: null,
	tournamentName: null,
	type: "cash_game",
};

function renderCard(session: SessionListCardItem, bbBiMode = false) {
	const rootRoute = createRootRoute({
		component: () => <SessionListCard bbBiMode={bbBiMode} session={session} />,
	});
	const detailRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/sessions/$sessionId",
		component: () => <div>detail</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([detailRoute]),
	});
	return render(<RouterProvider router={router} />);
}

describe("SessionListCard", () => {
	it("renders the ring game rule name for a cash game", async () => {
		renderCard(baseSession);
		expect(await screen.findByText("1/2 NLH")).toBeInTheDocument();
	});

	it("renders the tournament rule name for a tournament", async () => {
		renderCard({
			...baseSession,
			type: "tournament",
			ringGameName: null,
			tournamentName: "Sunday Major",
		});
		expect(await screen.findByText("Sunday Major")).toBeInTheDocument();
	});

	it("falls back to 'Cash game' when no ring game name is set", async () => {
		renderCard({ ...baseSession, ringGameName: null });
		expect(await screen.findByText("Cash game")).toBeInTheDocument();
	});

	it("renders a positive P&L with a leading plus", async () => {
		renderCard(baseSession);
		await screen.findByText("1/2 NLH");
		expect(screen.getByText("+1,200")).toBeInTheDocument();
	});

	it("renders a negative P&L with a minus and no plus", async () => {
		renderCard({ ...baseSession, profitLoss: -800 });
		await screen.findByText("1/2 NLH");
		expect(screen.getByText("-800")).toBeInTheDocument();
	});

	it("renders the currency unit alongside the P&L when present", async () => {
		renderCard({ ...baseSession, currencyUnit: "$" });
		await screen.findByText("1/2 NLH");
		expect(screen.getByText("+1,200 $")).toBeInTheDocument();
	});

	it("treats a null P&L as zero", async () => {
		renderCard({ ...baseSession, profitLoss: null });
		await screen.findByText("1/2 NLH");
		expect(screen.getByText("+0")).toBeInTheDocument();
	});

	it("renders cash-game P&L in big blinds when BB/BI mode is on", async () => {
		// 1200 / 200 = 6.0 BB
		renderCard(baseSession, true);
		await screen.findByText("1/2 NLH");
		expect(screen.getByText("+6.0 BB")).toBeInTheDocument();
	});

	it("renders tournament P&L in buy-ins when BB/BI mode is on", async () => {
		renderCard(
			{
				...baseSession,
				type: "tournament",
				ringGameName: null,
				tournamentName: "Sunday Major",
				profitLoss: 10_000,
				ringGameBlind2: null,
				tournamentBuyIn: 5000,
			},
			true
		);
		await screen.findByText("Sunday Major");
		// 10000 / 5000 = 2.00 BI
		expect(screen.getByText("+2.00 BI")).toBeInTheDocument();
	});

	it("shows the date and room on separate subtext lines", async () => {
		renderCard(baseSession);
		await screen.findByText("1/2 NLH");
		expect(screen.getByText("2026/01/15")).toBeInTheDocument();
		expect(screen.getByText("Aria")).toBeInTheDocument();
	});

	it("omits the room line when no room is set", async () => {
		renderCard({ ...baseSession, roomName: null });
		await screen.findByText("1/2 NLH");
		expect(screen.getByText("2026/01/15")).toBeInTheDocument();
		expect(screen.queryByText("Aria")).not.toBeInTheDocument();
	});

	it("shows the played duration when both timestamps are present", async () => {
		renderCard({
			...baseSession,
			startedAt: "2026-01-15T19:00:00",
			endedAt: "2026-01-15T22:00:00",
		});
		await screen.findByText("1/2 NLH");
		expect(screen.getByText("3.0h")).toBeInTheDocument();
	});

	it("omits the duration when timestamps are missing", async () => {
		renderCard(baseSession);
		await screen.findByText("1/2 NLH");
		expect(screen.queryByText(DURATION_RE)).not.toBeInTheDocument();
	});

	it("shows the EV result line for a cash game with a recorded EV", async () => {
		renderCard({ ...baseSession, evProfitLoss: 800, currencyUnit: "$" });
		await screen.findByText("1/2 NLH");
		expect(screen.getByText("+800 $")).toBeInTheDocument();
	});

	it("hides the EV line for a cash game without an EV", async () => {
		renderCard(baseSession);
		await screen.findByText("1/2 NLH");
		expect(screen.queryByText(EV_PREFIX)).not.toBeInTheDocument();
	});

	it("shows the placement result line for a tournament", async () => {
		renderCard({
			...baseSession,
			type: "tournament",
			ringGameName: null,
			tournamentName: "Sunday Major",
			placement: 3,
			totalEntries: 120,
		});
		await screen.findByText("Sunday Major");
		expect(screen.getByText("3/120 place")).toBeInTheDocument();
	});

	it("shows the live indicator for a live-recorded session", async () => {
		renderCard({ ...baseSession, source: "live" });
		await screen.findByText("1/2 NLH");
		expect(screen.getByTestId("live-indicator")).toBeInTheDocument();
	});

	it("hides the live indicator for a manual session", async () => {
		renderCard(baseSession);
		await screen.findByText("1/2 NLH");
		expect(screen.queryByTestId("live-indicator")).not.toBeInTheDocument();
	});

	it("renders tags inline within the visible limit", async () => {
		renderCard({
			...baseSession,
			tags: [
				{ id: "t1", name: "Bad beat" },
				{ id: "t2", name: "Profit" },
			],
		});
		await screen.findByText("1/2 NLH");
		expect(screen.getByText("Bad beat")).toBeInTheDocument();
		expect(screen.getByText("Profit")).toBeInTheDocument();
		expect(screen.queryByText(OVERFLOW_RE)).not.toBeInTheDocument();
	});

	it("collapses tags beyond the limit into a +N badge", async () => {
		renderCard({
			...baseSession,
			tags: [
				{ id: "t1", name: "A" },
				{ id: "t2", name: "B" },
				{ id: "t3", name: "C" },
				{ id: "t4", name: "D" },
			],
		});
		await screen.findByText("1/2 NLH");
		expect(screen.getByText("A")).toBeInTheDocument();
		expect(screen.getByText("B")).toBeInTheDocument();
		expect(screen.getByText("+2")).toBeInTheDocument();
		expect(screen.queryByText("C")).not.toBeInTheDocument();
		expect(screen.queryByText("D")).not.toBeInTheDocument();
	});

	it("links to the session detail route with the id param", async () => {
		renderCard({ ...baseSession, id: "s42" });
		const link = await screen.findByRole("link");
		expect(link).toHaveAttribute("href", "/sessions/s42");
	});
});

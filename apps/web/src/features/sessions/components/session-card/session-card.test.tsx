import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionCard } from "./session-card";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));

function makeCashGameSession(
	overrides: Record<string, unknown> = {}
): Parameters<typeof SessionCard>[0]["session"] {
	return {
		id: "s1",
		type: "cash_game",
		sessionDate: "2026-03-20T00:00:00Z",
		breakMinutes: null,
		buyIn: 10_000,
		cashOut: 15_000,
		evCashOut: null,
		evProfitLoss: null,
		evDiff: null,
		tournamentBuyIn: null,
		entryFee: null,
		beforeDeadline: null,
		placement: null,
		totalEntries: null,
		prizeMoney: null,
		rebuyCount: null,
		rebuyCost: null,
		addonCost: null,
		bountyPrizes: null,
		profitLoss: 5000,
		startedAt: null,
		endedAt: null,
		memo: null,
		storeId: null,
		storeName: null,
		ringGameBlind2: null,
		ringGameId: null,
		ringGameName: "NLH 1/2",
		tournamentId: null,
		tournamentName: null,
		currencyId: null,
		currencyName: null,
		currencyUnit: null,
		createdAt: "2026-03-20T10:00:00Z",
		// CTI discriminators — added in Phase 1 DB migration
		source: "manual",
		status: "completed",
		liveCashGameSessionId: null,
		liveTournamentSessionId: null,
		tags: [],
		...overrides,
	};
}

function makeTournamentSession(
	overrides: Record<string, unknown> = {}
): Parameters<typeof SessionCard>[0]["session"] {
	return {
		id: "s2",
		type: "tournament",
		sessionDate: "2026-03-20T00:00:00Z",
		breakMinutes: null,
		buyIn: null,
		cashOut: null,
		evCashOut: null,
		evProfitLoss: null,
		evDiff: null,
		tournamentBuyIn: 5000,
		entryFee: 1000,
		beforeDeadline: null,
		placement: 3,
		totalEntries: 50,
		prizeMoney: 30_000,
		rebuyCount: 2,
		rebuyCost: 5000,
		addonCost: 0,
		bountyPrizes: 0,
		profitLoss: 14_000,
		startedAt: null,
		endedAt: null,
		memo: null,
		storeId: null,
		storeName: null,
		ringGameBlind2: null,
		ringGameId: null,
		ringGameName: null,
		tournamentId: null,
		tournamentName: "Sunday Major",
		currencyId: null,
		currencyName: null,
		currencyUnit: null,
		createdAt: "2026-03-20T10:00:00Z",
		// CTI discriminators — added in Phase 1 DB migration
		source: "manual",
		status: "completed",
		liveCashGameSessionId: null,
		liveTournamentSessionId: null,
		tags: [],
		...overrides,
	};
}

describe("SessionCard", () => {
	it("renders cash game session with positive P&L", () => {
		const session = makeCashGameSession();
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		expect(screen.getByText("NLH 1/2")).toBeInTheDocument();
		expect(screen.getByText("+5,000")).toBeInTheDocument();
	});

	it("renders tournament session with placement", () => {
		const session = makeTournamentSession();
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		expect(screen.getByText("Sunday Major")).toBeInTheDocument();
		expect(screen.getByText("+14k")).toBeInTheDocument();
		expect(screen.getByText("3/50 place")).toBeInTheDocument();
	});

	it("renders negative P&L with red color", () => {
		const session = makeCashGameSession({
			cashOut: 5000,
			profitLoss: -5000,
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		const plElement = screen.getByText("-5,000");
		expect(plElement.className).toContain("text-red-600");
	});

	it("displays EV P&L when evCashOut is set", () => {
		const session = makeCashGameSession({
			evCashOut: 12_000,
			evProfitLoss: 2000,
			evDiff: -3000,
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		expect(screen.getAllByText("+2,000").length).toBeGreaterThan(0);
	});

	it("does not display EV metrics when evCashOut is null", () => {
		const session = makeCashGameSession();
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		expect(screen.queryByText("EV")).not.toBeInTheDocument();
	});

	it("displays linked entity names", () => {
		const session = makeCashGameSession({
			storeName: "Poker Palace",
			currencyName: "USD",
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		expect(screen.getByText("Poker Palace")).toBeInTheDocument();
	});

	it("shows expanded details on chevron click", async () => {
		const user = userEvent.setup();
		const session = makeCashGameSession();
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		const header = screen.getByRole("button", { expanded: false });
		await user.click(header);

		expect(screen.getByText("Buy-in")).toBeInTheDocument();
		expect(screen.getByText("Cash-out")).toBeInTheDocument();
	});

	it("shows EV details in expanded view", async () => {
		const user = userEvent.setup();
		const session = makeCashGameSession({
			evCashOut: 12_000,
			evProfitLoss: 2000,
			evDiff: -3000,
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		await user.click(screen.getByRole("button", { expanded: false }));

		expect(screen.getByText("EV Cash-out")).toBeInTheDocument();
		expect(screen.getByText("EV P&L")).toBeInTheDocument();
	});

	it("displays session tags as badges", () => {
		const session = makeCashGameSession({
			tags: [
				{ id: "t1", name: "Live" },
				{ id: "t2", name: "Deep Stack" },
			],
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		expect(screen.getByText("Live")).toBeInTheDocument();
		expect(screen.getByText("Deep Stack")).toBeInTheDocument();
	});

	it("calls onEdit when edit button is clicked", async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		const session = makeCashGameSession();
		render(
			<SessionCard onDelete={vi.fn()} onEdit={onEdit} session={session} />
		);

		await user.click(screen.getByRole("button", { expanded: false }));
		await user.click(screen.getByText("Edit"));

		expect(onEdit).toHaveBeenCalledWith(session);
	});

	it("calls onDelete after confirm", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		const session = makeCashGameSession();
		render(
			<SessionCard onDelete={onDelete} onEdit={vi.fn()} session={session} />
		);

		await user.click(screen.getByRole("button", { expanded: false }));
		await user.click(screen.getByText("Delete"));
		await user.click(screen.getByLabelText("Confirm delete"));

		expect(onDelete).toHaveBeenCalledWith("s1");
	});

	it("displays BB P&L for cash game when bbBiMode is true", () => {
		const session = makeCashGameSession({
			ringGameBlind2: 200,
			profitLoss: 5000,
		});
		render(
			<SessionCard
				bbBiMode={true}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				session={session}
			/>
		);

		expect(screen.getByText("+25.0 BB")).toBeInTheDocument();
	});

	it("displays EV P&L in BB when bbBiMode is true", () => {
		const session = makeCashGameSession({
			ringGameBlind2: 200,
			evCashOut: 13_000,
			evProfitLoss: 3000,
			evDiff: -2000,
		});
		render(
			<SessionCard
				bbBiMode={true}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				session={session}
			/>
		);

		expect(screen.getByText("+15.0 BB")).toBeInTheDocument();
	});

	it("displays BI P&L for tournament when bbBiMode is true", () => {
		const session = makeTournamentSession({
			tournamentBuyIn: 5000,
			entryFee: 500,
			profitLoss: 14_000,
			rebuyCount: 0,
			rebuyCost: 0,
			addonCost: 0,
		});
		render(
			<SessionCard
				bbBiMode={true}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				session={session}
			/>
		);

		// 14000 / (5000 + 500) = 2.545454... → 2.55
		expect(screen.getByText("+2.55 BI")).toBeInTheDocument();
	});

	it("falls back to chip value when bbBiMode is true but blind2 is null", () => {
		const session = makeCashGameSession({
			ringGameBlind2: null,
			profitLoss: 5000,
		});
		render(
			<SessionCard
				bbBiMode={true}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				session={session}
			/>
		);

		expect(screen.getByText("+5,000")).toBeInTheDocument();
	});

	it("falls back to chip value when bbBiMode is true but blind2 is 0", () => {
		const session = makeCashGameSession({
			ringGameBlind2: 0,
			profitLoss: 5000,
		});
		render(
			<SessionCard
				bbBiMode={true}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				session={session}
			/>
		);

		expect(screen.getByText("+5,000")).toBeInTheDocument();
	});

	it("falls back to chip value when bbBiMode is true but tournament totalCost is 0", () => {
		const session = makeTournamentSession({
			tournamentBuyIn: 0,
			entryFee: 0,
			rebuyCount: 0,
			rebuyCost: 0,
			addonCost: 0,
			profitLoss: 14_000,
		});
		render(
			<SessionCard
				bbBiMode={true}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				session={session}
			/>
		);

		expect(screen.getByText("+14k")).toBeInTheDocument();
	});

	it("displays chip values when bbBiMode is false", () => {
		const session = makeCashGameSession({
			ringGameBlind2: 200,
			profitLoss: 5000,
		});
		render(
			<SessionCard
				bbBiMode={false}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				session={session}
			/>
		);

		expect(screen.getByText("+5,000")).toBeInTheDocument();
	});

	it("displays Buy-in and Cash-out in BB in expanded view when bbBiMode is true", async () => {
		const user = userEvent.setup();
		const session = makeCashGameSession({
			ringGameBlind2: 200,
			buyIn: 10_000,
			cashOut: 15_000,
		});
		render(
			<SessionCard
				bbBiMode={true}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				session={session}
			/>
		);

		await user.click(screen.getByRole("button", { expanded: false }));

		expect(screen.getByText("50.0 BB")).toBeInTheDocument();
		expect(screen.getByText("75.0 BB")).toBeInTheDocument();
	});

	it("displays EV Cash-out in BB in expanded view when bbBiMode is true", async () => {
		const user = userEvent.setup();
		const session = makeCashGameSession({
			ringGameBlind2: 200,
			buyIn: 10_000,
			cashOut: 15_000,
			evCashOut: 16_000,
			evProfitLoss: 6000,
			evDiff: 1000,
		});
		render(
			<SessionCard
				bbBiMode={true}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				session={session}
			/>
		);

		await user.click(screen.getByRole("button", { expanded: false }));

		expect(screen.getByText("80.0 BB")).toBeInTheDocument();
	});

	it("does not convert tournament detail values in bbBiMode", async () => {
		const user = userEvent.setup();
		const session = makeTournamentSession();
		render(
			<SessionCard
				bbBiMode={true}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				session={session}
			/>
		);

		await user.click(screen.getByRole("button", { expanded: false }));

		// tournamentBuyIn=5000 → formatCompactNumber(5000) = "5,000" (threshold is 10k)
		expect(screen.getByText("5,000")).toBeInTheDocument();
	});

	it("displays chip values in expanded view when bbBiMode is true but blind2 is null", async () => {
		const user = userEvent.setup();
		const session = makeCashGameSession({
			ringGameBlind2: null,
			buyIn: 10_000,
			cashOut: 15_000,
		});
		render(
			<SessionCard
				bbBiMode={true}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				session={session}
			/>
		);

		await user.click(screen.getByRole("button", { expanded: false }));

		expect(screen.getByText("10k")).toBeInTheDocument();
		expect(screen.getByText("15k")).toBeInTheDocument();
	});

	it("shows events and reopen actions for live sessions", async () => {
		const user = userEvent.setup();
		const onReopen = vi.fn();
		const session = makeCashGameSession({
			liveCashGameSessionId: "live-1",
		});

		render(
			<SessionCard
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				onReopen={onReopen}
				session={session}
			/>
		);

		await user.click(screen.getByRole("button", { expanded: false }));

		expect(screen.getByRole("link", { name: "Timeline" })).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Reopen" }));
		expect(onReopen).toHaveBeenCalledWith("live-1");
	});
});

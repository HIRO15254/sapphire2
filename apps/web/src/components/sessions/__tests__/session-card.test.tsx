import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionCard } from "../session-card";

function makeCashGameSession(
	overrides: Record<string, unknown> = {}
): Parameters<typeof SessionCard>[0]["session"] {
	return {
		id: "s1",
		type: "cash_game",
		sessionDate: "2026-03-20T00:00:00Z",
		buyIn: 10_000,
		cashOut: 15_000,
		evCashOut: null,
		evProfitLoss: null,
		evDiff: null,
		tournamentBuyIn: null,
		entryFee: null,
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
		ringGameId: null,
		ringGameName: "NLH 1/2",
		tournamentId: null,
		tournamentName: null,
		currencyId: null,
		currencyName: null,
		currencyUnit: null,
		createdAt: "2026-03-20T10:00:00Z",
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
		buyIn: null,
		cashOut: null,
		evCashOut: null,
		evProfitLoss: null,
		evDiff: null,
		tournamentBuyIn: 5000,
		entryFee: 1000,
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
		ringGameId: null,
		ringGameName: null,
		tournamentId: null,
		tournamentName: "Sunday Major",
		currencyId: null,
		currencyName: null,
		currencyUnit: null,
		createdAt: "2026-03-20T10:00:00Z",
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
		expect(screen.getByText("CG")).toBeInTheDocument();
		expect(screen.getByText("+5k")).toBeInTheDocument();
	});

	it("renders tournament session with placement", () => {
		const session = makeTournamentSession();
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		expect(screen.getByText("Sunday Major")).toBeInTheDocument();
		expect(screen.getByText("T")).toBeInTheDocument();
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

		const plElement = screen.getByText("-5k");
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

		expect(screen.getByText("+2k")).toBeInTheDocument();
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

		const expandButton = screen.getByLabelText("Expand details");
		await user.click(expandButton);

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

		await user.click(screen.getByLabelText("Expand details"));

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

		await user.click(screen.getByLabelText("Expand details"));
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

		await user.click(screen.getByLabelText("Expand details"));
		await user.click(screen.getByText("Delete"));
		await user.click(screen.getByLabelText("Confirm delete"));

		expect(onDelete).toHaveBeenCalledWith("s1");
	});
});

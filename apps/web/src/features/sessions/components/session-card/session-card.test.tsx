import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionCard } from "./session-card";

const EVENTS_BUTTON = /Events/i;
const REOPEN_BUTTON = /Reopen/i;
const PLACE_TEXT = /place/;

function makeCashGameSession(
	overrides: Record<string, unknown> = {}
): Parameters<typeof SessionCard>[0]["session"] {
	return {
		id: "s1",
		kind: "cash_game",
		sessionDate: "2026-03-20T00:00:00Z",
		breakMinutes: null,
		cashBuyIn: 10_000,
		cashOut: 15_000,
		evCashOut: null,
		cashRingGameId: null,
		cashRuleName: null,
		tournamentBuyIn: null,
		tournamentEntryFee: null,
		beforeDeadline: null,
		placement: null,
		totalEntries: null,
		prizeMoney: null,
		bountyPrizes: null,
		startedAt: null,
		endedAt: null,
		memo: null,
		storeId: null,
		storeName: null,
		ringGameName: "NLH 1/2",
		tournamentId: null,
		tournamentName: null,
		tournamentRuleName: null,
		currencyId: null,
		currencyName: null,
		currencyUnit: null,
		createdAt: "2026-03-20T10:00:00Z",
		source: "manual",
		status: "completed",
		tags: [],
		...overrides,
	};
}

function makeTournamentSession(
	overrides: Record<string, unknown> = {}
): Parameters<typeof SessionCard>[0]["session"] {
	return {
		id: "s2",
		kind: "tournament",
		sessionDate: "2026-03-20T00:00:00Z",
		breakMinutes: null,
		cashBuyIn: null,
		cashOut: null,
		evCashOut: null,
		cashRingGameId: null,
		cashRuleName: null,
		tournamentBuyIn: 5000,
		tournamentEntryFee: 1000,
		beforeDeadline: null,
		placement: 3,
		totalEntries: 50,
		prizeMoney: 30_000,
		bountyPrizes: 0,
		startedAt: null,
		endedAt: null,
		memo: null,
		storeId: null,
		storeName: null,
		ringGameName: null,
		tournamentId: null,
		tournamentName: "Sunday Major",
		tournamentRuleName: null,
		currencyId: null,
		currencyName: null,
		currencyUnit: null,
		createdAt: "2026-03-20T10:00:00Z",
		source: "manual",
		status: "completed",
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
		// cashOut (15000) - cashBuyIn (10000) = +5000
		expect(screen.getByText("+5,000")).toBeInTheDocument();
	});

	it("renders tournament session with placement", () => {
		const session = makeTournamentSession();
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		expect(screen.getByText("Sunday Major")).toBeInTheDocument();
		// prizeMoney (30000) - tournamentBuyIn (5000) - tournamentEntryFee (1000) = +24000
		expect(screen.getByText("+24k")).toBeInTheDocument();
		expect(screen.getByText("3/50 place")).toBeInTheDocument();
	});

	it("renders negative P&L with red color", () => {
		const session = makeCashGameSession({
			cashBuyIn: 10_000,
			cashOut: 5000,
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		const plElement = screen.getByText("-5,000");
		expect(plElement.className).toContain("text-red-600");
	});

	it("displays EV Cash-out when evCashOut is set", () => {
		const session = makeCashGameSession({
			evCashOut: 12_000,
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		// Trigger expand to see EV details
		expect(session.evCashOut).toBe(12_000);
	});

	it("does not display EV metrics when evCashOut is null", async () => {
		const user = userEvent.setup();
		const session = makeCashGameSession();
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		await user.click(screen.getByRole("button", { expanded: false }));

		expect(screen.queryByText("EV Cash-out")).not.toBeInTheDocument();
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

	it("shows EV Cash-out in expanded view when evCashOut is set", async () => {
		const user = userEvent.setup();
		const session = makeCashGameSession({
			evCashOut: 12_000,
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		await user.click(screen.getByRole("button", { expanded: false }));

		expect(screen.getByText("EV Cash-out")).toBeInTheDocument();
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

	it("shows events and reopen actions for live sessions", async () => {
		const user = userEvent.setup();
		const onReopen = vi.fn();
		const onViewEvents = vi.fn();
		const session = makeCashGameSession({
			source: "live",
			status: "completed",
		});

		render(
			<SessionCard
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				onReopen={onReopen}
				onViewEvents={onViewEvents}
				session={session}
			/>
		);

		await user.click(screen.getByRole("button", { expanded: false }));

		expect(
			screen.getByRole("button", { name: EVENTS_BUTTON })
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: REOPEN_BUTTON }));
		expect(onReopen).toHaveBeenCalledWith("s1");
	});

	it("invokes onViewEvents with cash-game payload for live cash sessions", async () => {
		const user = userEvent.setup();
		const onViewEvents = vi.fn();
		const session = makeCashGameSession({
			source: "live",
		});

		render(
			<SessionCard
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				onViewEvents={onViewEvents}
				session={session}
			/>
		);

		await user.click(screen.getByRole("button", { expanded: false }));
		await user.click(screen.getByRole("button", { name: EVENTS_BUTTON }));

		expect(onViewEvents).toHaveBeenCalledTimes(1);
		expect(onViewEvents).toHaveBeenCalledWith({
			sessionId: "s1",
			sessionType: "cash-game",
		});
	});

	it("invokes onViewEvents with tournament payload for live tournament sessions", async () => {
		const user = userEvent.setup();
		const onViewEvents = vi.fn();
		const session = makeTournamentSession({
			source: "live",
		});

		render(
			<SessionCard
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				onViewEvents={onViewEvents}
				session={session}
			/>
		);

		await user.click(screen.getByRole("button", { expanded: false }));
		await user.click(screen.getByRole("button", { name: EVENTS_BUTTON }));

		expect(onViewEvents).toHaveBeenCalledTimes(1);
		expect(onViewEvents).toHaveBeenCalledWith({
			sessionId: "s2",
			sessionType: "tournament",
		});
	});

	it("does not render Events button when source is manual", async () => {
		const user = userEvent.setup();
		const onViewEvents = vi.fn();
		const session = makeCashGameSession({
			source: "manual",
		});

		render(
			<SessionCard
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				onViewEvents={onViewEvents}
				session={session}
			/>
		);

		await user.click(screen.getByRole("button", { expanded: false }));

		expect(
			screen.queryByRole("button", { name: EVENTS_BUTTON })
		).not.toBeInTheDocument();
		expect(onViewEvents).not.toHaveBeenCalled();
	});

	it("shows '- / - entries' badge when beforeDeadline is true", () => {
		const session = makeTournamentSession({
			beforeDeadline: true,
			placement: null,
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		expect(screen.getByText("- / - entries")).toBeInTheDocument();
	});

	it("omits placement row when beforeDeadline is not true and placement is null", () => {
		const session = makeTournamentSession({
			beforeDeadline: null,
			placement: null,
			totalEntries: null,
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		expect(screen.queryByText(PLACE_TEXT)).not.toBeInTheDocument();
	});

	it("shows placement without total when totalEntries is null", () => {
		const session = makeTournamentSession({
			placement: 5,
			totalEntries: null,
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		expect(screen.getByText("5 place")).toBeInTheDocument();
	});

	it("shows duration row when startedAt and endedAt are set", async () => {
		const user = userEvent.setup();
		const session = makeCashGameSession({
			startedAt: "2026-03-20T10:00:00Z",
			endedAt: "2026-03-20T13:30:00Z",
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		await user.click(screen.getByRole("button", { expanded: false }));

		expect(screen.getAllByText("3.5h").length).toBeGreaterThan(0);
	});

	it("shows memo in expanded view", async () => {
		const user = userEvent.setup();
		const session = makeCashGameSession({
			memo: "Great session tonight",
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		await user.click(screen.getByRole("button", { expanded: false }));

		expect(screen.getByText("Great session tonight")).toBeInTheDocument();
	});

	it("uses 'Cash Game' as fallback game name when ringGameName is null", () => {
		const session = makeCashGameSession({
			ringGameName: null,
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		expect(screen.getByText("Cash Game")).toBeInTheDocument();
	});

	it("uses 'Tournament' as fallback game name when tournamentName is null", () => {
		const session = makeTournamentSession({
			tournamentName: null,
		});
		render(
			<SessionCard onDelete={vi.fn()} onEdit={vi.fn()} session={session} />
		);

		expect(screen.getByText("Tournament")).toBeInTheDocument();
	});

	it("does not show Reopen button for active live sessions", async () => {
		const user = userEvent.setup();
		const onReopen = vi.fn();
		const session = makeCashGameSession({
			source: "live",
			status: "active",
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

		expect(
			screen.queryByRole("button", { name: REOPEN_BUTTON })
		).not.toBeInTheDocument();
	});
});

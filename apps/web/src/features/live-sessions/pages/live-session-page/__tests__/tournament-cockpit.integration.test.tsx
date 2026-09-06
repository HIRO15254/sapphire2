import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initTRPC } from "@trpc/server";
import { setupServer } from "msw/node";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import z from "zod";
import {
	renderIntegrationPage,
	trpcHttpHandler,
} from "@/__tests__/integration";
import { TournamentCockpit } from "@/features/live-sessions/pages/live-session-page/tournament-cockpit";
import { queryClient } from "@/utils/trpc";

vi.mock("@sapphire2/env/web", () => ({
	env: { VITE_SERVER_URL: "http://tournament.integration.test" },
}));

const SESSION_ID = "tourney-1";
const STACK_LABEL = "Current stack";
const MINUTE = 60_000;
const LEVEL_MINUTES = 20;

interface CreatedEvent {
	eventType: string;
	payload: Record<string, unknown>;
}

const backend = {
	createdEvents: [] as CreatedEvent[],
	currentStack: 12_000 as number | null,
	now: Date.now(),
	remainingPlayers: 12 as number | null,
	status: "active",
	timerStartedAt: null as Date | null,
	timerUpdates: [] as (number | null)[],
	totalEntries: 48 as number | null,
};

function blindLevels() {
	return [1, 2, 3, 4, 5].map((level) => ({
		ante: null,
		blind1: 100 * level,
		blind2: 200 * level,
		blind3: null,
		games: null,
		id: `lvl-${level}`,
		isBreak: false,
		level,
		minutes: LEVEL_MINUTES,
	}));
}

function events() {
	const base = [
		{
			eventType: "session_start",
			occurredAt: new Date(backend.now - 3 * 60 * MINUTE),
		},
	];
	if (backend.status === "paused") {
		base.push({
			eventType: "session_pause",
			occurredAt: new Date(backend.now - 30 * MINUTE),
		});
	}
	return base;
}

function session() {
	return {
		blindLevels: blindLevels(),
		chipPurchases: [],
		events: events(),
		heroSeatPosition: null,
		id: SESSION_ID,
		memo: null,
		roomId: null,
		ruleName: "Sunday Deepstack",
		startedAt: new Date(backend.now - 3 * 60 * MINUTE),
		status: backend.status,
		summary: {
			averageStack: 25_000,
			currentStack: backend.currentStack,
			remainingPlayers: backend.remainingPlayers,
			totalEntries: backend.totalEntries,
		},
		tableSize: 9,
		timerStartedAt: backend.timerStartedAt,
		tournamentId: null,
		variant: "NLH",
	};
}

const t = initTRPC.create({ isServer: true });
const fixtureRouter = t.router({
	liveTournamentSession: t.router({
		getById: t.procedure.input(z.custom()).query(() => session()),
		update: t.procedure
			.input(z.custom<{ timerStartedAt?: number | null }>())
			.mutation(({ input }) => {
				backend.timerUpdates.push(input.timerStartedAt ?? null);
				return { id: SESSION_ID };
			}),
	}),
	player: t.router({
		list: t.procedure.query(() => []),
	}),
	sessionEvent: t.router({
		create: t.procedure
			.input(z.custom<CreatedEvent>())
			.mutation(({ input }) => {
				backend.createdEvents.push(input);
				return { id: "evt-1" };
			}),
	}),
	sessionTablePlayer: t.router({
		list: t.procedure.input(z.custom()).query(() => []),
	}),
});

const server = setupServer(
	trpcHttpHandler("http://tournament.integration.test", fixtureRouter)
);

function renderCockpit() {
	return renderIntegrationPage(<TournamentCockpit sessionId={SESSION_ID} />, {
		path: "/active-session-next",
		queryClient,
	});
}

beforeAll(() => {
	server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
	queryClient.clear();
	queryClient.setDefaultOptions({
		queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
		mutations: { retry: false },
	});
	backend.createdEvents = [];
	backend.currentStack = 12_000;
	backend.now = Date.now();
	backend.remainingPlayers = 12;
	backend.status = "active";
	backend.timerStartedAt = null;
	backend.timerUpdates = [];
	backend.totalEntries = 48;
});

afterEach(() => {
	cleanup();
	server.resetHandlers();
});

afterAll(() => {
	server.close();
});

describe("TournamentCockpit", () => {
	it("shows the stack against the running level's big blind, the field and the average stack", async () => {
		backend.timerStartedAt = new Date(backend.now - 25 * MINUTE);
		renderCockpit();

		expect(await screen.findByText("12,000")).toBeInTheDocument();
		expect(screen.getByText("30 BB")).toBeInTheDocument();
		expect(screen.getByText("12 / 48")).toBeInTheDocument();
		expect(screen.getByText("Avg 25k")).toBeInTheDocument();
		expect(screen.getByText("L2")).toBeInTheDocument();
		expect(screen.getByText("Sunday Deepstack")).toBeInTheDocument();
	});

	it("records the stack, the players left and the entries as a single event", async () => {
		const user = userEvent.setup();
		renderCockpit();

		const stack = await screen.findByLabelText(STACK_LABEL);
		await user.clear(stack);
		await user.type(stack, "31000");
		const players = screen.getByLabelText("Players left");
		await user.clear(players);
		await user.type(players, "9");
		await user.click(screen.getByRole("button", { name: "Save stack" }));

		await waitFor(() => {
			expect(backend.createdEvents).toEqual([
				{
					eventType: "update_stack",
					liveTournamentSessionId: SESSION_ID,
					payload: {
						remainingPlayers: 9,
						stackAmount: 31_000,
						totalEntries: 48,
					},
				},
			]);
		});
	});

	it("rejects a field the server would refuse without calling it", async () => {
		const user = userEvent.setup();
		renderCockpit();

		const players = await screen.findByLabelText("Players left");
		await user.clear(players);
		await user.type(players, "0");
		await user.click(screen.getByRole("button", { name: "Save stack" }));

		expect(await screen.findByRole("alert")).toBeInTheDocument();
		expect(players).toHaveAttribute("aria-invalid", "true");
		expect(backend.createdEvents).toEqual([]);
	});

	it("offers to start the blind timer while it has not been started", async () => {
		renderCockpit();

		expect(
			await screen.findByRole("button", { name: "Start" })
		).toBeInTheDocument();
		expect(screen.getByText("L1")).toBeInTheDocument();
		expect(screen.getByText("100 / 200")).toBeInTheDocument();
	});

	it("holds the blind level at the moment the pause began", async () => {
		backend.status = "paused";
		backend.timerStartedAt = new Date(backend.now - 2 * 60 * MINUTE);
		renderCockpit();

		expect(await screen.findByText("Session paused")).toBeInTheDocument();
		expect(screen.getByText("L5")).toBeInTheDocument();
		expect(screen.getByText("10:00")).toBeInTheDocument();
		expect(screen.getByLabelText(STACK_LABEL)).toBeDisabled();
	});

	it("pushes the blind timer forward by the paused time when the session resumes", async () => {
		const user = userEvent.setup();
		backend.status = "paused";
		backend.timerStartedAt = new Date(backend.now - 2 * 60 * MINUTE);
		renderCockpit();

		await user.click(await screen.findByRole("button", { name: "Resume" }));

		await waitFor(() => {
			expect(backend.timerUpdates).toHaveLength(1);
		});
		const expected = Math.floor(
			(backend.now - 2 * 60 * MINUTE + 30 * MINUTE) / 1000
		);
		expect(backend.timerUpdates[0]).toBeGreaterThanOrEqual(expected - 2);
		expect(backend.timerUpdates[0]).toBeLessThanOrEqual(expected + 2);
		expect(backend.createdEvents.map((event) => event.eventType)).toContain(
			"session_resume"
		);
	});
});

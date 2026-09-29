import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
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
const REENTRY_OPTION = /Re-entry/;
const EDIT_BLINDS_BUTTON = /Edit blind structure/;
const STUD_MIX_PRESET = /^Stud mix/;

interface BlindLevelRow {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	games: { variants: string[] }[] | null;
	id: string;
	isBreak: boolean;
	level: number;
	minutes: number | null;
}

interface CreatedEvent {
	eventType: string;
	payload: Record<string, unknown>;
}

const backend = {
	blindLevels: [] as BlindLevelRow[],
	createdEvents: [] as CreatedEvent[],
	currentStack: 12_000 as number | null,
	now: Date.now(),
	remainingPlayers: 12 as number | null,
	snapshotUpdates: [] as Record<string, unknown>[],
	status: "active",
	timerStartedAt: null as Date | null,
	timerUpdates: [] as (number | null)[],
	totalEntries: 48 as number | null,
};

function initialBlindLevels(): BlindLevelRow[] {
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
			id: "evt-start",
			occurredAt: new Date(backend.now - 3 * 60 * MINUTE),
			payload: { timerStartedAt: null },
		},
	];
	if (backend.status === "paused") {
		base.push({
			eventType: "session_pause",
			id: "evt-pause",
			occurredAt: new Date(backend.now - 30 * MINUTE),
			payload: {},
		});
	}
	return base;
}

function session() {
	return {
		blindLevels: backend.blindLevels,
		chipPurchases: [
			{ chips: 30_000, cost: 10_000, id: "p-re", name: "Re-entry" },
		],
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
				if (Object.hasOwn(input, "timerStartedAt")) {
					backend.timerUpdates.push(input.timerStartedAt ?? null);
				}
				return { id: SESSION_ID };
			}),
		updateSnapshot: t.procedure
			.input(
				z.custom<{ blindLevels?: Omit<BlindLevelRow, "id" | "level">[] }>()
			)
			.mutation(({ input }) => {
				backend.snapshotUpdates.push(input);
				if (input.blindLevels) {
					backend.blindLevels = input.blindLevels.map((row, index) => ({
						...row,
						id: `saved-${index + 1}`,
						level: index + 1,
					}));
				}
				return { id: SESSION_ID };
			}),
	}),
	currency: t.router({ list: t.procedure.query(() => []) }),
	gameGroup: t.router({
		list: t.procedure.query(() => [
			{
				blind1Label: "SB",
				blind2Label: "BB",
				blind3Label: null,
				builtinKey: "bigbet",
				id: "grp-1",
				label: "Big Bet",
			},
			{
				blind1Label: "Small Bet",
				blind2Label: "Big Bet",
				blind3Label: "Bring-in",
				builtinKey: "stud",
				id: "grp-2",
				label: "Stud",
			},
		]),
	}),
	gameMix: t.router({
		list: t.procedure.query(() => [
			{
				builtinKey: null,
				games: ["var-2", "var-3"],
				id: "mix-1",
				label: "Stud mix",
			},
		]),
	}),
	gameVariant: t.router({
		list: t.procedure.query(() => [
			{ groupId: "grp-1", id: "var-1", label: "NLH", shortLabel: "NLH" },
			{ groupId: "grp-2", id: "var-2", label: "Razz", shortLabel: "RAZZ" },
			{ groupId: "grp-2", id: "var-3", label: "Stud", shortLabel: "STUD" },
		]),
	}),
	player: t.router({
		list: t.procedure.query(() => []),
	}),
	session: t.router({
		getById: t.procedure.input(z.custom()).query(() => ({
			id: SESSION_ID,
			memo: null,
			tags: [],
			tournamentId: null,
			tournamentName: "Sunday Deepstack",
			tournamentTableSize: 9,
			tournamentVariant: "NLH",
		})),
		update: t.procedure
			.input(z.custom<{ id: string }>())
			.mutation(({ input }) => ({ id: input.id })),
	}),
	sessionEvent: t.router({
		create: t.procedure
			.input(z.custom<CreatedEvent>())
			.mutation(({ input }) => {
				backend.createdEvents.push(input);
				return { id: "evt-1" };
			}),
		list: t.procedure.input(z.custom()).query(() => events()),
	}),
	sessionTablePlayer: t.router({
		list: t.procedure.input(z.custom()).query(() => []),
	}),
	sessionTag: t.router({ list: t.procedure.query(() => []) }),
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

async function openBlinds(user: ReturnType<typeof userEvent.setup>) {
	await user.click(
		await screen.findByRole("button", { name: EDIT_BLINDS_BUTTON })
	);
	await waitFor(() => {
		expect(screen.getByRole("tab", { name: "Blinds" })).toHaveAttribute(
			"aria-selected",
			"true"
		);
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
	backend.blindLevels = initialBlindLevels();
	backend.createdEvents = [];
	backend.currentStack = 12_000;
	backend.now = Date.now();
	backend.remainingPlayers = 12;
	backend.snapshotUpdates = [];
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
		expect(screen.getByText("12/48")).toBeInTheDocument();
		expect(screen.getByText("25,000")).toBeInTheDocument();
		expect(screen.getByText("Level 2")).toBeInTheDocument();
		expect(screen.getByText("200/400")).toBeInTheDocument();
		expect(screen.getByText("Next level in")).toBeInTheDocument();
		expect(screen.getByText("Sunday Deepstack")).toBeInTheDocument();
	});

	it("offers the tournament actions rather than the cash ones", async () => {
		renderCockpit();

		expect(
			await screen.findByRole("button", { name: "Chip purchase" })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "All-in" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Chip adjust" })
		).not.toBeInTheDocument();
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
		expect(players).toHaveAccessibleDescription(
			"Players left: Must be at least 1"
		);
		expect(screen.getByLabelText("Total entries")).not.toHaveAttribute(
			"aria-invalid"
		);
		expect(backend.createdEvents).toEqual([]);
	});

	it("offers to start the blind timer while it has not been started", async () => {
		renderCockpit();

		expect(
			await screen.findByRole("button", { name: "Start timer" })
		).toBeInTheDocument();
		expect(screen.getByText("Level 1")).toBeInTheDocument();
		expect(screen.getByText("100/200")).toBeInTheDocument();
		expect(screen.getByText("Not started")).toBeInTheDocument();
	});

	it("holds the blind level at the moment the pause began", async () => {
		backend.status = "paused";
		backend.timerStartedAt = new Date(backend.now - 2 * 60 * MINUTE);
		renderCockpit();

		expect(await screen.findByText("Session paused")).toBeInTheDocument();
		expect(screen.getByText("Level 5")).toBeInTheDocument();
		expect(screen.getByText("10:00")).toBeInTheDocument();
		expect(screen.getByText("Paused")).toBeInTheDocument();
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

	it("shifts the blind timer only once when a poll puts the session back into the paused state", async () => {
		const user = userEvent.setup();
		backend.status = "paused";
		backend.timerStartedAt = new Date(backend.now - 2 * 60 * MINUTE);
		renderCockpit();

		await user.click(await screen.findByRole("button", { name: "Resume" }));
		await waitFor(() => {
			expect(backend.timerUpdates).toHaveLength(1);
		});

		await act(async () => {
			await queryClient.invalidateQueries();
		});
		await user.click(await screen.findByRole("button", { name: "Resume" }));

		expect(backend.timerUpdates).toHaveLength(1);
	});

	it("logs a chip purchase with the option's cost and chips snapshotted", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Chip purchase" })
		);
		await user.click(
			await screen.findByRole("radio", { name: REENTRY_OPTION })
		);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(backend.createdEvents).toHaveLength(1);
		});
		expect(backend.createdEvents[0]).toMatchObject({
			eventType: "purchase_chips",
			payload: {
				chips: 30_000,
				cost: 10_000,
				name: "Re-entry",
				sessionChipPurchaseId: "p-re",
			},
		});
	});

	it("opens the blind structure from the level bar with the running level marked", async () => {
		backend.timerStartedAt = new Date(backend.now - 25 * MINUTE);
		const user = userEvent.setup();
		renderCockpit();

		await openBlinds(user);

		expect(screen.getByRole("group", { name: "Level 2" })).toHaveAttribute(
			"aria-current",
			"step"
		);
		expect(screen.getByRole("group", { name: "Level 1" })).not.toHaveAttribute(
			"aria-current"
		);
	});

	it("saves the edited structure as a whole and shows it on the level bar", async () => {
		const user = userEvent.setup();
		renderCockpit();
		await openBlinds(user);

		await user.click(screen.getByRole("button", { name: "Add level" }));
		const smallBlind = screen.getByLabelText("Level 1 SB");
		await user.clear(smallBlind);
		await user.type(smallBlind, "150");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(backend.snapshotUpdates).toHaveLength(1);
		});
		const sent = backend.snapshotUpdates[0]?.blindLevels as Record<
			string,
			unknown
		>[];
		expect(sent).toHaveLength(6);
		expect(sent[0]).toMatchObject({ blind1: 150, blind2: 200 });
		expect(sent[5]).toMatchObject({ isBreak: false, minutes: LEVEL_MINUTES });
		expect(await screen.findByText("150/200")).toBeInTheDocument();
	});

	it("picks a saved mix for a level and sends the stakes entered on its row", async () => {
		backend.timerStartedAt = new Date(backend.now - 25 * MINUTE);
		const user = userEvent.setup();
		renderCockpit();
		await openBlinds(user);

		await user.click(screen.getByRole("button", { name: "Games for level 2" }));
		const picker = await screen.findByRole("dialog", {
			name: "Level 2 games",
		});
		await user.click(within(picker).getByRole("tab", { name: "Mixed game" }));
		await user.click(
			within(picker).getByRole("radio", { name: STUD_MIX_PRESET })
		);
		await waitFor(() => {
			expect(
				screen.queryByRole("dialog", { name: "Level 2 games" })
			).not.toBeInTheDocument();
		});

		expect(
			screen.getByRole("button", { name: "Stud mix, games for level 2" })
		).toBeInTheDocument();
		expect(screen.queryByLabelText("Level 2 SB")).not.toBeInTheDocument();
		await user.type(screen.getByLabelText("Level 2 Stud Small Bet"), "100");
		await user.type(screen.getByLabelText("Level 2 Stud Big Bet"), "200");
		await user.type(screen.getByLabelText("Level 2 Stud Bring-in"), "25");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(backend.snapshotUpdates).toHaveLength(1);
		});
		const sent = backend.snapshotUpdates[0]?.blindLevels as Record<
			string,
			unknown
		>[];
		expect(sent[1]).toMatchObject({
			games: [
				{
					ante: null,
					blind1: 100,
					blind2: 200,
					blind3: 25,
					name: "Stud",
					variants: ["Razz", "Stud"],
				},
			],
		});
		expect(sent[0]).toMatchObject({ games: null });
		expect(await screen.findByText("Razz · Stud")).toBeInTheDocument();
	});

	it("puts a level back on the session game and its own blinds", async () => {
		backend.blindLevels = initialBlindLevels().map((row) =>
			row.level === 2 ? { ...row, games: [{ variants: ["Razz"] }] } : row
		);
		const user = userEvent.setup();
		renderCockpit();
		await openBlinds(user);

		await user.click(
			screen.getByRole("button", { name: "Razz, games for level 2" })
		);
		const picker = await screen.findByRole("dialog", {
			name: "Level 2 games",
		});
		await user.click(
			within(picker).getByRole("button", { name: "Use session game" })
		);
		await waitFor(() => {
			expect(
				screen.queryByRole("dialog", { name: "Level 2 games" })
			).not.toBeInTheDocument();
		});

		expect(screen.getByLabelText("Level 2 SB")).toHaveValue("200");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(backend.snapshotUpdates).toHaveLength(1);
		});
		const sent = backend.snapshotUpdates[0]?.blindLevels as Record<
			string,
			unknown
		>[];
		expect(sent[1]).toMatchObject({ blind1: 200, blind2: 400, games: null });
	});

	it("keeps an invalid blind amount from being saved and returns to the Blinds tab", async () => {
		const user = userEvent.setup();
		renderCockpit();
		await openBlinds(user);

		const smallBlind = screen.getByLabelText("Level 1 SB");
		await user.clear(smallBlind);
		await user.type(smallBlind, "1.5");
		expect(smallBlind).toHaveAccessibleDescription(
			"Must be a whole number ≥ 0"
		);

		await user.click(screen.getByRole("tab", { name: "Overview" }));
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(screen.getByRole("tab", { name: "Blinds" })).toHaveAttribute(
				"aria-selected",
				"true"
			);
		});
		expect(screen.getByLabelText("Level 1 SB")).toHaveAttribute(
			"aria-invalid",
			"true"
		);
		expect(backend.snapshotUpdates).toEqual([]);
	});
});

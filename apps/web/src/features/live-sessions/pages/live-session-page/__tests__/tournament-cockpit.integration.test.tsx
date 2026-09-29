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

function dealerButton(seat: string) {
	return `Dealer button at ${seat}`;
}
const STACK_LABEL = "Current stack";
const MINUTE = 60_000;
const LEVEL_MINUTES = 20;
const REENTRY_OPTION = /Re-entry/;
const EDIT_BLINDS_BUTTON = /Edit blind structure/;
const STUD_MIX_PRESET = /^Stud mix/;
const ANY_DEALER_BUTTON = /^Dealer button at /;
const SUNDAY_MASTER = /Sunday Deepstack/;
const TURBO_MASTER = /Turbo 5,000/;

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
	dealerSeat: null as number | null,
	handCount: null as number | null,
	handUpdates: [] as Record<string, unknown>[],
	heroSeatPosition: null as number | null,
	houseRules: null as string | null,
	now: Date.now(),
	remainingPlayers: 12 as number | null,
	snapshotUpdates: [] as Record<string, unknown>[],
	status: "active",
	timerStartedAt: null as Date | null,
	timerUpdates: [] as (number | null)[],
	totalEntries: 48 as number | null,
	linkUpdates: [] as Record<string, unknown>[],
	roomId: null as string | null,
	tournamentCreates: [] as Record<string, unknown>[],
	tournamentId: null as string | null,
};

const TOURNAMENT_MASTERS = [
	{
		bountyAmount: null,
		buyIn: 10_000,
		currencyId: null,
		entryFee: 1000,
		id: "t-master-1",
		name: "Sunday Deepstack",
		startingStack: 30_000,
		tableSize: 9,
	},
	{
		bountyAmount: null,
		buyIn: 5000,
		currencyId: null,
		entryFee: null,
		id: "t-master-2",
		name: "Turbo 5,000",
		startingStack: 15_000,
		tableSize: 9,
	},
];

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
		dealerSeat: backend.dealerSeat,
		handCount: backend.handCount,
		heroSeatPosition: backend.heroSeatPosition,
		id: SESSION_ID,
		memo: null,
		roomId: backend.roomId,
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
		tournamentId: backend.tournamentId,
		variant: "NLH",
	};
}

const t = initTRPC.create({ isServer: true });
const fixtureRouter = t.router({
	liveTournamentSession: t.router({
		getById: t.procedure.input(z.custom()).query(() => session()),
		update: t.procedure
			.input(
				z.custom<{
					dealerSeat?: number;
					handCount?: number;
					id: string;
					roomId?: string;
					timerStartedAt?: number | null;
					tournamentId?: string | null;
				}>()
			)
			.mutation(({ input }) => {
				if (input.handCount !== undefined || input.dealerSeat !== undefined) {
					backend.handUpdates.push(input);
					backend.handCount = input.handCount ?? backend.handCount;
					backend.dealerSeat = input.dealerSeat ?? backend.dealerSeat;
				}
				if (input.tournamentId !== undefined) {
					backend.linkUpdates.push(input);
					backend.tournamentId = input.tournamentId;
				}
				if (input.roomId !== undefined) {
					backend.roomId = input.roomId;
				}
				if (Object.hasOwn(input, "timerStartedAt")) {
					backend.timerUpdates.push(input.timerStartedAt ?? null);
				}
				return { id: SESSION_ID };
			}),
		updateSnapshot: t.procedure
			.input(
				z.custom<{
					blindLevels?: Omit<BlindLevelRow, "id" | "level">[];
					houseRules?: string | null;
				}>()
			)
			.mutation(({ input }) => {
				backend.snapshotUpdates.push(input);
				if (input.houseRules !== undefined) {
					backend.houseRules = input.houseRules;
				}
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
	room: t.router({
		list: t.procedure.query(() => [{ id: "room-1", name: "Card House Tokyo" }]),
	}),
	session: t.router({
		getById: t.procedure.input(z.custom()).query(() => ({
			entryFee: 1000,
			id: SESSION_ID,
			memo: null,
			roomId: backend.roomId,
			roomName: backend.roomId === null ? null : "Card House Tokyo",
			tags: [],
			tournamentBountyAmount: null,
			tournamentBuyIn: 10_000,
			tournamentHouseRules: backend.houseRules,
			tournamentId: backend.tournamentId,
			tournamentName: "Sunday Deepstack",
			tournamentStartingStack: 30_000,
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
	tournament: t.router({
		createWithLevels: t.procedure
			.input(z.custom<Record<string, unknown>>())
			.mutation(({ input }) => {
				backend.tournamentCreates.push(input);
				return { id: "t-new" };
			}),
		getById: t.procedure
			.input(z.custom<{ id: string }>())
			.query(
				({ input }) =>
					TOURNAMENT_MASTERS.find((row) => row.id === input.id) ?? null
			),
		listByRoom: t.procedure
			.input(z.custom<{ roomId: string }>())
			.query(({ input }) =>
				input.roomId === "room-1" ? TOURNAMENT_MASTERS : []
			),
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
	backend.dealerSeat = null;
	backend.handCount = null;
	backend.handUpdates = [];
	backend.heroSeatPosition = null;
	backend.houseRules = null;
	backend.now = Date.now();
	backend.remainingPlayers = 12;
	backend.snapshotUpdates = [];
	backend.status = "active";
	backend.timerStartedAt = null;
	backend.timerUpdates = [];
	backend.totalEntries = 48;
	backend.linkUpdates = [];
	backend.roomId = null;
	backend.tournamentCreates = [];
	backend.tournamentId = null;
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

describe("TournamentCockpit hands and house rules", () => {
	it("counts hands with no button while nobody is seated", async () => {
		backend.handCount = 7;
		const user = userEvent.setup();
		renderCockpit();

		await user.click(await screen.findByRole("button", { name: "Add a hand" }));

		expect(
			await screen.findByRole("button", { name: "Hand count: 8" })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("img", { name: ANY_DEALER_BUTTON })
		).not.toBeInTheDocument();
		await waitFor(() => {
			expect(backend.handUpdates).toEqual([{ handCount: 8, id: SESSION_ID }]);
		});
	});

	it("puts the button on the hero's seat when the hero is the only one seated", async () => {
		backend.handCount = 7;
		backend.heroSeatPosition = 7;
		const user = userEvent.setup();
		renderCockpit();

		expect(
			await screen.findByRole("img", { name: dealerButton("S8") })
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Add a hand" }));

		expect(
			await screen.findByRole("button", { name: "Hand count: 8" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("img", { name: dealerButton("S8") })
		).toBeInTheDocument();
		await waitFor(() => {
			expect(backend.handUpdates).toEqual([
				{ dealerSeat: 7, handCount: 8, id: SESSION_ID },
			]);
		});
	});

	it("saves the house rules to the tournament snapshot from the Notes tab", async () => {
		backend.houseRules = "Re-entry until level 8";
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Session settings" })
		);
		await user.click(await screen.findByRole("tab", { name: "Notes" }));
		const rules = await screen.findByRole("textbox", { name: "House rules" });
		expect(rules).toHaveValue("Re-entry until level 8");

		await user.type(rules, "{Enter}Late reg closes at break 2");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(backend.snapshotUpdates).toContainEqual(
				expect.objectContaining({
					houseRules: "Re-entry until level 8\nLate reg closes at break 2",
				})
			);
		});
	});
});

describe("TournamentCockpit master link", () => {
	const LINK_SHEET = "Link tournament";

	it("links an existing tournament from the header pill without touching the snapshot", async () => {
		backend.roomId = "room-1";
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Not linked to master" })
		);
		const sheet = await screen.findByRole("dialog", { name: LINK_SHEET });
		const sunday = await within(sheet).findByRole("button", {
			name: SUNDAY_MASTER,
		});
		const turbo = within(sheet).getByRole("button", { name: TURBO_MASTER });
		expect(within(sunday).getByText("Same rules")).toBeInTheDocument();
		expect(within(turbo).queryByText("Same rules")).not.toBeInTheDocument();

		await user.click(sunday);
		await user.click(within(sheet).getByRole("button", { name: "Link" }));

		await waitFor(() => {
			expect(
				screen.queryByRole("dialog", { name: LINK_SHEET })
			).not.toBeInTheDocument();
		});
		expect(backend.linkUpdates).toEqual([
			{
				id: SESSION_ID,
				keepSnapshot: true,
				roomId: "room-1",
				tournamentId: "t-master-1",
			},
		]);
		expect(backend.snapshotUpdates).toEqual([]);
		expect(
			await screen.findByRole("button", { name: "Linked to master" })
		).toBeInTheDocument();
	});

	it("saves the session's rules with its blind structure and chip purchases as a new tournament", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Not linked to master" })
		);
		const sheet = await screen.findByRole("dialog", { name: LINK_SHEET });
		await user.click(within(sheet).getByRole("tab", { name: "Create new" }));
		expect(within(sheet).getByText("10,000 + 1,000")).toBeInTheDocument();
		expect(await within(sheet).findByText("5 levels")).toBeInTheDocument();

		await user.click(
			within(sheet).getByRole("button", { name: "Create and link" })
		);

		await waitFor(() => {
			expect(
				screen.queryByRole("dialog", { name: LINK_SHEET })
			).not.toBeInTheDocument();
		});
		expect(backend.tournamentCreates).toEqual([
			{
				blindLevels: initialBlindLevels().map(
					({ id: _id, level: _level, ...row }) => row
				),
				buyIn: 10_000,
				chipPurchases: [{ chips: 30_000, cost: 10_000, name: "Re-entry" }],
				entryFee: 1000,
				name: "Sunday Deepstack",
				roomId: "room-1",
				startingStack: 30_000,
				tableSize: 9,
				variant: "NLH",
			},
		]);
		expect(backend.linkUpdates).toEqual([
			{
				id: SESSION_ID,
				keepSnapshot: true,
				roomId: "room-1",
				tournamentId: "t-new",
			},
		]);
	});
});

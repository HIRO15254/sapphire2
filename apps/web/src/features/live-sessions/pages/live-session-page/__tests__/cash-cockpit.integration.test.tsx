import { act, cleanup, screen, waitFor } from "@testing-library/react";
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
import { CashCockpit } from "@/features/live-sessions/pages/live-session-page/cash-cockpit";
import { queryClient } from "@/utils/trpc";

vi.mock("@sapphire2/env/web", () => ({
	env: { VITE_SERVER_URL: "http://cockpit.integration.test" },
}));

const SESSION_ID = "cash-1";
const STACK_LABEL = "Current stack";
const NOTE_FIELD = /^Note/;
const SINCE_START_LINE = /Session start/;
const LAST_UPDATE_LINE = /Last update/;
const STACK_FIELD = /^Stack/;
const STACK_ROW = /Stack update/;
const START_ROW = /Session start/;
const NIT_TAG_CHOICE = /Nit/;
const CASH_CHART_SUMMARY = /Cash game result chart/;
const KNOWN_PLAYER_ROW = /Takashi/;
const NEW_PLAYER_ROW = /Create as a new player/;
const CHOOSE_PHOTO_BUTTON = /Choose from library/;
const TEMPORARY_ROW = /Temporary player/;
const CREATE_TAG_ROW = /Create "Fish"/;
const WEEKEND_TAG_CHOICE = /Weekend/;
const CURRENCY_ROW = /Currency/;
const CLUB_CHIPS_ROW = /Club chips/;

interface CreatedEvent {
	eventType: string;
	occurredAt?: number;
	payload: Record<string, unknown>;
}

interface PlayerUpdate {
	id: string;
	memo?: string | null;
	name?: string;
	tagIds?: string[];
}

interface UpdatedEvent {
	id: string;
	occurredAt?: number;
	payload?: Record<string, unknown>;
}

interface SeatedPlayer {
	name: string;
	playerId: string;
	seatPosition: number;
}

const backend = {
	addedSeats: [] as SeatedPlayer[],
	createdEvents: [] as CreatedEvent[],
	currentStack: 12_000 as number | null,
	deletedEventIds: [] as string[],
	hasStackUpdate: true,
	playerMemo: "<p>Loose caller</p>" as string | null,
	playerName: "Young guy",
	secondPlayerMemo: null as string | null,
	createdTagNames: [] as string[],
	temporaryAdds: [] as { seatPosition?: number }[],
	secondPlayerName: "Red cap",
	secondPlayerTagIds: [] as string[],
	playerTagIds: ["tag-1"] as string[],
	playerUpdates: [] as PlayerUpdate[],
	removedPlayerIds: [] as string[],
	sessionCurrencyId: null as string | null,
	sessionMemo: null as string | null,
	sessionTableSize: 6 as number | null,
	sessionTagIds: [] as string[],
	snapshotUpdates: [] as Record<string, unknown>[],
	status: "active",
	updatedEvents: [] as UpdatedEvent[],
};

function events() {
	const base = [
		{
			eventType: "session_start",
			id: "evt-start",
			occurredAt: new Date("2026-06-01T10:00:00Z"),
			payload: { buyInAmount: 10_000 },
		},
	];
	if (backend.hasStackUpdate) {
		base.push({
			eventType: "update_stack",
			id: "evt-stack",
			occurredAt: new Date("2026-06-01T11:00:00Z"),
			payload: { stackAmount: backend.currentStack ?? 0 },
		});
	}
	if (backend.status === "paused") {
		base.push({
			eventType: "session_pause",
			id: "evt-pause",
			occurredAt: new Date("2026-06-01T12:00:00Z"),
			payload: {},
		});
	}
	return base;
}

function session() {
	return {
		id: SESSION_ID,
		status: backend.status,
		startedAt: new Date("2026-06-01T10:00:00Z"),
		roomId: null,
		ringGameId: null,
		ruleName: "Friday 200/400",
		variant: "NLH",
		blind2: 400,
		tableSize: backend.sessionTableSize,
		heroSeatPosition: null,
		memo: backend.sessionMemo,
		summary: {
			chipRemoveTotal: 0,
			currentStack: backend.currentStack,
			evDiff: 0,
			totalBuyIn: 10_000,
		},
	};
}

const SESSION_TAGS: { id: string; name: string; usageCount: number }[] = [
	{ id: "stag-1", name: "Weekend", usageCount: 12 },
	{ id: "stag-2", name: "Trip: Osaka", usageCount: 3 },
];

const ALL_TAGS: { color: string; id: string; name: string }[] = [
	{ color: "#ff0000", id: "tag-1", name: "Aggro" },
	{ color: "#00ff00", id: "tag-2", name: "Nit" },
];

function playerTags() {
	return ALL_TAGS.filter((tag) => backend.playerTagIds.includes(tag.id));
}

const t = initTRPC.create({ isServer: true });
const fixtureRouter = t.router({
	liveCashGameSession: t.router({
		getById: t.procedure.input(z.custom()).query(() => session()),
		update: t.procedure
			.input(
				z.custom<{ currencyId?: string; id: string; memo?: string | null }>()
			)
			.mutation(({ input }) => {
				if (input.memo !== undefined) {
					backend.sessionMemo = input.memo;
				}
				if (input.currencyId !== undefined) {
					backend.sessionCurrencyId = input.currencyId;
				}
				return { id: input.id };
			}),
		updateSnapshot: t.procedure
			.input(z.custom<Record<string, unknown>>())
			.mutation(({ input }) => {
				backend.snapshotUpdates.push(input);
				if (typeof input.tableSize === "number") {
					backend.sessionTableSize = input.tableSize;
				}
				return { id: SESSION_ID };
			}),
	}),
	sessionTablePlayer: t.router({
		add: t.procedure
			.input(z.custom<{ playerId: string; seatPosition?: number }>())
			.mutation(({ input }) => {
				backend.addedSeats.push({
					name: "Takashi",
					playerId: input.playerId,
					seatPosition: input.seatPosition ?? -1,
				});
				return { id: "seat-added" };
			}),
		addTemporary: t.procedure
			.input(z.custom<{ seatPosition?: number }>())
			.mutation(({ input }) => {
				backend.temporaryAdds.push(input);
				return { id: "seat-temp" };
			}),
		addNew: t.procedure
			.input(z.custom<{ playerName: string; seatPosition?: number }>())
			.mutation(({ input }) => {
				backend.addedSeats.push({
					name: input.playerName,
					playerId: "player-new",
					seatPosition: input.seatPosition ?? -1,
				});
				return { id: "seat-added-new" };
			}),
		list: t.procedure.input(z.custom()).query(() => ({
			items: [
				{
					id: "seat-1",
					isActive: !backend.removedPlayerIds.includes("player-1"),
					joinedAt: new Date("2026-06-01T10:05:00Z"),
					leftAt: null,
					player: {
						id: "player-1",
						isTemporary: false,
						memo: backend.playerMemo,
						name: backend.playerName,
					},
					seatPosition: 2,
					stints: [],
				},
				{
					id: "seat-2",
					isActive: !backend.removedPlayerIds.includes("player-3"),
					joinedAt: new Date("2026-06-01T10:06:00Z"),
					leftAt: null,
					player: {
						id: "player-3",
						isTemporary: false,
						memo: backend.secondPlayerMemo,
						name: backend.secondPlayerName,
					},
					seatPosition: 4,
					stints: [],
				},
				...backend.addedSeats.map((seat, index) => ({
					id: `seat-added-${index}`,
					isActive: true,
					joinedAt: new Date("2026-06-01T11:30:00Z"),
					leftAt: null,
					player: {
						id: seat.playerId,
						isTemporary: false,
						memo: null,
						name: seat.name,
					},
					seatPosition: seat.seatPosition,
					stints: [],
				})),
			],
		})),
		remove: t.procedure
			.input(z.custom<{ playerId: string }>())
			.mutation(({ input }) => {
				backend.removedPlayerIds.push(input.playerId);
				return { success: true };
			}),
	}),
	currency: t.router({
		list: t.procedure.query(() => [
			{ id: "cur-1", isFavorite: true, name: "Japanese yen", unit: "¥" },
			{ id: "cur-2", isFavorite: false, name: "Club chips", unit: "chips" },
		]),
	}),
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
		]),
	}),
	gameMix: t.router({ list: t.procedure.query(() => []) }),
	gameVariant: t.router({
		list: t.procedure.query(() => [
			{ groupId: "grp-1", id: "var-1", label: "NLH" },
		]),
	}),
	session: t.router({
		getById: t.procedure.input(z.custom()).query(() => ({
			cashAnte: 0,
			cashAnteType: "none",
			cashBlind1: 200,
			cashBlind3: null,
			cashMaxBuyIn: null,
			cashMinBuyIn: null,
			cashTableSize: backend.sessionTableSize,
			cashVariant: "NLH",
			currencyId: backend.sessionCurrencyId,
			currencyName: backend.sessionCurrencyId === "cur-2" ? "Club chips" : null,
			currencyUnit: backend.sessionCurrencyId === "cur-2" ? "chips" : null,
			id: SESSION_ID,
			memo: backend.sessionMemo,
			ringGameBlind2: 400,
			ringGameId: null,
			ringGameName: "Friday 200/400",
			roomName: null,
			tags: SESSION_TAGS.filter((tag) =>
				backend.sessionTagIds.includes(tag.id)
			),
		})),
		update: t.procedure
			.input(z.custom<{ id: string; tagIds?: string[] }>())
			.mutation(({ input }) => {
				if (input.tagIds !== undefined) {
					backend.sessionTagIds = input.tagIds;
				}
				return { id: input.id };
			}),
	}),
	sessionTag: t.router({
		create: t.procedure
			.input(z.custom<{ name: string }>())
			.mutation(({ input }) => {
				const created = {
					id: `tag-new-${SESSION_TAGS.length}`,
					name: input.name,
					usageCount: 0,
				};
				SESSION_TAGS.push(created);
				return created;
			}),
		list: t.procedure.query(() => SESSION_TAGS),
	}),
	player: t.router({
		getById: t.procedure
			.input(z.custom<{ id: string }>())
			.query(({ input }) => {
				if (input.id === "player-3") {
					return {
						id: "player-3",
						isTemporary: false,
						memo: backend.secondPlayerMemo,
						name: backend.secondPlayerName,
						tags: ALL_TAGS.filter((tag) =>
							backend.secondPlayerTagIds.includes(tag.id)
						),
					};
				}
				return {
					id: "player-1",
					isTemporary: false,
					memo: backend.playerMemo,
					name: backend.playerName,
					tags: playerTags(),
				};
			}),
		list: t.procedure.query(() => [
			{ id: "player-1", name: backend.playerName, tags: playerTags() },
			{ id: "player-2", name: "Takashi", tags: [] },
		]),
		update: t.procedure
			.input(z.custom<PlayerUpdate>())
			.mutation(({ input }) => {
				backend.playerUpdates.push(input);
				if (input.id === "player-3") {
					if (input.name !== undefined) {
						backend.secondPlayerName = input.name;
					}
					if (input.tagIds !== undefined) {
						backend.secondPlayerTagIds = input.tagIds;
					}
					if (Object.hasOwn(input, "memo")) {
						backend.secondPlayerMemo = input.memo ?? null;
					}
					return { id: input.id };
				}
				if (input.name !== undefined) {
					backend.playerName = input.name;
				}
				if (input.tagIds !== undefined) {
					backend.playerTagIds = input.tagIds;
				}
				if (Object.hasOwn(input, "memo")) {
					backend.playerMemo = input.memo ?? null;
				}
				return { id: input.id };
			}),
	}),
	playerTag: t.router({
		create: t.procedure
			.input(z.custom<{ name: string }>())
			.mutation(({ input }) => {
				backend.createdTagNames.push(input.name);
				const created = {
					color: "#0000ff",
					id: `tag-${backend.createdTagNames.length + 2}`,
					name: input.name,
				};
				ALL_TAGS.push(created);
				return created;
			}),
		list: t.procedure.query(() => ALL_TAGS),
	}),
	sessionEvent: t.router({
		create: t.procedure
			.input(z.custom<CreatedEvent>())
			.mutation(({ input }) => {
				backend.createdEvents.push(input);
				if (input.eventType === "update_stack") {
					backend.currentStack = Number(input.payload.stackAmount);
				}
				return { id: "evt-1" };
			}),
		delete: t.procedure
			.input(z.custom<{ id: string }>())
			.mutation(({ input }) => {
				backend.deletedEventIds.push(input.id);
				return { success: true };
			}),
		list: t.procedure.input(z.custom()).query(() => events()),
		update: t.procedure
			.input(z.custom<UpdatedEvent>())
			.mutation(({ input }) => {
				backend.updatedEvents.push(input);
				if (input.payload && "stackAmount" in input.payload) {
					backend.currentStack = Number(input.payload.stackAmount);
				}
				return { id: input.id };
			}),
	}),
});

const server = setupServer(
	trpcHttpHandler("http://cockpit.integration.test", fixtureRouter)
);

const originalViewport = Object.getOwnPropertyDescriptor(
	window,
	"visualViewport"
);

function stubVisualViewport(height: number) {
	const listeners = new Set<() => void>();
	const viewport = {
		height,
		addEventListener: (_type: string, fn: () => void) => listeners.add(fn),
		removeEventListener: (_type: string, fn: () => void) =>
			listeners.delete(fn),
	};
	Object.defineProperty(window, "visualViewport", {
		configurable: true,
		value: viewport,
	});
	return {
		resizeTo(next: number) {
			viewport.height = next;
			act(() => {
				for (const fn of listeners) {
					fn();
				}
			});
		},
	};
}

function renderCockpit() {
	return renderIntegrationPage(<CashCockpit sessionId={SESSION_ID} />, {
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
	backend.addedSeats = [];
	backend.createdEvents = [];
	backend.currentStack = 12_000;
	backend.deletedEventIds = [];
	backend.hasStackUpdate = true;
	backend.playerMemo = "<p>Loose caller</p>";
	backend.playerName = "Young guy";
	backend.playerTagIds = ["tag-1"];
	backend.playerUpdates = [];
	backend.secondPlayerMemo = null;
	backend.createdTagNames = [];
	backend.temporaryAdds = [];
	backend.secondPlayerName = "Red cap";
	backend.secondPlayerTagIds = [];
	backend.removedPlayerIds = [];
	backend.sessionCurrencyId = null;
	backend.sessionMemo = null;
	backend.sessionTableSize = 6;
	backend.sessionTagIds = [];
	backend.snapshotUpdates = [];
	backend.status = "active";
	backend.updatedEvents = [];
	SESSION_TAGS.length = 0;
	SESSION_TAGS.push(
		{ id: "stag-1", name: "Weekend", usageCount: 12 },
		{ id: "stag-2", name: "Trip: Osaka", usageCount: 3 }
	);
});

afterEach(() => {
	cleanup();
	server.resetHandlers();
	if (originalViewport) {
		Object.defineProperty(window, "visualViewport", originalViewport);
	} else {
		Reflect.deleteProperty(window, "visualViewport");
	}
});

afterAll(() => {
	server.close();
});

describe("CashCockpit", () => {
	it("shows the session's stack, result and big-blind count", async () => {
		renderCockpit();
		expect(await screen.findByText("12,000")).toBeInTheDocument();
		expect(screen.getByText("+2,000")).toBeInTheDocument();
		expect(screen.getByText("30 BB")).toBeInTheDocument();
		expect(screen.getByText("Friday 200/400")).toBeInTheDocument();
	});

	it("records a stack update and follows the new value", async () => {
		const user = userEvent.setup();
		renderCockpit();

		const input = await screen.findByLabelText(STACK_LABEL);
		await user.clear(input);
		await user.type(input, "18000");
		await user.click(screen.getByRole("button", { name: "Save stack" }));

		await waitFor(() => {
			expect(backend.createdEvents).toEqual([
				{
					liveCashGameSessionId: SESSION_ID,
					eventType: "update_stack",
					payload: { stackAmount: 18_000 },
				},
			]);
		});
		expect(await screen.findByText("18,000")).toBeInTheDocument();
		expect(await screen.findByText("+8,000")).toBeInTheDocument();
	});

	it("rejects a blank stack without calling the server", async () => {
		const user = userEvent.setup();
		renderCockpit();

		const input = await screen.findByLabelText(STACK_LABEL);
		await user.clear(input);
		await user.click(screen.getByRole("button", { name: "Save stack" }));

		expect(await screen.findByRole("alert")).toBeInTheDocument();
		expect(screen.getByLabelText(STACK_LABEL)).toHaveAttribute(
			"aria-invalid",
			"true"
		);
		expect(backend.createdEvents).toEqual([]);
	});

	it("follows a stack the server recorded elsewhere", async () => {
		renderCockpit();
		expect(await screen.findByLabelText(STACK_LABEL)).toHaveValue("12000");

		backend.currentStack = 24_500;
		await act(async () => {
			await queryClient.invalidateQueries();
		});

		await waitFor(() => {
			expect(screen.getByLabelText(STACK_LABEL)).toHaveValue("24500");
		});
	});

	it("hides the table while the keyboard is open so the input stays visible", async () => {
		const viewport = stubVisualViewport(800);
		renderCockpit();
		expect(await screen.findByText("30 BB")).toBeInTheDocument();

		viewport.resizeTo(430);

		expect(screen.queryByText("30 BB")).not.toBeInTheDocument();
		expect(screen.getByLabelText(STACK_LABEL)).toBeInTheDocument();

		viewport.resizeTo(800);
		expect(screen.getByText("30 BB")).toBeInTheDocument();
	});

	it("blocks stack entry while the session is paused and offers Resume", async () => {
		backend.status = "paused";
		renderCockpit();

		expect(await screen.findByText("Session paused")).toBeInTheDocument();
		expect(screen.queryByText("Paused")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
		expect(screen.getByLabelText(STACK_LABEL)).toBeDisabled();
		expect(screen.getByRole("button", { name: "Save stack" })).toBeDisabled();
	});

	it("freezes the session timer at the time the pause began", async () => {
		backend.status = "paused";
		renderCockpit();

		expect(await screen.findByText("02:00:00")).toBeInTheDocument();
	});

	it("logs a note from the action bar", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(await screen.findByRole("button", { name: "Note" }));
		await user.type(
			await screen.findByRole("textbox", { name: NOTE_FIELD }),
			"S2 started drinking"
		);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(backend.createdEvents).toHaveLength(1);
		});
		expect(backend.createdEvents[0]).toMatchObject({
			eventType: "memo",
			payload: { text: "S2 started drinking" },
		});
		expect(backend.createdEvents[0]?.occurredAt).toEqual(expect.any(Number));
	});

	it("edits a recorded stack update from the timeline", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(await screen.findByRole("button", { name: "Timeline" }));
		await user.click(await screen.findByRole("button", { name: STACK_ROW }));

		expect(
			await screen.findByRole("heading", { name: "Edit event" })
		).toBeInTheDocument();
		const stack = screen.getByRole("textbox", { name: STACK_FIELD });
		expect(stack).toHaveValue("12000");
		await user.clear(stack);
		await user.type(stack, "26000");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(backend.updatedEvents).toEqual([
				{
					id: "evt-stack",
					occurredAt: expect.any(Number),
					payload: { stackAmount: 26_000 },
				},
			]);
		});
	});

	it("returns to the timeline when the editor it opened is closed", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(await screen.findByRole("button", { name: "Timeline" }));
		await user.click(await screen.findByRole("button", { name: STACK_ROW }));

		expect(
			await screen.findByRole("heading", { name: "Edit event" })
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(
			await screen.findByRole("button", { name: STACK_ROW })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: "Edit event" })
		).not.toBeInTheDocument();
	});

	it("charts the recorded result above the timeline", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(await screen.findByRole("button", { name: "Timeline" }));

		expect(await screen.findByText(CASH_CHART_SUMMARY)).toBeInTheDocument();
	});

	it("deletes an editable event but never the session start", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(await screen.findByRole("button", { name: "Timeline" }));
		await user.click(await screen.findByRole("button", { name: START_ROW }));
		expect(
			screen.queryByRole("button", { name: "Delete this event" })
		).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		await user.click(await screen.findByRole("button", { name: STACK_ROW }));
		await user.click(
			await screen.findByRole("button", { name: "Delete this event" })
		);

		await waitFor(() => {
			expect(backend.deletedEventIds).toEqual(["evt-stack"]);
		});
	});

	it("opens a seated player's profile when their marker is tapped", async () => {
		const user = userEvent.setup();
		renderCockpit();

		expect(
			await screen.findByText("Tap a seated player to edit their profile here")
		).toBeInTheDocument();

		await user.click(
			await screen.findByRole("button", { name: "Seat 3: Young guy" })
		);

		expect(
			await screen.findByRole("textbox", { name: "Player name" })
		).toHaveValue("Young guy");
		expect(screen.getByText("S3")).toBeInTheDocument();
		expect(
			screen.queryByText("Tap a seated player to edit their profile here")
		).not.toBeInTheDocument();
	});

	it("flattens a rich-text memo into the plain-text notes field", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Seat 3: Young guy" })
		);

		expect(
			await screen.findByRole("textbox", { name: "Notes on this player" })
		).toHaveValue("Loose caller");
	});

	it("renames the player on blur and keeps their other fields", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Seat 3: Young guy" })
		);
		const name = await screen.findByRole("textbox", { name: "Player name" });
		await user.clear(name);
		await user.type(name, "Sunglasses");
		await user.tab();

		await waitFor(() => {
			expect(backend.playerUpdates).toEqual([
				{ id: "player-1", name: "Sunglasses" },
			]);
		});
	});

	it("sends the whole tag list when a label is added or removed", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Seat 3: Young guy" })
		);
		await user.click(
			await screen.findByRole("textbox", { name: "Add labels" })
		);
		await user.click(
			await screen.findByRole("button", { name: NIT_TAG_CHOICE })
		);

		await waitFor(() => {
			expect(backend.playerUpdates).toEqual([
				{ id: "player-1", tagIds: ["tag-1", "tag-2"] },
			]);
		});

		await user.click(screen.getByRole("button", { name: "Remove tag Aggro" }));

		await waitFor(() => {
			expect(backend.playerUpdates).toHaveLength(2);
		});
		expect(backend.playerUpdates[1]).toEqual({
			id: "player-1",
			tagIds: ["tag-2"],
		});
	});

	it("clears the seat and the panel when the player leaves", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Seat 3: Young guy" })
		);
		await user.click(await screen.findByRole("button", { name: "Leave" }));

		await waitFor(() => {
			expect(backend.removedPlayerIds).toEqual(["player-1"]);
		});
		expect(
			await screen.findByText("Tap a seated player to edit their profile here")
		).toBeInTheDocument();
	});

	it("measures staleness from the session start until a stack is recorded", async () => {
		backend.hasStackUpdate = false;
		renderCockpit();

		expect(await screen.findByText(SINCE_START_LINE)).toBeInTheDocument();
		expect(screen.queryByText(LAST_UPDATE_LINE)).not.toBeInTheDocument();
	});

	it("creates a label from the dropdown row rather than the Enter key", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Seat 3: Young guy" })
		);
		const input = await screen.findByRole("textbox", { name: "Add labels" });
		await user.type(input, "Fish");
		await user.keyboard("{Enter}");

		expect(backend.createdTagNames).toEqual([]);

		await user.click(
			await screen.findByRole("button", { name: CREATE_TAG_ROW })
		);

		await waitFor(() => {
			expect(backend.createdTagNames).toEqual(["Fish"]);
		});
	});

	it("seats an anonymous temporary player from the sit-in sheet", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Seat 1: empty" })
		);
		await user.click(
			await screen.findByRole("button", { name: TEMPORARY_ROW })
		);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(backend.temporaryAdds).toEqual([
				expect.objectContaining({ seatPosition: 0 }),
			]);
		});
		expect(backend.addedSeats).toEqual([]);
	});

	it("closes the label choices when focus leaves the tag row", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Seat 3: Young guy" })
		);
		await user.click(
			await screen.findByRole("textbox", { name: "Add labels" })
		);
		expect(
			await screen.findByRole("button", { name: NIT_TAG_CHOICE })
		).toBeInTheDocument();

		await user.click(
			screen.getByRole("textbox", { name: "Notes on this player" })
		);

		await waitFor(() => {
			expect(
				screen.queryByRole("button", { name: NIT_TAG_CHOICE })
			).not.toBeInTheDocument();
		});
	});

	it("does not carry one player's notes onto the next seat that is opened", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Seat 3: Young guy" })
		);
		const notes = await screen.findByRole("textbox", {
			name: "Notes on this player",
		});
		await user.clear(notes);
		await user.type(notes, "loose caller");
		await user.tab();
		await waitFor(() => {
			expect(backend.playerMemo).toBe("loose caller");
		});

		await user.click(
			await screen.findByRole("button", { name: "Seat 5: Red cap" })
		);
		await user.click(
			await screen.findByRole("textbox", { name: "Notes on this player" })
		);
		await user.tab();

		expect(
			backend.playerUpdates.filter((update) => update.id === "player-3")
		).toEqual([]);
		expect(backend.secondPlayerMemo).toBeNull();
	});

	it("seats a known player from the sheet an empty seat opens", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Seat 1: empty" })
		);
		expect(
			await screen.findByRole("heading", { name: "Sit in at S1" })
		).toBeInTheDocument();

		await user.click(
			await screen.findByRole("button", { name: KNOWN_PLAYER_ROW })
		);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(backend.addedSeats).toEqual([
				{ name: "Takashi", playerId: "player-2", seatPosition: 0 },
			]);
		});
	});

	it("registers a typed name as a regular player, not a temporary one", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Seat 4: empty" })
		);
		await user.type(
			await screen.findByRole("textbox", {
				name: "Search by name, or type a new one",
			}),
			"Blue shirt"
		);
		await user.click(
			await screen.findByRole("button", { name: NEW_PLAYER_ROW })
		);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(backend.addedSeats).toEqual([
				{ name: "Blue shirt", playerId: "player-new", seatPosition: 3 },
			]);
		});
		expect(backend.temporaryAdds).toEqual([]);
	});

	it("clears every seated player once the reset is confirmed", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Clear every seat" })
		);
		expect(
			await screen.findByText(
				"2 players leave the table. Their stints stay in the session history."
			)
		).toBeInTheDocument();
		await user.click(
			await screen.findByRole("button", { name: "Clear seats" })
		);

		await waitFor(() => {
			expect(backend.removedPlayerIds).toEqual(["player-1", "player-3"]);
		});
	});

	it("keeps the seats when the reset is cancelled", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Clear every seat" })
		);
		await user.click(await screen.findByRole("button", { name: "Cancel" }));

		expect(backend.removedPlayerIds).toEqual([]);
	});

	it("opens the screenshot scan from the table", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", {
				name: "Register seats from a photo",
			})
		);

		expect(
			await screen.findByRole("heading", { name: "Scan seats" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: CHOOSE_PHOTO_BUTTON })
		).toBeEnabled();
	});

	it("offers only notes and the timeline while the session is paused", async () => {
		backend.status = "paused";
		renderCockpit();

		expect(
			await screen.findByRole("button", { name: "Chip adjust" })
		).toBeDisabled();
		expect(screen.getByRole("button", { name: "All-in" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Timeline" })).toBeEnabled();
		expect(screen.getAllByRole("button", { name: "Note" })[0]).toBeEnabled();
	});
	it("edits the session rule from the header sheet and saves the table size", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Session settings" })
		);
		await user.click(await screen.findByRole("tab", { name: "Basics" }));

		expect(await screen.findByLabelText("Rule name")).toHaveValue(
			"Friday 200/400"
		);
		await user.selectOptions(screen.getByLabelText("Table size"), "9");

		await waitFor(() => {
			expect(backend.snapshotUpdates).toContainEqual(
				expect.objectContaining({ tableSize: 9 })
			);
		});
	});

	it("adds an existing session tag and drops it again", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Session settings" })
		);
		await user.click(await screen.findByLabelText("Add session tag"));
		await user.click(
			await screen.findByRole("button", { name: WEEKEND_TAG_CHOICE })
		);

		await waitFor(() => {
			expect(backend.sessionTagIds).toEqual(["stag-1"]);
		});

		await user.click(
			await screen.findByRole("button", { name: "Remove Weekend" })
		);

		await waitFor(() => {
			expect(backend.sessionTagIds).toEqual([]);
		});
	});

	it("switches the session currency from the currency sheet", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Session settings" })
		);
		await user.click(await screen.findByRole("button", { name: CURRENCY_ROW }));
		await user.click(
			await screen.findByRole("button", { name: CLUB_CHIPS_ROW })
		);

		await waitFor(() => {
			expect(backend.sessionCurrencyId).toBe("cur-2");
		});
	});

	it("saves the session memo when the field loses focus", async () => {
		const user = userEvent.setup();
		renderCockpit();

		await user.click(
			await screen.findByRole("button", { name: "Session settings" })
		);
		const memo = await screen.findByLabelText("Session memo");
		await user.type(memo, "Table is loose");
		await user.tab();

		await waitFor(() => {
			expect(backend.sessionMemo).toBe("Table is loose");
		});
	});
});

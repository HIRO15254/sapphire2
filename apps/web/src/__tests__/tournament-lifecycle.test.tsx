import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock window.matchMedia for ResponsiveDialog (uses useMediaQuery)
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// ---------------------------------------------------------------------------
// Mock: useActiveSession
// ---------------------------------------------------------------------------
const mockUseActiveSession = vi.fn();
vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: () => mockUseActiveSession(),
}));

// ---------------------------------------------------------------------------
// Mock: useTablePlayers – avoids the full tRPC session machinery
// ---------------------------------------------------------------------------
vi.mock("@/features/players/hooks/use-table-players", () => ({
	useTablePlayers: () => ({
		players: [],
		excludePlayerIds: [],
		handleAddExisting: vi.fn(),
		handleAddNew: vi.fn(),
		handleRemovePlayer: vi.fn(),
	}),
}));

// ---------------------------------------------------------------------------
// Mock: heavy UI sub-components that would require additional providers
// ---------------------------------------------------------------------------
vi.mock("@/features/live-sessions/components/poker-table", () => ({
	PokerTable: () => <div data-testid="poker-table" />,
}));

vi.mock("@/features/live-sessions/components/add-player-sheet", () => ({
	AddPlayerSheet: () => null,
}));

vi.mock("@/features/live-sessions/components/player-detail-sheet", () => ({
	PlayerDetailSheet: () => null,
}));

vi.mock(
	"@/features/live-sessions/components/seat-from-screenshot-sheet",
	() => ({
		SeatFromScreenshotSheet: () => null,
	})
);

// ---------------------------------------------------------------------------
// Mock: tRPC client and proxy
//
// IMPORTANT: vi.mock() factories are hoisted before variable declarations, so
// closures over module-scope `const` variables cause a TDZ ReferenceError.
// All vi.fn() instances must be created inline inside the factory.
// ---------------------------------------------------------------------------
const mockQuery = vi.fn();

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveSession: {
			getById: {
				queryOptions: (args: { id: string }) => ({
					queryKey: ["live-session", args.id],
					queryFn: () => mockQuery("live-session-getById", args),
				}),
			},
		},
		ringGame: {
			listByStore: {
				queryOptions: (args: { storeId: string }) => ({
					queryKey: ["ring-games", args.storeId],
					queryFn: () => mockQuery("ring-games", args),
				}),
			},
		},
		player: {
			list: {
				queryOptions: (args?: unknown) => ({
					queryKey: ["players", args],
					queryFn: () => mockQuery("player-list", args),
				}),
			},
			getById: {
				queryOptions: (args: { id: string }) => ({
					queryKey: ["player", args.id],
					queryFn: () => mockQuery("player-getById", args),
				}),
			},
		},
		playerTag: {
			list: {
				queryOptions: () => ({
					queryKey: ["player-tags"],
					queryFn: () => mockQuery("player-tags"),
				}),
			},
		},
		sessionEvent: {
			list: {
				queryOptions: (args?: unknown) => ({
					queryKey: ["events", args],
					queryFn: () => mockQuery("events", args),
				}),
			},
		},
		session: {
			list: {
				queryOptions: (args?: unknown) => ({
					queryKey: ["session-list", args],
					queryFn: () => mockQuery("session-list", args),
				}),
			},
		},
	},
	trpcClient: {
		liveSession: {
			discard: { mutate: vi.fn() },
			updateRule: { mutate: vi.fn() },
		},
		sessionEvent: {
			addPlayer: { mutate: vi.fn() },
			removePlayer: { mutate: vi.fn() },
			update: { mutate: vi.fn() },
			delete: { mutate: vi.fn() },
		},
		player: {
			update: { mutate: vi.fn() },
		},
		playerTag: {
			create: { mutate: vi.fn() },
		},
	},
}));

import { CompleteSessionForm } from "@/features/live-sessions/components/complete-session-form";
// biome-ignore lint/performance/noNamespaceImport: required to access named export from route module
import * as ActiveSessionEventsModule from "@/routes/active-session/events";
// Pull in route components after all mocks are declared.
// biome-ignore lint/performance/noNamespaceImport: required to access named export from route module
import * as ActiveSessionModule from "@/routes/active-session/index";

const ActiveSessionPage = ActiveSessionModule.Route.options
	.component as React.ComponentType;

const ActiveSessionEventsPage = ActiveSessionEventsModule.Route.options
	.component as React.ComponentType;

// Top-level regex literals (required by lint/performance/useTopLevelRegex)
const REGEX_STACK_15000 = /Stack: 15,000/;
const REGEX_REBUY = /Rebuy/;
const REGEX_PLACEMENT_LABEL = /placement/i;
const REGEX_TOTAL_ENTRIES_LABEL = /total entries/i;
const REGEX_PRIZE_MONEY_LABEL = /prize money/i;
const REGEX_BOUNTY_PRIZES_LABEL = /bounty prizes/i;
const REGEX_COMPLETE_TOURNAMENT = /complete tournament/i;
const REGEX_COMPLETING = /completing/i;

// ---------------------------------------------------------------------------
// Browser API polyfills required by Radix UI (dialogs, sheets, popovers)
// ---------------------------------------------------------------------------

Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	}),
});

if (!window.ResizeObserver) {
	window.ResizeObserver = class ResizeObserver {
		observe = vi.fn();
		unobserve = vi.fn();
		disconnect = vi.fn();
	};
}

// ---------------------------------------------------------------------------
// QueryClient wrapper
// ---------------------------------------------------------------------------

let testQueryClient = new QueryClient({
	defaultOptions: { queries: { retry: false } },
});

beforeEach(() => {
	testQueryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
});

function TestQueryProvider({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider client={testQueryClient}>
			{children}
		</QueryClientProvider>
	);
}

function renderWithProviders(router: any) {
	return render(
		<TestQueryProvider>
			<RouterProvider router={router} />
		</TestQueryProvider>
	);
}

// ---------------------------------------------------------------------------
// Router factory helpers
// ---------------------------------------------------------------------------

type AnyComponent = any;

function createTestRouter(Component: AnyComponent, path = "/active-session") {
	const rootRoute = createRootRoute({ component: Component });
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/active-session",
		component: Component,
	});
	const routeTree = rootRoute.addChildren([indexRoute]);
	return createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [path] }),
	});
}

function createEventsRouter() {
	const rootRoute = createRootRoute({
		component: () => <ActiveSessionEventsPage />,
	});
	const eventsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/active-session/events",
		component: ActiveSessionEventsPage as any,
	});
	const routeTree = rootRoute.addChildren([eventsRoute]);
	return createRouter({
		routeTree,
		history: createMemoryHistory({
			initialEntries: ["/active-session/events"],
		}),
	});
}

// ---------------------------------------------------------------------------
// Tests: Active session overview page — session state
// ---------------------------------------------------------------------------

describe("ActiveSessionPage — no active session", () => {
	beforeEach(() => {
		mockUseActiveSession.mockReturnValue({
			activeSession: null,
			hasActive: false,
			isLoading: false,
		});
	});

	it("shows 'No active session' message", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("No active session");
	});

	it("shows loading indicator while session is loading", async () => {
		mockUseActiveSession.mockReturnValue({
			activeSession: null,
			hasActive: false,
			isLoading: true,
		});

		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Loading...");
	});
});

// ---------------------------------------------------------------------------
// Tests: Active session page — cash game session renders correctly
// ---------------------------------------------------------------------------

describe("ActiveSessionPage — active cash game session", () => {
	beforeEach(() => {
		mockUseActiveSession.mockReturnValue({
			activeSession: { id: "cash-001", kind: "cash_game" },
			hasActive: true,
			isLoading: false,
		});

		mockQuery.mockImplementation((key: string) => {
			if (key === "live-session-getById") {
				return {
					id: "cash-001",
					kind: "cash_game",
					source: "live",
					status: "active",
					storeId: "store-1",
					currencyId: null,
					memo: null,
					startedAt: new Date(),
					endedAt: null,
					breakMinutes: null,
					sessionDate: new Date().toISOString(),
					userId: "u1",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					cashDetail: {
						sessionId: "cash-001",
						ringGameId: null,
						ruleName: "Cash Game",
						minBuyIn: null,
						maxBuyIn: null,
						tableSize: null,
						variantId: 1,
						buyIn: 10_000,
						cashOut: 12_000,
						evCashOut: null,
					},
					tournamentDetail: null,
					events: [],
					blindLevels: [],
					cashBlindSets: [],
					chipPurchaseOptions: [],
					chipPurchaseRecords: [],
					currentPlayers: [],
				};
			}
			return null;
		});
	});

	it("renders Cash Game heading", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Cash Game");
	});

	it("renders Discard button", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Discard");
	});

	it("renders the poker table", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByTestId("poker-table");
	});
});

// ---------------------------------------------------------------------------
// Tests: Active session page — tournament session renders correctly
// ---------------------------------------------------------------------------

describe("ActiveSessionPage — active tournament session", () => {
	beforeEach(() => {
		mockUseActiveSession.mockReturnValue({
			activeSession: { id: "tourn-001", kind: "tournament" },
			hasActive: true,
			isLoading: false,
		});

		mockQuery.mockImplementation((key: string) => {
			if (key === "live-session-getById") {
				return {
					id: "tourn-001",
					kind: "tournament",
					source: "live",
					status: "active",
					storeId: null,
					currencyId: null,
					memo: null,
					startedAt: new Date(),
					endedAt: null,
					breakMinutes: null,
					sessionDate: new Date().toISOString(),
					userId: "u1",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					cashDetail: null,
					tournamentDetail: {
						sessionId: "tourn-001",
						tournamentId: null,
						ruleName: "Tournament",
						startingStack: null,
						bountyAmount: null,
						tableSize: null,
						buyIn: 10_000,
						entryFee: 1000,
						variantId: 1,
						placement: null,
						totalEntries: 120,
						beforeDeadline: null,
						prizeMoney: null,
						bountyPrizes: null,
						timerStartedAt: null,
					},
					events: [],
					blindLevels: [],
					cashBlindSets: [],
					chipPurchaseOptions: [],
					chipPurchaseRecords: [],
					currentPlayers: [],
				};
			}
			return null;
		});
	});

	it("renders Tournament heading", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Tournament");
	});

	it("renders Discard button", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Discard");
	});

	it("renders the poker table for tournament", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByTestId("poker-table");
	});
});

// ---------------------------------------------------------------------------
// Tests: Tournament compact summary labels
// ---------------------------------------------------------------------------

describe("ActiveSessionPage — tournament summary labels", () => {
	beforeEach(() => {
		mockUseActiveSession.mockReturnValue({
			activeSession: { id: "tourn-002", kind: "tournament" },
			hasActive: true,
			isLoading: false,
		});
	});

	it("shows Field/Entry and Avg Stack labels from tournament summary", async () => {
		mockQuery.mockImplementation((key: string) => {
			if (key === "live-session-getById") {
				return {
					id: "tourn-002",
					kind: "tournament",
					source: "live",
					status: "active",
					storeId: null,
					currencyId: null,
					memo: null,
					startedAt: new Date(),
					endedAt: null,
					breakMinutes: null,
					sessionDate: new Date().toISOString(),
					userId: "u1",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					cashDetail: null,
					tournamentDetail: {
						sessionId: "tourn-002",
						tournamentId: "t-1",
						ruleName: "Tournament",
						startingStack: null,
						bountyAmount: null,
						tableSize: null,
						buyIn: 5000,
						entryFee: 500,
						variantId: 1,
						placement: null,
						totalEntries: 100,
						beforeDeadline: null,
						prizeMoney: null,
						bountyPrizes: null,
						timerStartedAt: null,
					},
					events: [],
					blindLevels: [],
					cashBlindSets: [],
					chipPurchaseOptions: [],
					chipPurchaseRecords: [],
					currentPlayers: [],
				};
			}
			return null;
		});

		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Field/Entry");
		expect(screen.getByText("Avg Stack")).toBeInTheDocument();
	});

	it("shows dash for Field/Entry when remainingPlayers and totalEntries are null", async () => {
		mockQuery.mockImplementation((key: string) => {
			if (key === "live-session-getById") {
				return {
					id: "tourn-002",
					kind: "tournament",
					source: "live",
					status: "active",
					storeId: null,
					currencyId: null,
					memo: null,
					startedAt: new Date(),
					endedAt: null,
					breakMinutes: null,
					sessionDate: new Date().toISOString(),
					userId: "u1",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					cashDetail: null,
					tournamentDetail: {
						sessionId: "tourn-002",
						tournamentId: null,
						ruleName: "Tournament",
						startingStack: null,
						bountyAmount: null,
						tableSize: null,
						buyIn: 10_000,
						entryFee: 1000,
						variantId: 1,
						placement: null,
						totalEntries: null,
						beforeDeadline: null,
						prizeMoney: null,
						bountyPrizes: null,
						timerStartedAt: null,
					},
					events: [],
					blindLevels: [],
					cashBlindSets: [],
					chipPurchaseOptions: [],
					chipPurchaseRecords: [],
					currentPlayers: [],
				};
			}
			return null;
		});

		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Field/Entry");
	});

	it("shows Field/Entry with totalEntries when provided (remainingPlayers is derived, not stored)", async () => {
		mockQuery.mockImplementation((key: string) => {
			if (key === "live-session-getById") {
				return {
					id: "tourn-002",
					kind: "tournament",
					source: "live",
					status: "active",
					storeId: null,
					currencyId: null,
					memo: null,
					startedAt: new Date(),
					endedAt: null,
					breakMinutes: null,
					sessionDate: new Date().toISOString(),
					userId: "u1",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					cashDetail: null,
					tournamentDetail: {
						sessionId: "tourn-002",
						tournamentId: null,
						ruleName: "Tournament",
						startingStack: null,
						bountyAmount: null,
						tableSize: null,
						buyIn: 0,
						entryFee: 0,
						variantId: 1,
						placement: null,
						totalEntries: 80,
						beforeDeadline: null,
						prizeMoney: null,
						bountyPrizes: null,
						timerStartedAt: null,
					},
					events: [],
					blindLevels: [],
					cashBlindSets: [],
					chipPurchaseOptions: [],
					chipPurchaseRecords: [],
					currentPlayers: [],
				};
			}
			return null;
		});

		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		// remainingPlayers is no longer stored in the API (derived from events);
		// totalEntries=80 is stored, so Field/Entry renders as "-/80"
		await screen.findByText("-/80");
	});
});

// ---------------------------------------------------------------------------
// Tests: Events page
// ---------------------------------------------------------------------------

describe("ActiveSessionEventsPage — no active session", () => {
	beforeEach(() => {
		mockUseActiveSession.mockReturnValue({
			activeSession: null,
			hasActive: false,
			isLoading: false,
		});
	});

	it("shows 'No active session' on the events page", async () => {
		const router = createEventsRouter();
		renderWithProviders(router);

		await screen.findByText("No active session");
	});
});

describe("ActiveSessionEventsPage — loading state", () => {
	beforeEach(() => {
		mockUseActiveSession.mockReturnValue({
			activeSession: null,
			hasActive: false,
			isLoading: true,
		});
	});

	it("shows loading indicator on the events page", async () => {
		const router = createEventsRouter();
		renderWithProviders(router);

		await screen.findByText("Loading...");
	});
});

describe("ActiveSessionEventsPage — tournament events display", () => {
	beforeEach(() => {
		mockUseActiveSession.mockReturnValue({
			activeSession: { id: "tourn-003", kind: "tournament" },
			hasActive: true,
			isLoading: false,
		});

		mockQuery.mockImplementation((key: string) => {
			if (key === "events") {
				return [
					{
						id: "evt-1",
						eventType: "update_stack",
						occurredAt: new Date("2026-04-03T10:00:00"),
						payload: {
							stackAmount: 15_000,
						},
					},
					{
						id: "evt-2",
						eventType: "purchase_chips",
						occurredAt: new Date("2026-04-03T14:00:00"),
						payload: {
							name: "Rebuy",
							cost: 100,
							chips: 10_000,
						},
					},
				];
			}
			return null;
		});
	});

	it("renders Events heading", async () => {
		const router = createEventsRouter();
		renderWithProviders(router);

		await screen.findByRole("heading", { name: "Events" });
	});

	it("renders update_stack events with 'Stack Update' label", async () => {
		const router = createEventsRouter();
		renderWithProviders(router);

		await screen.findByText("Stack Update");
	});

	it("renders purchase_chips events with 'Purchase Chips' label", async () => {
		const router = createEventsRouter();
		renderWithProviders(router);

		await screen.findByText("Purchase Chips");
	});

	it("shows the stack amount in the update_stack payload summary", async () => {
		const router = createEventsRouter();
		renderWithProviders(router);

		await screen.findByText(REGEX_STACK_15000);
	});

	it("shows purchase chips details in the payload summary", async () => {
		const router = createEventsRouter();
		renderWithProviders(router);

		await screen.findByText(REGEX_REBUY);
	});
});

describe("ActiveSessionEventsPage — empty events list", () => {
	beforeEach(() => {
		mockUseActiveSession.mockReturnValue({
			activeSession: { id: "tourn-004", kind: "tournament" },
			hasActive: true,
			isLoading: false,
		});

		mockQuery.mockReturnValue([]);
	});

	it("shows empty state message when there are no events", async () => {
		const router = createEventsRouter();
		renderWithProviders(router);

		await screen.findByText("No events recorded yet.");
	});
});

// ---------------------------------------------------------------------------
// Tests: TournamentCompleteForm — complete dialog fields
// ---------------------------------------------------------------------------

describe("CompleteSessionForm (tournament) — complete dialog fields", () => {
	it("renders placement, totalEntries, prizeMoney, and bountyPrizes inputs", () => {
		render(
			<CompleteSessionForm
				isLoading={false}
				kind="tournament"
				onSubmit={vi.fn()}
			/>
		);

		expect(screen.getByLabelText(REGEX_PLACEMENT_LABEL)).toBeInTheDocument();
		expect(
			screen.getByLabelText(REGEX_TOTAL_ENTRIES_LABEL)
		).toBeInTheDocument();
		expect(screen.getByLabelText(REGEX_PRIZE_MONEY_LABEL)).toBeInTheDocument();
		expect(
			screen.getByLabelText(REGEX_BOUNTY_PRIZES_LABEL)
		).toBeInTheDocument();
	});

	it("renders the 'Complete Tournament' submit button", () => {
		render(
			<CompleteSessionForm
				isLoading={false}
				kind="tournament"
				onSubmit={vi.fn()}
			/>
		);

		expect(
			screen.getByRole("button", { name: REGEX_COMPLETE_TOURNAMENT })
		).toBeInTheDocument();
	});

	it("disables the button and shows 'Completing...' while loading", () => {
		render(
			<CompleteSessionForm isLoading kind="tournament" onSubmit={vi.fn()} />
		);

		const button = screen.getByRole("button", { name: REGEX_COMPLETING });
		expect(button).toBeDisabled();
	});

	it("placement input accepts numeric input and is labeled required", () => {
		render(
			<CompleteSessionForm
				isLoading={false}
				kind="tournament"
				onSubmit={vi.fn()}
			/>
		);

		const input = screen.getByLabelText(REGEX_PLACEMENT_LABEL);
		expect(input).toHaveAttribute("inputMode", "numeric");
	});

	it("prizeMoney input has default of 0", () => {
		render(
			<CompleteSessionForm
				isLoading={false}
				kind="tournament"
				onSubmit={vi.fn()}
			/>
		);

		const input = screen.getByLabelText(REGEX_PRIZE_MONEY_LABEL);
		expect(input).toHaveValue("0");
	});
});

// ---------------------------------------------------------------------------
// Tests: Reopen flow concept
// ---------------------------------------------------------------------------

describe("ActiveSessionPage — reopen flow concept", () => {
	it("shows 'No active session' after tournament completion (session no longer active)", async () => {
		// Once completed, useActiveSession queries for status=active and returns
		// nothing. The page shows the no-session state, from which the user
		// navigates to Sessions to find and reopen the completed session.
		mockUseActiveSession.mockReturnValue({
			activeSession: null,
			hasActive: false,
			isLoading: false,
		});

		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("No active session");
	});

	it("shows the tournament session when still active (before completion)", async () => {
		mockUseActiveSession.mockReturnValue({
			activeSession: { id: "tourn-005", kind: "tournament" },
			hasActive: true,
			isLoading: false,
		});

		mockQuery.mockImplementation((key: string) => {
			if (key === "live-session-getById") {
				return {
					id: "tourn-005",
					kind: "tournament",
					source: "live",
					status: "active",
					storeId: null,
					currencyId: null,
					memo: null,
					startedAt: new Date(),
					endedAt: null,
					breakMinutes: null,
					sessionDate: new Date().toISOString(),
					userId: "u1",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					cashDetail: null,
					tournamentDetail: {
						sessionId: "tourn-005",
						tournamentId: null,
						ruleName: "Tournament",
						startingStack: null,
						bountyAmount: null,
						tableSize: null,
						buyIn: 5000,
						entryFee: 500,
						variantId: 1,
						placement: null,
						totalEntries: 60,
						beforeDeadline: null,
						prizeMoney: null,
						bountyPrizes: null,
						timerStartedAt: null,
					},
					events: [],
					blindLevels: [],
					cashBlindSets: [],
					chipPurchaseOptions: [],
					chipPurchaseRecords: [],
					currentPlayers: [],
				};
			}
			return null;
		});

		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Tournament");
		expect(screen.queryByText("No active session")).not.toBeInTheDocument();
	});
});

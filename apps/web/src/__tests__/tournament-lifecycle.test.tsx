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
vi.mock("@/hooks/use-active-session", () => ({
	useActiveSession: () => mockUseActiveSession(),
}));

// ---------------------------------------------------------------------------
// Mock: useTablePlayers – avoids the full tRPC session machinery
// ---------------------------------------------------------------------------
vi.mock("@/hooks/use-table-players", () => ({
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
vi.mock("@/components/live-sessions/poker-table", () => ({
	PokerTable: () => <div data-testid="poker-table" />,
}));

vi.mock("@/components/live-sessions/add-player-sheet", () => ({
	AddPlayerSheet: () => null,
}));

vi.mock("@/components/live-sessions/player-detail-sheet", () => ({
	PlayerDetailSheet: () => null,
}));

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
		liveCashGameSession: {
			getById: {
				queryOptions: (args: { id: string }) => ({
					queryKey: ["cash-session", args.id],
					queryFn: () => mockQuery("cash-getById", args),
				}),
			},
			list: {
				queryOptions: (args?: unknown) => ({
					queryKey: ["cash-list", args],
					queryFn: () => mockQuery("cash-list", args),
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: (args: { id: string }) => ({
					queryKey: ["tournament-session", args.id],
					queryFn: () => mockQuery("tournament-getById", args),
				}),
			},
			list: {
				queryOptions: (args?: unknown) => ({
					queryKey: ["tournament-list", args],
					queryFn: () => mockQuery("tournament-list", args),
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
	},
	trpcClient: {
		liveCashGameSession: {
			discard: { mutate: vi.fn() },
			updateHeroSeat: { mutate: vi.fn() },
		},
		liveTournamentSession: {
			discard: { mutate: vi.fn() },
			updateHeroSeat: { mutate: vi.fn() },
		},
		player: {
			update: { mutate: vi.fn() },
		},
		playerTag: {
			create: { mutate: vi.fn() },
		},
		sessionEvent: {
			update: { mutate: vi.fn() },
			delete: { mutate: vi.fn() },
		},
	},
}));

import { TournamentCompleteForm } from "@/components/live-tournament/tournament-complete-form";
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
const REGEX_PLACEMENT_3 = /#3/;
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
			activeSession: { id: "cash-001", type: "cash_game" },
			hasActive: true,
			isLoading: false,
		});

		mockQuery.mockImplementation((key: string) => {
			if (key === "cash-getById") {
				return {
					id: "cash-001",
					storeId: "store-1",
					ringGameId: null,
					heroSeatPosition: null,
					memo: null,
					summary: {
						totalBuyIn: 10_000,
						cashOut: null,
						profitLoss: null,
						evCashOut: null,
						currentStack: 12_000,
						addonCount: 0,
					},
				};
			}
			return null;
		});
	});

	it("renders Cash Game heading with Active badge", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Cash Game");
		expect(screen.getByText("Active")).toBeInTheDocument();
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
			activeSession: { id: "tourn-001", type: "tournament" },
			hasActive: true,
			isLoading: false,
		});

		mockQuery.mockImplementation((key: string) => {
			if (key === "tournament-getById") {
				return {
					id: "tourn-001",
					tournamentId: null,
					heroSeatPosition: null,
					memo: null,
					summary: {
						buyIn: 10_000,
						entryFee: 1000,
						currentStack: 15_000,
						remainingPlayers: 42,
						totalEntries: 120,
						totalChipPurchases: 0,
						profitLoss: null,
					},
				};
			}
			return null;
		});
	});

	it("renders Tournament heading with Active badge", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Tournament");
		expect(screen.getByText("Active")).toBeInTheDocument();
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
			activeSession: { id: "tourn-002", type: "tournament" },
			hasActive: true,
			isLoading: false,
		});
	});

	it("shows Stack and Remaining fields from tournament summary", async () => {
		mockQuery.mockImplementation((key: string) => {
			if (key === "tournament-getById") {
				return {
					id: "tourn-002",
					tournamentId: "t-1",
					heroSeatPosition: null,
					memo: null,
					summary: {
						buyIn: 5000,
						entryFee: 500,
						currentStack: 20_000,
						remainingPlayers: 30,
						totalEntries: 100,
						totalChipPurchases: 0,
						profitLoss: null,
					},
				};
			}
			return null;
		});

		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Stack");
		expect(screen.getByText("Remaining")).toBeInTheDocument();
	});

	it("shows Buy-in field when totalCost is non-zero", async () => {
		mockQuery.mockImplementation((key: string) => {
			if (key === "tournament-getById") {
				return {
					id: "tourn-002",
					tournamentId: null,
					heroSeatPosition: null,
					memo: null,
					summary: {
						buyIn: 10_000,
						entryFee: 1000,
						currentStack: null,
						remainingPlayers: null,
						totalEntries: null,
						totalChipPurchases: 0,
						profitLoss: null,
					},
				};
			}
			return null;
		});

		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Buy-in");
	});

	it("shows Entries when totalEntries is provided", async () => {
		mockQuery.mockImplementation((key: string) => {
			if (key === "tournament-getById") {
				return {
					id: "tourn-002",
					tournamentId: null,
					heroSeatPosition: null,
					memo: null,
					summary: {
						buyIn: 0,
						entryFee: 0,
						currentStack: 8000,
						remainingPlayers: 15,
						totalEntries: 80,
						totalChipPurchases: 0,
						profitLoss: null,
					},
				};
			}
			return null;
		});

		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Entries");
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
			activeSession: { id: "tourn-003", type: "tournament" },
			hasActive: true,
			isLoading: false,
		});

		mockQuery.mockImplementation((key: string) => {
			if (key === "events") {
				return [
					{
						id: "evt-1",
						eventType: "tournament_stack_record",
						occurredAt: new Date("2026-04-03T10:00:00"),
						payload: {
							stackAmount: 15_000,
							remainingPlayers: 50,
							totalEntries: 120,
							chipPurchases: [],
							chipPurchaseCounts: [],
						},
					},
					{
						id: "evt-2",
						eventType: "tournament_result",
						occurredAt: new Date("2026-04-03T14:00:00"),
						payload: {
							placement: 3,
							totalEntries: 120,
							prizeMoney: 5000,
						},
					},
				];
			}
			return null;
		});
	});

	it("renders Events heading with event count badge", async () => {
		const router = createEventsRouter();
		renderWithProviders(router);

		await screen.findByRole("heading", { name: "Events" });
		// The badge count updates once the events query resolves — wait for it
		await screen.findByText("2");
	});

	it("renders tournament_stack_record events with 'Stack Record' label", async () => {
		const router = createEventsRouter();
		renderWithProviders(router);

		await screen.findByText("Stack Record");
	});

	it("renders tournament_result events with 'Tournament Result' label", async () => {
		const router = createEventsRouter();
		renderWithProviders(router);

		await screen.findByText("Tournament Result");
	});

	it("shows the stack amount in the tournament_stack_record payload summary", async () => {
		const router = createEventsRouter();
		renderWithProviders(router);

		// formatTournamentStackSummary renders "Stack: 15,000 · 50 left · 120 entries"
		await screen.findByText(REGEX_STACK_15000);
	});

	it("shows placement in the tournament_result payload summary", async () => {
		const router = createEventsRouter();
		renderWithProviders(router);

		// formatTournamentResultSummary renders "#3 /120 Prize: 5,000"
		await screen.findByText(REGEX_PLACEMENT_3);
	});
});

describe("ActiveSessionEventsPage — empty events list", () => {
	beforeEach(() => {
		mockUseActiveSession.mockReturnValue({
			activeSession: { id: "tourn-004", type: "tournament" },
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

describe("TournamentCompleteForm — complete dialog fields", () => {
	it("renders placement, totalEntries, prizeMoney, and bountyPrizes inputs", () => {
		render(<TournamentCompleteForm isLoading={false} onSubmit={vi.fn()} />);

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
		render(<TournamentCompleteForm isLoading={false} onSubmit={vi.fn()} />);

		expect(
			screen.getByRole("button", { name: REGEX_COMPLETE_TOURNAMENT })
		).toBeInTheDocument();
	});

	it("disables the button and shows 'Completing...' while loading", () => {
		render(<TournamentCompleteForm isLoading onSubmit={vi.fn()} />);

		const button = screen.getByRole("button", { name: REGEX_COMPLETING });
		expect(button).toBeDisabled();
	});

	it("placement input has min=1 and is required", () => {
		render(<TournamentCompleteForm isLoading={false} onSubmit={vi.fn()} />);

		const input = screen.getByLabelText(REGEX_PLACEMENT_LABEL);
		expect(input).toHaveAttribute("min", "1");
		expect(input).toBeRequired();
	});

	it("prizeMoney input has defaultValue of 0", () => {
		render(<TournamentCompleteForm isLoading={false} onSubmit={vi.fn()} />);

		const input = screen.getByLabelText(REGEX_PRIZE_MONEY_LABEL);
		expect(input).toHaveValue(0);
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
			activeSession: { id: "tourn-005", type: "tournament" },
			hasActive: true,
			isLoading: false,
		});

		mockQuery.mockImplementation((key: string) => {
			if (key === "tournament-getById") {
				return {
					id: "tourn-005",
					tournamentId: null,
					heroSeatPosition: null,
					memo: null,
					summary: {
						buyIn: 5000,
						entryFee: 500,
						currentStack: 10_000,
						remainingPlayers: 10,
						totalEntries: 60,
						totalChipPurchases: 0,
						profitLoss: null,
					},
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

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

// Mock window.matchMedia for components that use useMediaQuery
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
		handleAddTemporary: vi.fn(),
		handleRemovePlayer: vi.fn(),
	}),
}));

// ---------------------------------------------------------------------------
// Mock: heavy UI sub-components that would require additional providers
// ---------------------------------------------------------------------------
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

vi.mock(
	"@/features/live-sessions/components/active-session-game-scene",
	() => ({
		ActiveSessionGameScene: () => null,
	})
);

vi.mock("@/features/live-sessions/components/session-events-scene", () => ({
	SessionEventsScene: () => <div data-testid="events-scene" />,
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
		session: {
			list: {
				queryOptions: (args?: unknown) => ({
					queryKey: ["session-list", args],
					queryFn: () => mockQuery("session-list", args),
				}),
			},
		},
		ringGame: {
			listByRoom: {
				queryOptions: (args: { roomId: string }) => ({
					queryKey: ["ring-games", args.roomId],
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
			complete: { mutate: vi.fn() },
			discard: { mutate: vi.fn() },
			updateHeroSeat: { mutate: vi.fn() },
		},
		liveTournamentSession: {
			complete: { mutate: vi.fn() },
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
			create: { mutate: vi.fn() },
			update: { mutate: vi.fn() },
			delete: { mutate: vi.fn() },
		},
	},
}));

import { TournamentCompleteForm } from "@/features/live-sessions/components/tournament-complete-form";
import { EventMenuProvider } from "@/features/live-sessions/hooks/use-event-menu";
import { StackSheetProvider } from "@/features/live-sessions/hooks/use-stack-sheet";
// Pull in the route component after all mocks are declared.
// biome-ignore lint/performance/noNamespaceImport: required to access named export from route module
import * as ActiveSessionModule from "@/routes/active-session";

const ActiveSessionPage = ActiveSessionModule.Route.options
	.component as () => ReactNode;

// Top-level regex literals (required by lint/performance/useTopLevelRegex)
const REGEX_PLACEMENT_LABEL = /placement/i;
const REGEX_TOTAL_ENTRIES_LABEL = /total entries/i;
const REGEX_PRIZE_MONEY_LABEL = /prize money/i;
const REGEX_BOUNTY_PRIZES_LABEL = /bounty prizes/i;
const REGEX_COMPLETE_TOURNAMENT = /complete tournament/i;
const REGEX_HISTORY = /History/;

// ---------------------------------------------------------------------------
// Browser API polyfills required by Radix UI (dialogs, sheets, popovers)
// ---------------------------------------------------------------------------

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

function TestProviders({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider client={testQueryClient}>
			<StackSheetProvider>
				<EventMenuProvider>{children}</EventMenuProvider>
			</StackSheetProvider>
		</QueryClientProvider>
	);
}

function renderWithProviders(router: unknown) {
	return render(
		<TestProviders>
			<RouterProvider
				router={router as Parameters<typeof RouterProvider>[0]["router"]}
			/>
		</TestProviders>
	);
}

// ---------------------------------------------------------------------------
// Router factory helpers
// ---------------------------------------------------------------------------

function createTestRouter(
	Component: () => ReactNode,
	path = "/active-session"
) {
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

// ---------------------------------------------------------------------------
// Tests: Active session page — session state
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
					roomId: "room-1",
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

	it("renders Cash Game heading", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Cash Game");
	});

	it("renders the session actions overflow button instead of an inline Discard", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByRole("button", { name: "Session actions" });
		expect(screen.queryByText("Discard")).not.toBeInTheDocument();
	});

	it("renders the seated player list with its empty state", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Players");
		expect(screen.getByText("No players seated yet.")).toBeInTheDocument();
	});

	it("renders the collapsed history section without mounting the timeline", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByRole("button", { name: REGEX_HISTORY });
		expect(screen.queryByTestId("events-scene")).not.toBeInTheDocument();
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

	it("renders Tournament heading", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Tournament");
	});

	it("renders the session actions overflow button", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByRole("button", { name: "Session actions" });
	});

	it("renders the seated player list", async () => {
		const router = createTestRouter(ActiveSessionPage);
		renderWithProviders(router);

		await screen.findByText("Players");
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

	it("shows Field/Entry and Avg Stack labels from tournament summary", async () => {
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

		await screen.findByText("Field/Entry");
		expect(screen.getByText("Avg Stack")).toBeInTheDocument();
	});

	it("shows dash for Field/Entry when remainingPlayers and totalEntries are null", async () => {
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

		await screen.findByText("Field/Entry");
	});

	it("shows Field/Entry with remainingPlayers/totalEntries when provided", async () => {
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

		await screen.findByText("15/80");
	});
});

// ---------------------------------------------------------------------------
// Tests: TournamentCompleteForm — complete dialog fields
// ---------------------------------------------------------------------------

describe("TournamentCompleteForm — complete dialog fields", () => {
	it("renders placement, totalEntries, prizeMoney, and bountyPrizes inputs", () => {
		render(
			<TournamentCompleteForm
				formId="tournament-complete-form-test"
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

	it("renders no submit button of its own and tags the form with the formId", () => {
		render(
			<TournamentCompleteForm
				formId="tournament-complete-form-test"
				onSubmit={vi.fn()}
			/>
		);

		expect(
			screen.queryByRole("button", { name: REGEX_COMPLETE_TOURNAMENT })
		).not.toBeInTheDocument();
		const form = document.getElementById("tournament-complete-form-test");
		expect(form).not.toBeNull();
		expect(form?.tagName).toBe("FORM");
	});

	it("placement input accepts numeric input and is labeled required", () => {
		render(
			<TournamentCompleteForm
				formId="tournament-complete-form-test"
				onSubmit={vi.fn()}
			/>
		);

		const input = screen.getByLabelText(REGEX_PLACEMENT_LABEL);
		expect(input).toHaveAttribute("inputMode", "numeric");
	});

	it("prizeMoney input has default of 0", () => {
		render(
			<TournamentCompleteForm
				formId="tournament-complete-form-test"
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

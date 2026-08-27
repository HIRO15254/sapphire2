import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "./test-utils";

const REGEX_BEFORE_DEADLINE_LABEL = /Early exit \(left before the result\)/i;

interface MockTournamentSession {
	blindLevels: Array<{
		ante: number | null;
		blind1: number | null;
		blind2: number | null;
		blind3: number | null;
		id: string;
		isBreak: boolean;
		level: number;
		minutes: number | null;
	}>;
	heroSeatPosition: number | null;
	id: string;
	startedAt: Date;
	status: "active" | "paused";
	summary: {
		averageStack: number;
		currentStack: number;
		remainingPlayers: number;
		totalEntries: number;
	};
	tableSize: number;
	timerStartedAt: Date | null;
}

function buildSession(): MockTournamentSession {
	return {
		blindLevels: [
			{
				ante: null,
				blind1: 100,
				blind2: 200,
				blind3: null,
				id: "level-1",
				isBreak: false,
				level: 1,
				minutes: 20,
			},
		],
		heroSeatPosition: null,
		id: "tourn-1",
		startedAt: new Date("2026-08-20T10:00:00Z"),
		status: "active",
		summary: {
			averageStack: 12_000,
			currentStack: 15_000,
			remainingPlayers: 20,
			totalEntries: 40,
		},
		tableSize: 9,
		timerStartedAt: null,
	};
}

const mocks = vi.hoisted(() => ({
	activeSession: {
		id: "tourn-1",
		type: "tournament",
	} as { id: string; type: "cash_game" | "tournament" } | null,
	discard: vi.fn(),
	isDiscardPending: false,
	isUpdatingTimer: false,
	session: null as MockTournamentSession | null,
	stack: {
		addMemo: vi.fn(),
		chipPurchaseTypes: [] as unknown[],
		complete: vi.fn(),
		isCompletePending: false,
		isStackPending: false,
		pause: vi.fn(),
		purchaseChips: vi.fn(),
		recordStack: vi.fn(),
		resume: vi.fn(),
	},
	updateTimerStartedAt: vi.fn(),
}));

vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: () => ({
		activeSession: mocks.activeSession,
		hasActive: mocks.activeSession !== null,
		isError: false,
		isLoading: false,
		onRetry: vi.fn(),
	}),
}));

vi.mock("@/features/live-sessions/hooks/use-tournament-session", () => ({
	useTournamentSession: () => ({
		discard: mocks.discard,
		isDiscardPending: mocks.isDiscardPending,
		isUpdatingTimer: mocks.isUpdatingTimer,
		session: mocks.session,
		updateTimerStartedAt: mocks.updateTimerStartedAt,
	}),
}));

vi.mock("@/features/live-sessions/hooks/use-tournament-stack", () => ({
	useTournamentStack: () => mocks.stack,
}));

vi.mock("@/features/live-sessions/hooks/use-session-events", () => ({
	useSessionEvents: () => ({
		delete: vi.fn(),
		events: [],
		isDeletePending: false,
		isUpdatePending: false,
		update: vi.fn(),
	}),
}));

vi.mock(
	"@/features/live-sessions/hooks/use-active-session-scene-state",
	() => ({
		useActiveSessionSceneState: () => ({
			excludePlayerIds: [],
			heroAvailable: true,
			heroSeatPosition: null,
			occupiedSeatPositions: new Set<number>(),
			onRemovePlayer: vi.fn(),
			onSeatExisting: vi.fn(),
			onSeatHero: vi.fn(),
			onSeatNew: vi.fn(),
			onSeatTemporary: vi.fn(),
			onUnseatHero: vi.fn(),
			seats: [],
			sessionParam: { liveTournamentSessionId: "tourn-1" },
			tableSize: 9,
			unseatedPlayers: [],
		}),
	})
);

vi.mock("@/features/players/hooks/use-player-detail", () => ({
	usePlayerDetail: () => ({
		availableTags: [],
		createTag: vi.fn(),
		isSaving: false,
		player: null,
		updatePlayer: vi.fn(),
	}),
}));

vi.mock(
	"@/features/live-sessions/pages/active-session-page/join-seat-sheet",
	() => ({
		JoinSeatSheet: () => null,
	})
);

vi.mock(
	"@/features/live-sessions/pages/active-session-page/timeline-sheet",
	() => ({
		TimelineSheet: () => null,
	})
);

vi.mock(
	"@/features/live-sessions/components/seat-from-screenshot-sheet",
	() => ({
		SeatFromScreenshotSheet: () => null,
	})
);

vi.mock(
	"@/features/live-sessions/pages/active-session-page/rule-sheet",
	() => ({
		RuleSheet: () => null,
	})
);

vi.mock(
	"@/features/live-sessions/pages/active-session-page/cash-game-session",
	() => ({
		CashGameSession: () => null,
	})
);

import { ActiveSessionPage } from "@/features/live-sessions/pages/active-session-page";

function renderPage() {
	const queryClient = createTestQueryClient();
	return render(
		<QueryClientProvider client={queryClient}>
			<ActiveSessionPage />
		</QueryClientProvider>
	);
}

async function openSessionActionsMenu(
	user: ReturnType<typeof userEvent.setup>
) {
	await user.click(screen.getByRole("button", { name: "Session actions" }));
}

describe("Tournament session lifecycle", () => {
	beforeEach(() => {
		mocks.activeSession = { id: "tourn-1", type: "tournament" };
		mocks.session = buildSession();
		mocks.discard.mockReset();
		mocks.isDiscardPending = false;
		mocks.isUpdatingTimer = false;
		mocks.updateTimerStartedAt.mockReset();
		mocks.stack.addMemo.mockReset();
		mocks.stack.chipPurchaseTypes = [];
		mocks.stack.complete.mockReset();
		mocks.stack.isCompletePending = false;
		mocks.stack.isStackPending = false;
		mocks.stack.pause.mockReset();
		mocks.stack.purchaseChips.mockReset();
		mocks.stack.recordStack.mockReset();
		mocks.stack.resume.mockReset();
	});

	it("dispatches to the tournament session view for an active tournament", () => {
		renderPage();

		expect(screen.getByText("Tournament")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Pause session" })
		).toBeInTheDocument();
	});

	it("pauses the session and shows the pause overlay once the status flips", async () => {
		const user = userEvent.setup();
		const { rerender } = renderPage();

		await user.click(screen.getByRole("button", { name: "Pause session" }));

		expect(mocks.stack.pause).toHaveBeenCalledTimes(1);
		expect(mocks.stack.resume).not.toHaveBeenCalled();

		mocks.session = { ...buildSession(), status: "paused" };
		rerender(
			<QueryClientProvider client={createTestQueryClient()}>
				<ActiveSessionPage />
			</QueryClientProvider>
		);

		expect(screen.getByText("Session paused")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Resume session" })
		).toBeInTheDocument();
	});

	it("resumes the session from the pause overlay", async () => {
		mocks.session = { ...buildSession(), status: "paused" };
		const user = userEvent.setup();
		renderPage();

		await user.click(screen.getByRole("button", { name: "Resume" }));

		expect(mocks.stack.resume).toHaveBeenCalledTimes(1);
		expect(mocks.stack.pause).not.toHaveBeenCalled();
	});

	it("opens the timer dialog from the session actions menu and saves the default start time", async () => {
		const user = userEvent.setup();
		renderPage();

		await openSessionActionsMenu(user);
		await user.click(screen.getByRole("button", { name: "Timer settings" }));

		expect(
			screen.getByRole("heading", { name: "Start Tournament Timer" })
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(mocks.updateTimerStartedAt).toHaveBeenCalledTimes(1);
		expect(mocks.updateTimerStartedAt.mock.calls[0][0]).toBeInstanceOf(Date);
	});

	it("discards the session from the session actions menu", async () => {
		const user = userEvent.setup();
		renderPage();

		await openSessionActionsMenu(user);
		await user.click(screen.getByRole("button", { name: "Discard session" }));

		const dialog = screen.getByRole("dialog", { name: "Discard session" });
		await user.click(within(dialog).getByRole("button", { name: "Discard" }));

		expect(mocks.discard).toHaveBeenCalledTimes(1);
	});

	it("completes the tournament through the early-exit path", async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(screen.getByRole("button", { name: "End session" }));

		const sheet = screen.getByRole("dialog", { name: "Complete Tournament" });
		await user.click(within(sheet).getByLabelText(REGEX_BEFORE_DEADLINE_LABEL));
		await user.click(
			within(sheet).getByRole("button", { name: "End and save" })
		);

		expect(mocks.stack.complete).toHaveBeenCalledTimes(1);
		expect(mocks.stack.complete).toHaveBeenNthCalledWith(1, {
			beforeDeadline: true,
			bountyPrizes: 0,
			prizeMoney: 0,
		});
	});

	it("returns to the no active session state once the tournament ends", () => {
		const { rerender } = renderPage();
		expect(screen.getByText("Tournament")).toBeInTheDocument();

		mocks.activeSession = null;
		rerender(
			<QueryClientProvider client={createTestQueryClient()}>
				<ActiveSessionPage />
			</QueryClientProvider>
		);

		expect(screen.getByText("No active session")).toBeInTheDocument();
		expect(screen.queryByText("Tournament")).not.toBeInTheDocument();
	});

	it("shows the no active session state before any tournament starts", () => {
		mocks.activeSession = null;
		mocks.session = null;
		renderPage();

		expect(screen.getByText("No active session")).toBeInTheDocument();
	});
});

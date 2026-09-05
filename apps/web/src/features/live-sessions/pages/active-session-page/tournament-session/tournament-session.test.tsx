import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const SCAN_BUTTON_NAME = "Register seats from a photo";
const TIMELINE_BUTTON_NAME = "Timeline";

interface MockVm {
	blindLevels: never[];
	chipPurchaseTypes: never[];
	defaultRemainingPlayers: number | null;
	defaultTotalEntries: number | null;
	handleBuyChipsSubmit: ReturnType<typeof vi.fn>;
	handleClearTimer: ReturnType<typeof vi.fn>;
	handleCompleteSubmit: ReturnType<typeof vi.fn>;
	handleMemoSubmit: ReturnType<typeof vi.fn>;
	handleRecordStack: ReturnType<typeof vi.fn>;
	handleSubmitTimer: ReturnType<typeof vi.fn>;
	hasStructure: boolean;
	isBuyChipsOpen: boolean;
	isCompleteOpen: boolean;
	isCompletePending: boolean;
	isKeyboardOpen: boolean;
	isMemoOpen: boolean;
	isPaused: boolean;
	isRuleOpen: boolean;
	isScanOpen: boolean;
	isStackPending: boolean;
	isTimelineOpen: boolean;
	isTimerDialogOpen: boolean;
	isUpdatingTimer: boolean;
	joinSeatPosition: number | null;
	lastStackUpdatedAt: string | null;
	onCloseJoin: ReturnType<typeof vi.fn>;
	onEmptySeatTap: ReturnType<typeof vi.fn>;
	onEndSession: ReturnType<typeof vi.fn>;
	onLeavePlayer: ReturnType<typeof vi.fn>;
	onOpenBuyChips: ReturnType<typeof vi.fn>;
	onOpenMemo: ReturnType<typeof vi.fn>;
	onOpenRule: ReturnType<typeof vi.fn>;
	onOpenTimeline: ReturnType<typeof vi.fn>;
	onOpenTimerDialog: ReturnType<typeof vi.fn>;
	onPlayerSeatTap: ReturnType<typeof vi.fn>;
	onResume: ReturnType<typeof vi.fn>;
	onScanFromJoin: ReturnType<typeof vi.fn>;
	onScanFromTable: ReturnType<typeof vi.fn>;
	onTogglePause: ReturnType<typeof vi.fn>;
	pausedElapsedText: string;
	sceneState: {
		excludePlayerIds: string[];
		heroAvailable: boolean;
		heroSeatPosition: number | null;
		occupiedSeatPositions: Set<number>;
		onSeatExisting: ReturnType<typeof vi.fn>;
		onSeatHero: ReturnType<typeof vi.fn>;
		onSeatNew: ReturnType<typeof vi.fn>;
		onSeatTemporary: ReturnType<typeof vi.fn>;
		sessionParam: { liveTournamentSessionId: string };
		tableSize: number;
	};
	seatedPlayers: never[];
	selection: null;
	session: { id: string } | null;
	setIsBuyChipsOpen: ReturnType<typeof vi.fn>;
	setIsCompleteOpen: ReturnType<typeof vi.fn>;
	setIsMemoOpen: ReturnType<typeof vi.fn>;
	setIsRuleOpen: ReturnType<typeof vi.fn>;
	setIsScanOpen: ReturnType<typeof vi.fn>;
	setIsTimelineOpen: ReturnType<typeof vi.fn>;
	setIsTimerDialogOpen: ReturnType<typeof vi.fn>;
	startedAt: Date;
	tableCenter: {
		averageStackText: string;
		bbText: string | undefined;
		remainText: string;
		stackText: string;
	};
	timerStartedAt: Date | null;
	title: string;
}

function makeVm(overrides: Partial<MockVm> = {}): MockVm {
	return {
		blindLevels: [],
		chipPurchaseTypes: [],
		defaultRemainingPlayers: null,
		defaultTotalEntries: null,
		handleBuyChipsSubmit: vi.fn(),
		handleClearTimer: vi.fn(),
		handleCompleteSubmit: vi.fn(),
		handleMemoSubmit: vi.fn(),
		handleRecordStack: vi.fn(),
		handleSubmitTimer: vi.fn(),
		hasStructure: false,
		isBuyChipsOpen: false,
		isCompleteOpen: false,
		isCompletePending: false,
		isKeyboardOpen: false,
		isMemoOpen: false,
		isPaused: false,
		isRuleOpen: false,
		isScanOpen: false,
		isStackPending: false,
		isTimelineOpen: false,
		isTimerDialogOpen: false,
		isUpdatingTimer: false,
		joinSeatPosition: null,
		lastStackUpdatedAt: null,
		onCloseJoin: vi.fn(),
		onEmptySeatTap: vi.fn(),
		onEndSession: vi.fn(),
		onLeavePlayer: vi.fn(),
		onOpenBuyChips: vi.fn(),
		onOpenMemo: vi.fn(),
		onOpenRule: vi.fn(),
		onOpenTimeline: vi.fn(),
		onOpenTimerDialog: vi.fn(),
		onPlayerSeatTap: vi.fn(),
		onResume: vi.fn(),
		onScanFromJoin: vi.fn(),
		onScanFromTable: vi.fn(),
		onTogglePause: vi.fn(),
		pausedElapsedText: "—",
		sceneState: {
			excludePlayerIds: [],
			heroAvailable: true,
			heroSeatPosition: null,
			occupiedSeatPositions: new Set<number>(),
			onSeatExisting: vi.fn(),
			onSeatHero: vi.fn(),
			onSeatNew: vi.fn(),
			onSeatTemporary: vi.fn(),
			sessionParam: { liveTournamentSessionId: "t-1" },
			tableSize: 2,
		},
		seatedPlayers: [],
		selection: null,
		session: { id: "t-1" },
		setIsBuyChipsOpen: vi.fn(),
		setIsCompleteOpen: vi.fn(),
		setIsMemoOpen: vi.fn(),
		setIsRuleOpen: vi.fn(),
		setIsScanOpen: vi.fn(),
		setIsTimelineOpen: vi.fn(),
		setIsTimerDialogOpen: vi.fn(),
		startedAt: new Date("2026-06-01T10:00:00Z"),
		tableCenter: {
			averageStackText: "—",
			bbText: undefined,
			remainText: "—",
			stackText: "—",
		},
		timerStartedAt: null,
		title: "Tournament",
		...overrides,
	};
}

const mocks = vi.hoisted(() => ({
	playerDetail: {
		availableTags: [] as unknown[],
		createTag: vi.fn(),
		isSaving: false,
		player: null as unknown,
		updatePlayer: vi.fn(),
	},
	useTournamentSessionView: vi.fn(),
}));

vi.mock("./use-tournament-session-view", () => ({
	useTournamentSessionView: mocks.useTournamentSessionView,
}));

vi.mock("@/features/players/hooks/use-player-detail", () => ({
	usePlayerDetail: () => mocks.playerDetail,
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
	"@/features/live-sessions/pages/active-session-page/rule-sheet",
	() => ({
		RuleSheet: () => null,
	})
);

vi.mock(
	"@/features/live-sessions/components/seat-from-screenshot-sheet",
	() => ({
		SeatFromScreenshotSheet: () => null,
	})
);

import { TournamentSession } from "./tournament-session";

describe("TournamentSession", () => {
	it("renders the table view when the keyboard is not open", () => {
		mocks.useTournamentSessionView.mockReturnValue(
			makeVm({ isKeyboardOpen: false })
		);
		render(<TournamentSession sessionId="t-1" />);

		expect(
			screen.getByRole("button", { name: SCAN_BUTTON_NAME })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: TIMELINE_BUTTON_NAME })
		).toBeInTheDocument();
	});

	it("hides the table view while keeping the rest of the screen when the keyboard is open", () => {
		mocks.useTournamentSessionView.mockReturnValue(
			makeVm({ isKeyboardOpen: true })
		);
		render(<TournamentSession sessionId="t-1" />);

		expect(
			screen.queryByRole("button", { name: SCAN_BUTTON_NAME })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: TIMELINE_BUTTON_NAME })
		).toBeInTheDocument();
	});
});

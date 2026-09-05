import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const SCAN_BUTTON_NAME = "Register seats from a photo";
const TIMELINE_BUTTON_NAME = "Timeline";

interface MockVm {
	completePreviewInput: {
		chipRemoveTotal: number;
		evDiff: number | null;
		totalBuyIn: number;
	};
	defaultFinalStack: number | undefined;
	handleAllInSubmit: ReturnType<typeof vi.fn>;
	handleChipsSubmit: ReturnType<typeof vi.fn>;
	handleCompleteSubmit: ReturnType<typeof vi.fn>;
	handleMemoSubmit: ReturnType<typeof vi.fn>;
	handleRecordStack: ReturnType<typeof vi.fn>;
	isAllInOpen: boolean;
	isChipsOpen: boolean;
	isCompleteOpen: boolean;
	isCompletePending: boolean;
	isKeyboardOpen: boolean;
	isMemoOpen: boolean;
	isPaused: boolean;
	isRuleOpen: boolean;
	isScanOpen: boolean;
	isStackPending: boolean;
	isTimelineOpen: boolean;
	joinSeatPosition: number | null;
	lastStackUpdatedAt: string | null;
	onCloseJoin: ReturnType<typeof vi.fn>;
	onEmptySeatTap: ReturnType<typeof vi.fn>;
	onEndSession: ReturnType<typeof vi.fn>;
	onLeavePlayer: ReturnType<typeof vi.fn>;
	onOpenAllIn: ReturnType<typeof vi.fn>;
	onOpenChips: ReturnType<typeof vi.fn>;
	onOpenMemo: ReturnType<typeof vi.fn>;
	onOpenRule: ReturnType<typeof vi.fn>;
	onOpenTimeline: ReturnType<typeof vi.fn>;
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
		sessionParam: { liveCashGameSessionId: string };
		tableSize: number;
	};
	seatedPlayers: never[];
	selection: null;
	session: { id: string } | null;
	setIsAllInOpen: ReturnType<typeof vi.fn>;
	setIsChipsOpen: ReturnType<typeof vi.fn>;
	setIsCompleteOpen: ReturnType<typeof vi.fn>;
	setIsMemoOpen: ReturnType<typeof vi.fn>;
	setIsRuleOpen: ReturnType<typeof vi.fn>;
	setIsScanOpen: ReturnType<typeof vi.fn>;
	setIsTimelineOpen: ReturnType<typeof vi.fn>;
	startedAt: Date;
	tableCenter: {
		bbText: string | undefined;
		deltaText: string | undefined;
		deltaTone: "positive" | "negative" | "neutral";
		evText: string | undefined;
		stackText: string;
	};
	title: string;
}

function makeVm(overrides: Partial<MockVm> = {}): MockVm {
	return {
		completePreviewInput: {
			chipRemoveTotal: 0,
			evDiff: null,
			totalBuyIn: 1000,
		},
		defaultFinalStack: 1500,
		handleAllInSubmit: vi.fn(),
		handleChipsSubmit: vi.fn(),
		handleCompleteSubmit: vi.fn(),
		handleMemoSubmit: vi.fn(),
		handleRecordStack: vi.fn(),
		isAllInOpen: false,
		isChipsOpen: false,
		isCompleteOpen: false,
		isCompletePending: false,
		isKeyboardOpen: false,
		isMemoOpen: false,
		isPaused: false,
		isRuleOpen: false,
		isScanOpen: false,
		isStackPending: false,
		isTimelineOpen: false,
		joinSeatPosition: null,
		lastStackUpdatedAt: null,
		onCloseJoin: vi.fn(),
		onEmptySeatTap: vi.fn(),
		onEndSession: vi.fn(),
		onLeavePlayer: vi.fn(),
		onOpenAllIn: vi.fn(),
		onOpenChips: vi.fn(),
		onOpenMemo: vi.fn(),
		onOpenRule: vi.fn(),
		onOpenTimeline: vi.fn(),
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
			sessionParam: { liveCashGameSessionId: "cg-1" },
			tableSize: 2,
		},
		seatedPlayers: [],
		selection: null,
		session: { id: "cg-1" },
		setIsAllInOpen: vi.fn(),
		setIsChipsOpen: vi.fn(),
		setIsCompleteOpen: vi.fn(),
		setIsMemoOpen: vi.fn(),
		setIsRuleOpen: vi.fn(),
		setIsScanOpen: vi.fn(),
		setIsTimelineOpen: vi.fn(),
		startedAt: new Date("2026-06-01T10:00:00Z"),
		tableCenter: {
			bbText: undefined,
			deltaText: undefined,
			deltaTone: "neutral",
			evText: undefined,
			stackText: "1,500",
		},
		title: "Cash Game",
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
	useCashGameSessionView: vi.fn(),
}));

vi.mock("./use-cash-game-session-view", () => ({
	useCashGameSessionView: mocks.useCashGameSessionView,
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

import { CashGameSession } from "./cash-game-session";

describe("CashGameSession", () => {
	it("renders the table view when the keyboard is not open", () => {
		mocks.useCashGameSessionView.mockReturnValue(
			makeVm({ isKeyboardOpen: false })
		);
		render(<CashGameSession sessionId="cg-1" />);

		expect(
			screen.getByRole("button", { name: SCAN_BUTTON_NAME })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: TIMELINE_BUTTON_NAME })
		).toBeInTheDocument();
	});

	it("hides the table view while keeping the rest of the screen when the keyboard is open", () => {
		mocks.useCashGameSessionView.mockReturnValue(
			makeVm({ isKeyboardOpen: true })
		);
		render(<CashGameSession sessionId="cg-1" />);

		expect(
			screen.queryByRole("button", { name: SCAN_BUTTON_NAME })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: TIMELINE_BUTTON_NAME })
		).toBeInTheDocument();
	});
});

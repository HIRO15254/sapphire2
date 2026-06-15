import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// useSessionFormState lazy-imports @/utils/trpc when a tournament master is
// picked (to hydrate blind levels / chip purchases). Stub it so the
// env-validating import chain never loads under jsdom.
vi.mock("@/utils/trpc", () => ({
	trpc: {},
	trpcClient: {
		blindLevel: {
			listByTournament: { query: vi.fn().mockResolvedValue([]) },
		},
		tournamentChipPurchase: {
			listByTournament: { query: vi.fn().mockResolvedValue([]) },
		},
	},
}));

import { useSessionWizard } from "@/features/sessions/components/session-wizard/use-session-wizard";
import type { RingGameOption } from "@/features/sessions/utils/session-form-helpers";

const RING_GAME: RingGameOption = {
	id: "rg-1",
	name: "1/2 NLH",
	variant: "nlh",
	blind1: 1,
	blind2: 2,
	blind3: null,
	ante: null,
	anteType: "none",
	tableSize: 9,
	currencyId: "c-1",
};

function stepKeys(steps: ReadonlyArray<{ key: string }>): string[] {
	return steps.map((s) => s.key);
}

describe("useSessionWizard — manual mode", () => {
	it("renders master → rules → result and starts on master", () => {
		const { result } = renderHook(() =>
			useSessionWizard({ mode: "manual", onSubmit: vi.fn() })
		);
		expect(stepKeys(result.current.steps)).toEqual([
			"master",
			"rules",
			"result",
		]);
		expect(result.current.currentStep).toBe("master");
		expect(result.current.isFirstStep).toBe(true);
		expect(result.current.isLastStep).toBe(false);
	});

	it("defaults mode to manual when omitted", () => {
		const { result } = renderHook(() =>
			useSessionWizard({ onSubmit: vi.fn() })
		);
		expect(result.current.mode).toBe("manual");
		expect(stepKeys(result.current.steps)).toEqual([
			"master",
			"rules",
			"result",
		]);
	});

	it("never offers Customize rules in manual mode, even with a master picked", () => {
		const { result } = renderHook(() =>
			useSessionWizard({
				mode: "manual",
				onSubmit: vi.fn(),
				ringGames: [RING_GAME],
			})
		);
		expect(result.current.canCustomizeRules).toBe(false);
		act(() => {
			result.current.handleGameChange(RING_GAME.id);
		});
		expect(result.current.canCustomizeRules).toBe(false);
		expect(stepKeys(result.current.steps)).toEqual([
			"master",
			"rules",
			"result",
		]);
	});

	it("walks master → rules → result via goToNext", () => {
		const { result } = renderHook(() =>
			useSessionWizard({ mode: "manual", onSubmit: vi.fn() })
		);
		act(() => result.current.goToNext());
		expect(result.current.currentStep).toBe("rules");
		act(() => result.current.goToNext());
		expect(result.current.currentStep).toBe("result");
		expect(result.current.isLastStep).toBe(true);
		// goToNext is a no-op past the last step.
		act(() => result.current.goToNext());
		expect(result.current.currentStep).toBe("result");
	});
});

describe("useSessionWizard — live mode without a master", () => {
	it("includes the Rules step so rules can be defined from scratch", () => {
		const { result } = renderHook(() =>
			useSessionWizard({ mode: "live", onSubmit: vi.fn() })
		);
		expect(stepKeys(result.current.steps)).toEqual([
			"master",
			"rules",
			"start",
		]);
	});

	it("does not offer Customize rules (Rules is already in the flow)", () => {
		const { result } = renderHook(() =>
			useSessionWizard({ mode: "live", onSubmit: vi.fn() })
		);
		expect(result.current.canCustomizeRules).toBe(false);
	});

	it("walks master → rules → start via goToNext", () => {
		const { result } = renderHook(() =>
			useSessionWizard({ mode: "live", onSubmit: vi.fn() })
		);
		act(() => result.current.goToNext());
		expect(result.current.currentStep).toBe("rules");
		act(() => result.current.goToNext());
		expect(result.current.currentStep).toBe("start");
		expect(result.current.isLastStep).toBe(true);
	});
});

describe("useSessionWizard — live mode with a master (fast path)", () => {
	function renderLiveWithGame() {
		const view = renderHook(() =>
			useSessionWizard({
				mode: "live",
				onSubmit: vi.fn(),
				ringGames: [RING_GAME],
			})
		);
		act(() => {
			view.result.current.handleGameChange(RING_GAME.id);
		});
		return view;
	}

	it("drops the Rules step once a master is selected", () => {
		const { result } = renderLiveWithGame();
		expect(stepKeys(result.current.steps)).toEqual(["master", "start"]);
		expect(result.current.currentStep).toBe("master");
	});

	it("offers Customize rules on the fast path", () => {
		const { result } = renderLiveWithGame();
		expect(result.current.canCustomizeRules).toBe(true);
	});

	it("advances master → start in a single step", () => {
		const { result } = renderLiveWithGame();
		act(() => result.current.goToNext());
		expect(result.current.currentStep).toBe("start");
		expect(result.current.isLastStep).toBe(true);
	});

	it("customizeRules inserts the Rules step and jumps to it", () => {
		const { result } = renderLiveWithGame();
		act(() => result.current.customizeRules());
		expect(stepKeys(result.current.steps)).toEqual([
			"master",
			"rules",
			"start",
		]);
		expect(result.current.currentStep).toBe("rules");
		// Already customizing — the affordance is gone.
		expect(result.current.canCustomizeRules).toBe(false);
	});

	it("keeps the Rules step after customizing even if the master is cleared", () => {
		const { result } = renderLiveWithGame();
		act(() => result.current.customizeRules());
		act(() => result.current.handleGameChange(undefined));
		expect(stepKeys(result.current.steps)).toEqual([
			"master",
			"rules",
			"start",
		]);
	});

	it("restores the Rules step when the master is cleared before customizing", () => {
		const { result } = renderLiveWithGame();
		act(() => result.current.handleGameChange(undefined));
		expect(stepKeys(result.current.steps)).toEqual([
			"master",
			"rules",
			"start",
		]);
		expect(result.current.canCustomizeRules).toBe(false);
	});

	it("Back from start returns to rules then master after customizing", () => {
		const { result } = renderLiveWithGame();
		act(() => result.current.customizeRules());
		act(() => result.current.goToNext());
		expect(result.current.currentStep).toBe("start");
		act(() => result.current.goToPrev());
		expect(result.current.currentStep).toBe("rules");
		act(() => result.current.goToPrev());
		expect(result.current.currentStep).toBe("master");
		expect(result.current.isFirstStep).toBe(true);
	});

	it("goToPrev is a no-op on the first step", () => {
		const { result } = renderLiveWithGame();
		act(() => result.current.goToPrev());
		expect(result.current.currentStep).toBe("master");
	});
});

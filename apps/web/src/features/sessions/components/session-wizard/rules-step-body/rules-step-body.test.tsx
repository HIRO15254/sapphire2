import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameVariant } from "@/features/game-variants/hooks/use-game-variants";

// RulesStepBody (tournament path) transitively imports @/utils/trpc; stub it.
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

// RulesStepBody resolves its variant selects from the user's game variants;
// stub the hook so these structural tests don't need a QueryClient. Individual
// tests seed `gameVariantsMocks.variants` before rendering.
const gameVariantsMocks = vi.hoisted(() => ({
	variants: [] as GameVariant[],
}));

vi.mock("@/features/game-variants/hooks/use-game-variants", () => ({
	useGameVariants: () => ({ variants: gameVariantsMocks.variants }),
}));

import { RulesStepBody } from "@/features/sessions/components/session-wizard/rules-step-body/rules-step-body";
import { useSessionWizard } from "@/features/sessions/components/session-wizard/use-session-wizard";
import type { RingGameOption } from "@/features/sessions/utils/session-form-helpers";

const NLH_VARIANT: GameVariant = {
	id: "v-nlh",
	name: "NLH",
	blindLabel1: "SB",
	blindLabel2: "BB",
	blindLabel3: "Straddle",
	sortOrder: 0,
	archivedAt: null,
};

const PLO8_VARIANT: GameVariant = {
	id: "v-plo8",
	name: "PLO8",
	blindLabel1: "SB",
	blindLabel2: "BB",
	blindLabel3: "Straddle",
	sortOrder: 3,
	archivedAt: null,
};

const SHORT_DECK_VARIANT: GameVariant = {
	id: "v-sd",
	name: "Short Deck",
	blindLabel1: "Button blind",
	blindLabel2: null,
	blindLabel3: null,
	sortOrder: 5,
	archivedAt: null,
};

beforeEach(() => {
	gameVariantsMocks.variants = [];
});

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

// Selects the master (applying its rule defaults) then diverges the small
// blind from it, so exactly one rule field ("SB") counts as overridden.
function setupOverriddenState() {
	const { result } = renderHook(() =>
		useSessionWizard({
			mode: "live",
			onSubmit: vi.fn(),
			ringGames: [RING_GAME],
		})
	);
	act(() => result.current.handleGameChange(RING_GAME.id));
	act(() => result.current.form.setFieldValue("blind1", "999"));
	return result;
}

describe("RulesStepBody — override badges", () => {
	it("flags diverging fields with a Modified badge by default", () => {
		const result = setupOverriddenState();
		render(
			<RulesStepBody
				currencies={[]}
				isLiveLinked={false}
				state={result.current}
			/>
		);
		expect(screen.getByText("Modified")).toBeInTheDocument();
	});

	it("hides Modified badges when showOverrides is false", () => {
		const result = setupOverriddenState();
		render(
			<RulesStepBody
				currencies={[]}
				isLiveLinked={false}
				showOverrides={false}
				state={result.current}
			/>
		);
		expect(screen.queryByText("Modified")).not.toBeInTheDocument();
	});
});

describe("RulesStepBody — live-linked tournament editors", () => {
	function renderTournamentRules(isLiveLinked: boolean) {
		const { result } = renderHook(() =>
			useSessionWizard({ mode: "manual", onSubmit: vi.fn() })
		);
		act(() => result.current.setSessionType("tournament"));
		render(
			<RulesStepBody
				currencies={[]}
				isLiveLinked={isLiveLinked}
				showOverrides={false}
				state={result.current}
			/>
		);
	}

	// The chip-purchase catalog and blind structure are event-derived for live
	// sessions (session.update rejects them), so the unified edit form must
	// disable them — done via a `disabled` fieldset wrapper.
	it("disables the chip purchase catalog when live-linked", () => {
		renderTournamentRules(true);
		expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
	});

	it("keeps the chip purchase catalog editable when not live-linked", () => {
		renderTournamentRules(false);
		expect(screen.getByRole("button", { name: "Add" })).not.toBeDisabled();
	});
});

function readVariantSelectOptions(): string[] {
	const trigger = document.querySelector("button#variant");
	const nativeSelect = trigger?.nextElementSibling;
	return Array.from(nativeSelect?.querySelectorAll("option") ?? []).map(
		(el) => el.textContent
	);
}

describe("RulesStepBody — cash variant select and blind labels", () => {
	function renderCashRules(defaultValues?: Record<string, unknown>) {
		const { result } = renderHook(() =>
			useSessionWizard({
				defaultValues: { type: "cash_game", ...defaultValues },
				mode: "manual",
				onSubmit: vi.fn(),
			})
		);
		// A <form> wrapper is required for Radix Select's hidden native
		// <select> (its form-control detection walks up to the nearest <form>
		// ancestor) — the wizard and edit form always render RulesStepBody
		// inside a real <form>.
		render(
			<form>
				<RulesStepBody
					currencies={[]}
					isLiveLinked={false}
					showOverrides={false}
					state={result.current}
				/>
			</form>
		);
		return result;
	}

	it("renders an option per active user game variant", () => {
		gameVariantsMocks.variants = [NLH_VARIANT, PLO8_VARIANT];
		renderCashRules();
		expect(readVariantSelectOptions()).toEqual(["NLH", "PLO8"]);
	});

	it("renders no options when the user has no game variants yet", () => {
		gameVariantsMocks.variants = [];
		renderCashRules();
		expect(readVariantSelectOptions()).toEqual([]);
	});

	it("falls back to SB/BB/Straddle blind inputs for the default 'NLH' variant", () => {
		gameVariantsMocks.variants = [NLH_VARIANT];
		renderCashRules();
		expect(screen.getByLabelText("SB")).toBeInTheDocument();
		expect(screen.getByLabelText("BB")).toBeInTheDocument();
		expect(screen.getByLabelText("Straddle")).toBeInTheDocument();
	});

	it("resolves blind labels from the selected variant and hides null-labeled slots", () => {
		gameVariantsMocks.variants = [SHORT_DECK_VARIANT];
		renderCashRules({ variant: "Short Deck" });
		expect(screen.getByLabelText("Button blind")).toBeInTheDocument();
		expect(screen.queryByLabelText("SB")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("BB")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Straddle")).not.toBeInTheDocument();
	});

	it("re-resolves blind labels when the variant field value changes", () => {
		gameVariantsMocks.variants = [NLH_VARIANT, SHORT_DECK_VARIANT];
		const result = renderCashRules();
		expect(screen.getByLabelText("SB")).toBeInTheDocument();
		act(() => result.current.form.setFieldValue("variant", "Short Deck"));
		expect(screen.getByLabelText("Button blind")).toBeInTheDocument();
		expect(screen.queryByLabelText("SB")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("BB")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Straddle")).not.toBeInTheDocument();
	});
});

describe("RulesStepBody — tournament variant select and blind structure labels", () => {
	function renderTournamentRulesWithDefaults(
		defaultValues?: Record<string, unknown>
	) {
		const { result } = renderHook(() =>
			useSessionWizard({
				defaultValues: { type: "tournament", ...defaultValues },
				mode: "manual",
				onSubmit: vi.fn(),
			})
		);
		// See the cash-rules helper above: a <form> wrapper is required for
		// Radix Select's hidden native <select>.
		render(
			<form>
				<RulesStepBody
					currencies={[]}
					isLiveLinked={false}
					showOverrides={false}
					state={result.current}
				/>
			</form>
		);
		return result;
	}

	it("adds a Variant select with an option per active user game variant", () => {
		gameVariantsMocks.variants = [NLH_VARIANT, PLO8_VARIANT];
		renderTournamentRulesWithDefaults();
		expect(screen.getByText("Variant")).toBeInTheDocument();
		expect(readVariantSelectOptions()).toEqual(["NLH", "PLO8"]);
	});

	it("drives the blind-structure column headers from the selected variant", async () => {
		const user = userEvent.setup();
		gameVariantsMocks.variants = [SHORT_DECK_VARIANT];
		renderTournamentRulesWithDefaults({ variant: "Short Deck" });
		await user.click(screen.getByRole("tab", { name: "Blind levels" }));
		expect(
			screen.getByRole("columnheader", { name: "Button blind" })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("columnheader", { name: "SB" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("columnheader", { name: "BB" })
		).not.toBeInTheDocument();
	});

	it("falls back to SB/BB column headers for the default 'NLH' variant", async () => {
		const user = userEvent.setup();
		gameVariantsMocks.variants = [NLH_VARIANT];
		renderTournamentRulesWithDefaults();
		await user.click(screen.getByRole("tab", { name: "Blind levels" }));
		expect(
			screen.getByRole("columnheader", { name: "SB" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("columnheader", { name: "BB" })
		).toBeInTheDocument();
	});
});

import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

import { RulesStepBody } from "@/features/sessions/components/session-wizard/rules-step-body/rules-step-body";
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

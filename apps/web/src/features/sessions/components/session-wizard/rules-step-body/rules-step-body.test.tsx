import { act, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithQueryClient, withQueryClient } from "@/__tests__/test-utils";

// RulesStepBody (tournament path) transitively imports @/utils/trpc; stub it.
// The cash/tournament rule bodies also render VariantSelect, which uses real
// react-query hooks against trpc.gameVariant.list — provide a queryFn and
// wrap renders below in a QueryClientProvider.
vi.mock("@/utils/trpc", () => ({
	trpc: {
		gameVariant: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameVariant", "list"],
					queryFn: async () => [],
				}),
			},
		},
		gameGroup: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameGroup", "list"],
					queryFn: async () => [],
				}),
			},
		},
		gameMix: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameMix", "list"],
					queryFn: async () => [],
				}),
			},
		},
	},
	trpcClient: {
		blindLevel: {
			listByTournament: { query: vi.fn().mockResolvedValue([]) },
		},
		tournamentChipPurchase: {
			listByTournament: { query: vi.fn().mockResolvedValue([]) },
		},
		gameVariant: {
			create: { mutate: vi.fn() },
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
	const { result } = renderHook(
		() =>
			useSessionWizard({
				mode: "live",
				onSubmit: vi.fn(),
				ringGames: [RING_GAME],
			}),
		{ wrapper: withQueryClient() }
	);
	act(() => result.current.handleGameChange(RING_GAME.id));
	act(() => result.current.form.setFieldValue("blind1", "999"));
	return result;
}

describe("RulesStepBody — override badges", () => {
	it("flags diverging fields with a Modified badge by default", () => {
		const result = setupOverriddenState();
		renderWithQueryClient(
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
		renderWithQueryClient(
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
		const { result } = renderHook(
			() => useSessionWizard({ mode: "manual", onSubmit: vi.fn() }),
			{ wrapper: withQueryClient() }
		);
		act(() => result.current.setSessionType("tournament"));
		renderWithQueryClient(
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

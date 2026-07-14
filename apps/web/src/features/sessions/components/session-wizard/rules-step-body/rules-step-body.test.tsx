import { act, fireEvent, renderHook, screen } from "@testing-library/react";
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

vi.mock("@/shared/components/variant-select", () => ({
	VariantSelect: ({ onChange }: { onChange: (variant: string) => void }) => (
		<button onClick={() => onChange("NL Hold'em")} type="button">
			Select plain variant
		</button>
	),
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

describe("RulesStepBody — tournament variant changes", () => {
	it("routes VariantSelect through the state handler so stale per-level games are cleared", () => {
		const { result } = renderHook(
			() => useSessionWizard({ mode: "manual", onSubmit: vi.fn() }),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.setSessionType("tournament");
		});
		act(() => {
			result.current.onVariantChange("8-Game");
			result.current.setBlindLevels([
				{
					id: "level-1",
					tournamentId: "",
					level: 1,
					isBreak: false,
					blind1: null,
					blind2: null,
					blind3: null,
					ante: null,
					minutes: 20,
					games: [
						{
							name: null,
							variants: ["NL Hold'em"],
							blind1: 100,
							blind2: 200,
							blind3: null,
							ante: 25,
						},
					],
				},
			]);
		});

		renderWithQueryClient(
			<RulesStepBody
				currencies={[]}
				isLiveLinked={false}
				showOverrides={false}
				state={result.current}
			/>
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Select plain variant" })
		);

		expect(result.current.form.state.values.variant).toBe("NL Hold'em");
		expect(result.current.blindLevels[0].games).toBeNull();
	});
});

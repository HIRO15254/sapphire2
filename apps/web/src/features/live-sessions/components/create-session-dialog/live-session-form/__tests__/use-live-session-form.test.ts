import { act, renderHook, waitFor } from "@testing-library/react";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";

// RulesStepBody (tournament) transitively imports @/utils/trpc; stub it so the
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

import { useLiveSessionForm } from "@/features/live-sessions/components/create-session-dialog/live-session-form/use-live-session-form";
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

function renderForm(onSubmit = vi.fn()) {
	return renderHook(() =>
		useLiveSessionForm({ onSubmit, ringGames: [RING_GAME] })
	);
}

describe("useLiveSessionForm — rule disclosure", () => {
	it("keeps the rules section collapsed by default", () => {
		const { result } = renderForm();
		expect(result.current.rulesOpen).toBe(false);
		expect(result.current.rulesSummary).toBeUndefined();
	});

	it("stays collapsed by default even after a master is selected", () => {
		const { result } = renderForm();
		act(() => result.current.state.handleGameChange(RING_GAME.id));
		expect(result.current.rulesOpen).toBe(false);
		expect(result.current.rulesSummary).toBe("1/2 NLH");
	});

	it("opens when toggled on and closes again when toggled off", () => {
		const { result } = renderForm();
		act(() => result.current.setRulesOpen(true));
		expect(result.current.rulesOpen).toBe(true);
		act(() => result.current.setRulesOpen(false));
		expect(result.current.rulesOpen).toBe(false);
	});
});

describe("useLiveSessionForm — submit", () => {
	it("prevents default, stops propagation and routes shaped cash values to onSubmit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderForm(onSubmit);
		const preventDefault = vi.fn();
		const stopPropagation = vi.fn();

		act(() => {
			result.current.onFormSubmit({
				preventDefault,
				stopPropagation,
			} as unknown as FormEvent);
		});

		expect(preventDefault).toHaveBeenCalledTimes(1);
		expect(stopPropagation).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ type: "cash_game" })
		);
	});
});

import { act, renderHook, waitFor } from "@testing-library/react";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/__tests__/test-utils";

// RulesStepBody (tournament) transitively imports @/utils/trpc; stub it so the
// env-validating import chain never loads under jsdom. useSessionFormState now
// calls useGameGroups (trpc.gameGroup.list / trpc.gameVariant.list) for the
// mix-games master mapping — mock the procedures to the fallback (empty) path,
// none of the assertions below exercise mix-game rows.
vi.mock("@/utils/trpc", () => ({
	trpc: {
		gameGroup: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameGroup", "list"],
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		gameVariant: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameVariant", "list"],
					queryFn: () => Promise.resolve([]),
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
	return renderHook(
		() => useLiveSessionForm({ onSubmit, ringGames: [RING_GAME] }),
		{ wrapper: withQueryClient() }
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

describe("useLiveSessionForm — geolocation default room", () => {
	it("seeds the room selection from defaultRoomId", async () => {
		const onRoomChange = vi.fn();
		const { result } = renderHook(
			() =>
				useLiveSessionForm({
					defaultRoomId: "room-near",
					onRoomChange,
					onSubmit: vi.fn(),
					ringGames: [RING_GAME],
				}),
			{ wrapper: withQueryClient() }
		);
		await waitFor(() =>
			expect(result.current.state.selectedRoomId).toBe("room-near")
		);
		expect(onRoomChange).toHaveBeenCalledWith("room-near");
	});

	it("does not override a room the user already picked", async () => {
		const { result } = renderHook(
			({ defaultRoomId }) =>
				useLiveSessionForm({
					defaultRoomId,
					onSubmit: vi.fn(),
					ringGames: [RING_GAME],
				}),
			{
				initialProps: { defaultRoomId: undefined as string | undefined },
				wrapper: withQueryClient(),
			}
		);

		act(() => result.current.state.handleRoomChange("room-manual"));
		expect(result.current.state.selectedRoomId).toBe("room-manual");

		// A geolocation suggestion that arrives afterwards must not clobber it.
		await waitFor(() =>
			expect(result.current.state.selectedRoomId).toBe("room-manual")
		);
	});

	it("does not re-seed after the user clears the selection", async () => {
		const { result } = renderHook(
			() =>
				useLiveSessionForm({
					defaultRoomId: "room-near",
					onSubmit: vi.fn(),
					ringGames: [RING_GAME],
				}),
			{ wrapper: withQueryClient() }
		);
		await waitFor(() =>
			expect(result.current.state.selectedRoomId).toBe("room-near")
		);

		act(() => result.current.state.handleRoomChange(undefined));
		expect(result.current.state.selectedRoomId).toBeUndefined();
		// Clearing is a deliberate user action — the default must stay cleared.
		await waitFor(() =>
			expect(result.current.state.selectedRoomId).toBeUndefined()
		);
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

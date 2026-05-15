import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
	useCreateSessionImpl: vi.fn(),
}));

vi.mock("@/features/live-sessions/hooks/use-create-session", () => ({
	useCreateSession: (args: { onClose: () => void }) =>
		hooks.useCreateSessionImpl(args),
}));

import { useCreateSessionDialog } from "@/features/live-sessions/components/create-session-dialog/use-create-session-dialog";

function setupImpl(overrides: Record<string, unknown> = {}) {
	const setSelectedStoreId = vi.fn();
	const createCash = vi.fn();
	const createTournament = vi.fn();
	hooks.useCreateSessionImpl.mockImplementation(() => ({
		stores: [],
		currencies: [],
		ringGames: [],
		tournaments: [],
		setSelectedStoreId,
		createCash,
		createTournament,
		isLoading: false,
		...overrides,
	}));
	return { setSelectedStoreId, createCash, createTournament };
}

describe("useCreateSessionDialog", () => {
	it("handleReset clears the selected store on the underlying hook", () => {
		const { setSelectedStoreId } = setupImpl();
		const { result } = renderHook(() =>
			useCreateSessionDialog({ onOpenChange: vi.fn() })
		);
		act(() => {
			result.current.handleReset();
		});
		expect(setSelectedStoreId).toHaveBeenCalledWith(undefined);
	});

	it("wires useCreateSession.onClose -> onOpenChange(false)", () => {
		const onOpenChange = vi.fn();
		renderHook(() => useCreateSessionDialog({ onOpenChange }));
		const lastArgs = hooks.useCreateSessionImpl.mock.calls.at(-1)?.[0];
		expect(lastArgs).toBeDefined();
		lastArgs?.onClose();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("propagates isLoading from the underlying hook", () => {
		setupImpl({ isLoading: true });
		const { result } = renderHook(() =>
			useCreateSessionDialog({ onOpenChange: vi.fn() })
		);
		expect(result.current.isLoading).toBe(true);
	});

	it("handleSubmit routes cash_game to createCash with initialBuyIn from buyIn", () => {
		const { createCash, createTournament } = setupImpl();
		const { result } = renderHook(() =>
			useCreateSessionDialog({ onOpenChange: vi.fn() })
		);
		act(() => {
			result.current.handleSubmit({
				type: "cash_game",
				sessionDate: "2026-05-15",
				buyIn: 10_000,
				cashOut: 0,
				variant: "nlh",
				storeId: "store-1",
				ringGameId: "rg-1",
				currencyId: "c-1",
				memo: "starting",
			});
		});
		expect(createCash).toHaveBeenCalledWith({
			storeId: "store-1",
			ringGameId: "rg-1",
			currencyId: "c-1",
			initialBuyIn: 10_000,
			memo: "starting",
		});
		expect(createTournament).not.toHaveBeenCalled();
	});

	it("handleSubmit routes tournament to createTournament with startingStack from form", () => {
		const { createCash, createTournament } = setupImpl();
		const { result } = renderHook(() =>
			useCreateSessionDialog({ onOpenChange: vi.fn() })
		);
		act(() => {
			result.current.handleSubmit({
				type: "tournament",
				sessionDate: "2026-05-15",
				tournamentBuyIn: 10_000,
				entryFee: 1000,
				startingStack: 20_000,
				storeId: "store-1",
				tournamentId: "t-1",
				currencyId: "c-1",
			});
		});
		expect(createTournament).toHaveBeenCalledWith({
			storeId: "store-1",
			tournamentId: "t-1",
			currencyId: "c-1",
			buyIn: 10_000,
			entryFee: 1000,
			startingStack: 20_000,
			memo: undefined,
		});
		expect(createCash).not.toHaveBeenCalled();
	});

	it("handleSubmit defaults startingStack to 0 when omitted on the tournament path", () => {
		const { createTournament } = setupImpl();
		const { result } = renderHook(() =>
			useCreateSessionDialog({ onOpenChange: vi.fn() })
		);
		act(() => {
			result.current.handleSubmit({
				type: "tournament",
				sessionDate: "2026-05-15",
				tournamentBuyIn: 10_000,
			});
		});
		expect(createTournament).toHaveBeenCalledWith(
			expect.objectContaining({ startingStack: 0 })
		);
	});
});

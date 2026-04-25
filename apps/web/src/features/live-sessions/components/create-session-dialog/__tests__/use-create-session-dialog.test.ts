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
	it("defaults sessionType to 'cash_game'", () => {
		setupImpl();
		const { result } = renderHook(() =>
			useCreateSessionDialog({ onOpenChange: vi.fn() })
		);
		expect(result.current.sessionType).toBe("cash_game");
	});

	it("setSessionType switches to 'tournament'", () => {
		setupImpl();
		const { result } = renderHook(() =>
			useCreateSessionDialog({ onOpenChange: vi.fn() })
		);
		act(() => {
			result.current.setSessionType("tournament");
		});
		expect(result.current.sessionType).toBe("tournament");
	});

	it("handleReset clears selectedStoreId (via the underlying hook) and resets sessionType", () => {
		const { setSelectedStoreId } = setupImpl();
		const { result } = renderHook(() =>
			useCreateSessionDialog({ onOpenChange: vi.fn() })
		);
		act(() => {
			result.current.setSessionType("tournament");
		});
		act(() => {
			result.current.handleReset();
		});
		expect(setSelectedStoreId).toHaveBeenCalledWith(undefined);
		expect(result.current.sessionType).toBe("cash_game");
	});

	it("wires useCreateSession.onClose -> onOpenChange(false)", () => {
		const onOpenChange = vi.fn();
		renderHook(() => useCreateSessionDialog({ onOpenChange }));
		const lastArgs = hooks.useCreateSessionImpl.mock.calls.at(-1)?.[0];
		expect(lastArgs).toBeDefined();
		lastArgs?.onClose();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("propagates createCash / createTournament / isLoading from the underlying hook", () => {
		const { createCash, createTournament } = setupImpl({ isLoading: true });
		const { result } = renderHook(() =>
			useCreateSessionDialog({ onOpenChange: vi.fn() })
		);
		expect(result.current.isLoading).toBe(true);
		expect(result.current.createCash).toBe(createCash);
		expect(result.current.createTournament).toBe(createTournament);
	});
});

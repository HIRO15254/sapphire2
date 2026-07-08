import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
	SessionFormProvider,
	useStackFormContext,
	useTournamentFormContext,
} from "@/features/live-sessions/hooks/use-session-form";

/**
 * Exercise both contexts through a single render so one `renderHook` covers the
 * whole provider surface (cash + tournament state) and the session-change reset.
 */
function useBothContexts() {
	return {
		stack: useStackFormContext(),
		tournament: useTournamentFormContext(),
	};
}

/**
 * Renders the provider with a mutable `sessionId` closure. `setSessionId`
 * updates the closure and re-renders, so the wrapper feeds the new id into the
 * provider exactly like `AuthenticatedShell` does when the active session flips.
 */
function renderWithSession(initialSessionId?: string | null) {
	let sessionId = initialSessionId;
	const wrapper = ({ children }: { children: ReactNode }) => (
		<SessionFormProvider sessionId={sessionId}>{children}</SessionFormProvider>
	);
	const view = renderHook(() => useBothContexts(), { wrapper });
	return {
		...view,
		setSessionId(next?: string | null) {
			sessionId = next;
			view.rerender();
		},
	};
}

const CHIP_COUNTS = [
	{ name: "Rebuy", count: 3, chipsPerUnit: 5000 },
	{ name: "Addon", count: 1, chipsPerUnit: 10_000 },
];

function fillTournamentA(result: {
	current: ReturnType<typeof useBothContexts>;
}) {
	act(() => {
		result.current.tournament.setStackAmount("150000");
		result.current.tournament.setRemainingPlayers("20");
		result.current.tournament.setTotalEntries("300");
		result.current.tournament.setChipPurchaseCounts(CHIP_COUNTS);
		result.current.stack.setStackAmount("88000");
		result.current.stack.setAllIns([
			{ id: 1, equity: 0.5, potSize: 1000, trials: 100, wins: 50 },
		]);
	});
}

describe("SessionFormProvider", () => {
	it("provides empty defaults for both the cash and tournament forms", () => {
		const { result } = renderWithSession("session-a");
		expect(result.current.stack.state).toEqual({ stackAmount: "", allIns: [] });
		expect(result.current.tournament.state).toEqual({
			stackAmount: "",
			remainingPlayers: "",
			totalEntries: "",
			chipPurchaseCounts: [],
		});
	});

	it("updates cash-game stackAmount and allIns through its setters", () => {
		const { result } = renderWithSession("session-a");
		act(() => {
			result.current.stack.setStackAmount("42000");
			result.current.stack.setAllIns([
				{ id: 7, equity: 0.33, potSize: 500, trials: 10, wins: 3 },
			]);
		});
		expect(result.current.stack.state.stackAmount).toBe("42000");
		expect(result.current.stack.state.allIns).toEqual([
			{ id: 7, equity: 0.33, potSize: 500, trials: 10, wins: 3 },
		]);
	});

	it("updates all four tournament fields through their setters", () => {
		const { result } = renderWithSession("session-a");
		act(() => {
			result.current.tournament.setStackAmount("150000");
			result.current.tournament.setRemainingPlayers("20");
			result.current.tournament.setTotalEntries("300");
			result.current.tournament.setChipPurchaseCounts(CHIP_COUNTS);
		});
		expect(result.current.tournament.state).toEqual({
			stackAmount: "150000",
			remainingPlayers: "20",
			totalEntries: "300",
			chipPurchaseCounts: CHIP_COUNTS,
		});
	});

	it("clears ALL cash and tournament state when the active session id changes", () => {
		const { result, setSessionId } = renderWithSession("session-a");
		fillTournamentA(result);

		act(() => {
			setSessionId("session-b");
		});

		expect(result.current.tournament.state).toEqual({
			stackAmount: "",
			remainingPlayers: "",
			totalEntries: "",
			chipPurchaseCounts: [],
		});
		expect(result.current.stack.state).toEqual({ stackAmount: "", allIns: [] });
	});

	it("resets chipPurchaseCounts to an empty array on session change so previous rebuys never leak into the next payload", () => {
		const { result, setSessionId } = renderWithSession("session-a");
		act(() => {
			result.current.tournament.setChipPurchaseCounts(CHIP_COUNTS);
		});
		expect(result.current.tournament.state.chipPurchaseCounts).toHaveLength(2);

		act(() => {
			setSessionId("session-b");
		});

		expect(result.current.tournament.state.chipPurchaseCounts).toEqual([]);
	});

	it("keeps all values when re-rendered with the SAME session id (no spurious reset)", () => {
		const { result, setSessionId } = renderWithSession("session-a");
		fillTournamentA(result);

		act(() => {
			setSessionId("session-a");
		});

		expect(result.current.tournament.state).toEqual({
			stackAmount: "150000",
			remainingPlayers: "20",
			totalEntries: "300",
			chipPurchaseCounts: CHIP_COUNTS,
		});
		expect(result.current.stack.state.stackAmount).toBe("88000");
	});

	it("resets when the session id transitions to undefined (session finished, none active)", () => {
		const { result, setSessionId } = renderWithSession("session-a");
		fillTournamentA(result);

		act(() => {
			setSessionId(undefined);
		});

		expect(result.current.tournament.state).toEqual({
			stackAmount: "",
			remainingPlayers: "",
			totalEntries: "",
			chipPurchaseCounts: [],
		});
		expect(result.current.stack.state).toEqual({ stackAmount: "", allIns: [] });
	});

	it("does not reset while the session id stays undefined across renders", () => {
		const { result, setSessionId } = renderWithSession(undefined);
		act(() => {
			result.current.tournament.setStackAmount("12345");
			result.current.stack.setStackAmount("54321");
		});

		act(() => {
			setSessionId(undefined);
		});

		expect(result.current.tournament.state.stackAmount).toBe("12345");
		expect(result.current.stack.state.stackAmount).toBe("54321");
	});

	it("throws when the tournament context hook is used outside the provider", () => {
		expect(() => renderHook(() => useTournamentFormContext())).toThrow(
			"useTournamentFormContext must be used within SessionFormProvider"
		);
	});

	it("throws when the cash context hook is used outside the provider", () => {
		expect(() => renderHook(() => useStackFormContext())).toThrow(
			"useStackFormContext must be used within SessionFormProvider"
		);
	});
});

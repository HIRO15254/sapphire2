import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/hooks/use-elapsed-time", () => ({
	useElapsedTime: (_startedAt: unknown) => "1:30:00",
}));

import { useTournamentCompactSummary } from "@/features/live-sessions/hooks/use-tournament-compact-summary";

const BASE = {
	averageStack: null,
	remainingPlayers: null,
	startedAt: new Date("2026-01-01T00:00:00Z"),
	totalEntries: null,
};

describe("useTournamentCompactSummary", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns '-' fieldEntry when both remainingPlayers and totalEntries are null", () => {
		const { result } = renderHook(() =>
			useTournamentCompactSummary({
				...BASE,
				remainingPlayers: null,
				totalEntries: null,
			})
		);
		expect(result.current.fieldEntry).toBe("-");
	});

	it("formats fieldEntry as 'remaining/total' when both present", () => {
		const { result } = renderHook(() =>
			useTournamentCompactSummary({
				...BASE,
				remainingPlayers: 42,
				totalEntries: 100,
			})
		);
		expect(result.current.fieldEntry).toBe("42/100");
	});

	it("uses '-' placeholder when only remainingPlayers is null (partial)", () => {
		const { result } = renderHook(() =>
			useTournamentCompactSummary({
				...BASE,
				remainingPlayers: null,
				totalEntries: 100,
			})
		);
		expect(result.current.fieldEntry).toBe("-/100");
	});

	it("uses '-' placeholder when only totalEntries is null (partial)", () => {
		const { result } = renderHook(() =>
			useTournamentCompactSummary({
				...BASE,
				remainingPlayers: 42,
				totalEntries: null,
			})
		);
		expect(result.current.fieldEntry).toBe("42/-");
	});

	it("returns '-' averageStackFormatted when averageStack is null", () => {
		const { result } = renderHook(() =>
			useTournamentCompactSummary({
				...BASE,
				averageStack: null,
			})
		);
		expect(result.current.averageStackFormatted).toBe("-");
	});

	it("formats averageStack via formatCompactNumber when non-null", () => {
		const { result } = renderHook(() =>
			useTournamentCompactSummary({
				...BASE,
				averageStack: 10_000,
			})
		);
		expect(result.current.averageStackFormatted).toBe("10k");
	});

	it("formats 0 averageStack as '0' (not '-')", () => {
		const { result } = renderHook(() =>
			useTournamentCompactSummary({
				...BASE,
				averageStack: 0,
			})
		);
		expect(result.current.averageStackFormatted).toBe("0");
	});

	it("threads duration through from useElapsedTime", () => {
		const { result } = renderHook(() => useTournamentCompactSummary(BASE));
		expect(result.current.duration).toBe("1:30:00");
	});
});

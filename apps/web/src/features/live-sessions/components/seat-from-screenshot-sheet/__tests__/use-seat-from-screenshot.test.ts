import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const mocks = vi.hoisted(() => ({
	playerList: vi.fn(),
	extractMutateFn: vi.fn(),
	addExisting: vi.fn(),
	addNew: vi.fn(),
	updateHeroCash: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		player: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("player", "list", input),
					queryFn: () => mocks.playerList(input),
				}),
			},
		},
		aiExtract: {
			extractTablePlayers: {
				mutationOptions: () => ({
					mutationFn: (input: unknown) => mocks.extractMutateFn(input),
				}),
			},
		},
		sessionTablePlayer: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("sessionTablePlayer", "list", input),
				}),
			},
		},
		liveCashGameSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "getById", input),
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "getById", input),
				}),
			},
		},
	},
	trpcClient: {
		sessionTablePlayer: {
			add: { mutate: mocks.addExisting },
			addNew: { mutate: mocks.addNew },
		},
		liveCashGameSession: {
			updateHeroSeat: { mutate: mocks.updateHeroCash },
		},
		liveTournamentSession: {
			updateHeroSeat: { mutate: vi.fn() },
		},
	},
}));

vi.mock("sonner", () => ({
	toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

// FileReader is needed; jsdom provides it but fileToBase64 uses readAsDataURL
// which works in jsdom. We'll mostly test paths that don't hit real image work.

import { useSeatFromScreenshot } from "@/features/live-sessions/components/seat-from-screenshot-sheet/use-seat-from-screenshot";

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
			mutations: { retry: false },
		},
	});
}

function makeWrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

describe("useSeatFromScreenshot", () => {
	beforeEach(() => {
		for (const m of Object.values(mocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("initialises step='select-app', sourceApp defaults, and empty rows", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useSeatFromScreenshot({
					occupiedSeatPositions: new Set<number>(),
					onOpenChange: vi.fn(),
					open: false,
					sessionParam: { liveCashGameSessionId: "s1" },
				}),
			{ wrapper: makeWrapper(qc) }
		);
		expect(result.current.step).toBe("select-app");
		expect(result.current.rows).toEqual([]);
		expect(result.current.isApplying).toBe(false);
		expect(result.current.isExtracting).toBe(false);
	});

	it("onSourceAppSelect updates sourceApp and advances to step='upload'", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useSeatFromScreenshot({
					occupiedSeatPositions: new Set<number>(),
					onOpenChange: vi.fn(),
					open: true,
					sessionParam: { liveCashGameSessionId: "s1" },
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.onSourceAppSelect(result.current.sourceApp);
		});
		expect(result.current.step).toBe("upload");
	});

	it("onBackToSelectApp / onBackToUpload revert step", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useSeatFromScreenshot({
					occupiedSeatPositions: new Set<number>(),
					onOpenChange: vi.fn(),
					open: true,
					sessionParam: { liveCashGameSessionId: "s1" },
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.onSourceAppSelect(result.current.sourceApp);
		});
		expect(result.current.step).toBe("upload");
		act(() => {
			result.current.onBackToSelectApp();
		});
		expect(result.current.step).toBe("select-app");
		act(() => {
			result.current.onSourceAppSelect(result.current.sourceApp);
		});
		act(() => {
			result.current.onBackToUpload();
		});
		expect(result.current.step).toBe("upload");
	});

	it("resets all state whenever `open` transitions to true", () => {
		const qc = createClient();
		const { result, rerender } = renderHook(
			(p: { open: boolean }) =>
				useSeatFromScreenshot({
					occupiedSeatPositions: new Set<number>(),
					onOpenChange: vi.fn(),
					open: p.open,
					sessionParam: { liveCashGameSessionId: "s1" },
				}),
			{
				wrapper: makeWrapper(qc),
				initialProps: { open: true },
			}
		);
		act(() => {
			result.current.onSourceAppSelect(result.current.sourceApp);
		});
		expect(result.current.step).toBe("upload");
		rerender({ open: false });
		rerender({ open: true });
		expect(result.current.step).toBe("select-app");
		expect(result.current.rows).toEqual([]);
	});

	it("onApply with no actionable rows toasts 'Nothing to apply.'", async () => {
		const qc = createClient();
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useSeatFromScreenshot({
					occupiedSeatPositions: new Set<number>(),
					onOpenChange,
					open: true,
					sessionParam: { liveCashGameSessionId: "s1" },
				}),
			{ wrapper: makeWrapper(qc) }
		);
		await act(async () => {
			await result.current.onApply();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Nothing to apply.");
		expect(onOpenChange).not.toHaveBeenCalled();
	});
});

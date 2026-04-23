import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const trpcMocks = vi.hoisted(() => ({
	mutate: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		aiExtract: {
			extractTournamentData: {
				mutationOptions: (opts: unknown) => ({
					mutationKey: ["aiExtract", "extractTournamentData"],
					mutationFn: (vars: unknown) => trpcMocks.mutate(vars),
					...(opts as object),
				}),
			},
		},
	},
}));

import { useAiExtractInput } from "@/features/stores/components/ai-extract-input/use-ai-extract-input";

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function wrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

describe("useAiExtractInput", () => {
	beforeEach(() => {
		trpcMocks.mutate.mockReset();
	});

	it("starts with a single empty url item and canAdd=true", () => {
		const qc = createClient();
		const onExtracted = vi.fn();
		const { result } = renderHook(() => useAiExtractInput({ onExtracted }), {
			wrapper: wrapper(qc),
		});
		expect(result.current.items).toHaveLength(1);
		expect(result.current.items[0].kind).toBe("url");
		expect(result.current.canAdd).toBe(true);
		expect(result.current.isPending).toBe(false);
	});

	it("addUrl appends a new blank url item up to 5 entries", () => {
		const qc = createClient();
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(qc) }
		);
		act(() => {
			result.current.addUrl();
			result.current.addUrl();
			result.current.addUrl();
			result.current.addUrl();
		});
		expect(result.current.items).toHaveLength(5);
		expect(result.current.canAdd).toBe(false);
		act(() => {
			result.current.addUrl();
		});
		expect(result.current.items).toHaveLength(5);
	});

	it("updateUrl mutates the matching url item's value without touching others", () => {
		const qc = createClient();
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(qc) }
		);
		const firstId = result.current.items[0].id;
		act(() => {
			result.current.addUrl();
			result.current.updateUrl(firstId, "https://a.test");
		});
		expect(
			result.current.items.find((i) => i.id === firstId && i.kind === "url")
				?.kind
		).toBe("url");
		const firstItem = result.current.items.find((i) => i.id === firstId);
		expect(firstItem?.kind === "url" ? firstItem.value : null).toBe(
			"https://a.test"
		);
	});

	it("removeItem drops the matching id", () => {
		const qc = createClient();
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(qc) }
		);
		const id = result.current.items[0].id;
		act(() => {
			result.current.removeItem(id);
		});
		expect(result.current.items).toHaveLength(0);
	});

	it("handleAnalyze is a no-op when there are no non-empty sources", () => {
		const qc = createClient();
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(qc) }
		);
		act(() => {
			result.current.handleAnalyze();
		});
		expect(trpcMocks.mutate).not.toHaveBeenCalled();
	});

	it("handleAnalyze forwards trimmed url sources to the mutation", async () => {
		trpcMocks.mutate.mockResolvedValue(undefined);
		const qc = createClient();
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(qc) }
		);
		const id = result.current.items[0].id;
		act(() => {
			result.current.updateUrl(id, "  https://a.test  ");
		});
		await act(async () => {
			result.current.handleAnalyze();
			await Promise.resolve();
		});
		await waitFor(() =>
			expect(trpcMocks.mutate).toHaveBeenCalledWith({
				sources: [{ kind: "url", url: "https://a.test" }],
			})
		);
	});

	it("triggerFileInput clicks the ref element when present", () => {
		const qc = createClient();
		const { result } = renderHook(
			() => useAiExtractInput({ onExtracted: vi.fn() }),
			{ wrapper: wrapper(qc) }
		);
		const click = vi.fn();
		(
			result.current.fileInputRef as { current: HTMLInputElement | null }
		).current = { click } as unknown as HTMLInputElement;
		act(() => {
			result.current.triggerFileInput();
		});
		expect(click).toHaveBeenCalledTimes(1);
	});
});

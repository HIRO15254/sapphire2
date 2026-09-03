import type { QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createTestQueryClient,
	startPendingMutation,
	withQueryClient,
} from "@/__tests__/test-utils";

const mocks = vi.hoisted(() => ({
	onlineStatus: true,
}));

vi.mock("@/shared/hooks/use-online-status", () => ({
	useOnlineStatus: () => mocks.onlineStatus,
}));

import { useOnlineStatusBar } from "@/shared/components/authenticated-shell/online-status-bar/use-online-status-bar";

let queryClient: QueryClient;

function renderBar() {
	return renderHook(() => useOnlineStatusBar(), {
		wrapper: withQueryClient(queryClient),
	});
}

function startMutations(count: number) {
	const pending: ReturnType<typeof startPendingMutation>[] = [];
	act(() => {
		for (let index = 0; index < count; index += 1) {
			pending.push(startPendingMutation(queryClient));
		}
		vi.runOnlyPendingTimers();
	});
	return pending;
}

async function settleMutations(
	pending: ReturnType<typeof startPendingMutation>[]
) {
	await act(async () => {
		for (const mutation of pending) {
			mutation.settle();
		}
		for (let round = 0; round < 10; round += 1) {
			await Promise.resolve();
			vi.advanceTimersByTime(0);
		}
		await Promise.all(pending.map((mutation) => mutation.done));
		vi.advanceTimersByTime(0);
	});
	expect(queryClient.isMutating()).toBe(0);
}

describe("useOnlineStatusBar", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mocks.onlineStatus = true;
		queryClient = createTestQueryClient();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("starts hidden when initially online and never went offline", () => {
		const { result } = renderBar();
		expect(result.current.displayState).toBe("hidden");
	});

	it("transitions to 'offline' when offline", () => {
		mocks.onlineStatus = false;
		const { result } = renderBar();
		expect(result.current.displayState).toBe("offline");
	});

	it("shows 'syncing' when coming back online with active mutations", () => {
		mocks.onlineStatus = false;
		const { result, rerender } = renderBar();
		expect(result.current.displayState).toBe("offline");

		mocks.onlineStatus = true;
		startMutations(2);
		rerender();
		expect(result.current.displayState).toBe("syncing");
	});

	it("shows 'back-online' when coming back online with no mutations, then fades to hidden after 2s", () => {
		mocks.onlineStatus = false;
		const { result, rerender } = renderBar();
		expect(result.current.displayState).toBe("offline");

		mocks.onlineStatus = true;
		rerender();
		expect(result.current.displayState).toBe("back-online");

		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(result.current.displayState).toBe("hidden");
	});

	it("goes offline again, clears any pending fade", () => {
		mocks.onlineStatus = false;
		const { result, rerender } = renderBar();
		mocks.onlineStatus = true;
		rerender();
		expect(result.current.displayState).toBe("back-online");

		mocks.onlineStatus = false;
		rerender();
		expect(result.current.displayState).toBe("offline");

		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(result.current.displayState).toBe("offline");
	});

	it("stays 'hidden' when online and never went offline, even if a mutation is pending", () => {
		startMutations(3);
		const { result } = renderBar();
		expect(result.current.displayState).toBe("hidden");
	});

	it("mutation count dropping to 0 while syncing transitions to back-online and then hidden", async () => {
		mocks.onlineStatus = false;
		const { result, rerender } = renderBar();
		mocks.onlineStatus = true;
		const pending = startMutations(1);
		rerender();
		expect(result.current.displayState).toBe("syncing");

		await settleMutations(pending);
		rerender();
		expect(result.current.displayState).toBe("back-online");

		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(result.current.displayState).toBe("hidden");
	});
});

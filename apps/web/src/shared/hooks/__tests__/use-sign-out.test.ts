import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	signOut: vi.fn(),
	clearPersistedQueryCache: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signOut: mocks.signOut,
	},
}));

vi.mock("@/utils/trpc", () => ({
	clearPersistedQueryCache: mocks.clearPersistedQueryCache,
}));

import { useSignOut } from "@/shared/hooks/use-sign-out";

interface FetchOptions {
	onError: () => void;
	onSuccess: () => void;
}

function getFetchOptions(): FetchOptions {
	return mocks.signOut.mock.calls[0][0].fetchOptions as FetchOptions;
}

describe("useSignOut", () => {
	beforeEach(() => {
		mocks.navigate.mockReset();
		mocks.signOut.mockReset();
		mocks.clearPersistedQueryCache.mockReset();
	});

	it("onSignOut calls authClient.signOut exactly once", () => {
		const { result } = renderHook(() => useSignOut());
		result.current.onSignOut();
		expect(mocks.signOut).toHaveBeenCalledTimes(1);
	});

	it("does not clear the cache or navigate before sign-out resolves", () => {
		const { result } = renderHook(() => useSignOut());
		result.current.onSignOut();
		expect(mocks.clearPersistedQueryCache).not.toHaveBeenCalled();
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it("on success clears the persisted cache before navigating home", async () => {
		mocks.clearPersistedQueryCache.mockResolvedValue(undefined);
		const { result } = renderHook(() => useSignOut());
		result.current.onSignOut();

		await getFetchOptions().onSuccess();

		expect(mocks.clearPersistedQueryCache).toHaveBeenCalledTimes(1);
		expect(mocks.navigate).toHaveBeenCalledTimes(1);
		expect(mocks.navigate).toHaveBeenNthCalledWith(1, { to: "/" });
		expect(
			mocks.clearPersistedQueryCache.mock.invocationCallOrder[0]
		).toBeLessThan(mocks.navigate.mock.invocationCallOrder[0]);
	});

	it("does not navigate until the persisted cache clear resolves", async () => {
		let resolveClear: () => void = () => {
			// overwritten synchronously below
		};
		mocks.clearPersistedQueryCache.mockReturnValue(
			new Promise<void>((resolve) => {
				resolveClear = resolve;
			})
		);
		const { result } = renderHook(() => useSignOut());
		result.current.onSignOut();

		const pendingSuccess = getFetchOptions().onSuccess();
		await Promise.resolve();
		expect(mocks.navigate).not.toHaveBeenCalled();

		resolveClear();
		await pendingSuccess;

		expect(mocks.navigate).toHaveBeenCalledTimes(1);
	});

	it("still navigates home when the persisted cache clear rejects on success", async () => {
		mocks.clearPersistedQueryCache.mockRejectedValue(new Error("idb error"));
		const { result } = renderHook(() => useSignOut());
		result.current.onSignOut();

		await expect(getFetchOptions().onSuccess()).resolves.toBeUndefined();

		expect(mocks.navigate).toHaveBeenCalledTimes(1);
	});

	it("on error still clears the persisted cache and does not navigate", () => {
		mocks.clearPersistedQueryCache.mockResolvedValue(undefined);
		const { result } = renderHook(() => useSignOut());
		result.current.onSignOut();

		getFetchOptions().onError();

		expect(mocks.clearPersistedQueryCache).toHaveBeenCalledTimes(1);
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it("does not throw when the persisted cache clear rejects on error", async () => {
		mocks.clearPersistedQueryCache.mockRejectedValue(new Error("idb error"));
		const { result } = renderHook(() => useSignOut());
		result.current.onSignOut();

		expect(() => getFetchOptions().onError()).not.toThrow();
		await Promise.resolve();
		await Promise.resolve();

		expect(mocks.navigate).not.toHaveBeenCalled();
	});
});

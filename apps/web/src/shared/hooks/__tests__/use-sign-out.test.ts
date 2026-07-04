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

	it("on success clears the persisted cache before navigating home", () => {
		const { result } = renderHook(() => useSignOut());
		result.current.onSignOut();

		getFetchOptions().onSuccess();

		expect(mocks.clearPersistedQueryCache).toHaveBeenCalledTimes(1);
		expect(mocks.navigate).toHaveBeenCalledTimes(1);
		expect(mocks.navigate).toHaveBeenNthCalledWith(1, { to: "/" });
		expect(
			mocks.clearPersistedQueryCache.mock.invocationCallOrder[0]
		).toBeLessThan(mocks.navigate.mock.invocationCallOrder[0]);
	});

	it("on error still clears the persisted cache and does not navigate", () => {
		const { result } = renderHook(() => useSignOut());
		result.current.onSignOut();

		getFetchOptions().onError();

		expect(mocks.clearPersistedQueryCache).toHaveBeenCalledTimes(1);
		expect(mocks.navigate).not.toHaveBeenCalled();
	});
});

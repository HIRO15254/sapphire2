import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	healthCheck: {
		data: null as null | { ok: boolean },
		isLoading: false,
	},
	session: null as null | { user: { email: string; name: string } },
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => mocks.healthCheck,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => ({ data: mocks.session }),
	},
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		healthCheck: {
			queryOptions: () => ({ queryKey: ["health-check"] }),
		},
	},
}));

import { useHomePage } from "@/routes/-use-home-page";

describe("useHomePage", () => {
	beforeEach(() => {
		mocks.healthCheck.data = null;
		mocks.healthCheck.isLoading = false;
		mocks.session = null;
	});

	describe("isConnected", () => {
		it("is false when healthCheck.data is null", () => {
			mocks.healthCheck.data = null;
			const { result } = renderHook(() => useHomePage());
			expect(result.current.isConnected).toBe(false);
		});

		it("is true when healthCheck.data is a non-null object", () => {
			mocks.healthCheck.data = { ok: true };
			const { result } = renderHook(() => useHomePage());
			expect(result.current.isConnected).toBe(true);
		});

		it("is false while the health check is loading", () => {
			mocks.healthCheck.isLoading = true;
			mocks.healthCheck.data = null;
			const { result } = renderHook(() => useHomePage());
			expect(result.current.isConnected).toBe(false);
			expect(result.current.isLoading).toBe(true);
		});
	});

	describe("isSignedIn", () => {
		it("is false when session is null", () => {
			mocks.session = null;
			const { result } = renderHook(() => useHomePage());
			expect(result.current.isSignedIn).toBe(false);
		});

		it("is true when session is present", () => {
			mocks.session = { user: { email: "a@b.c", name: "Alice" } };
			const { result } = renderHook(() => useHomePage());
			expect(result.current.isSignedIn).toBe(true);
		});
	});

	describe("userName", () => {
		it("is null when the session has no user", () => {
			mocks.session = null;
			const { result } = renderHook(() => useHomePage());
			expect(result.current.userName).toBeNull();
		});

		it("returns the user name when signed in", () => {
			mocks.session = { user: { email: "hiro@b.c", name: "Hiro" } };
			const { result } = renderHook(() => useHomePage());
			expect(result.current.userName).toBe("Hiro");
		});
	});

	describe("isLoading", () => {
		it("mirrors healthCheck.isLoading", () => {
			mocks.healthCheck.isLoading = true;
			const r1 = renderHook(() => useHomePage());
			expect(r1.result.current.isLoading).toBe(true);

			mocks.healthCheck.isLoading = false;
			const r2 = renderHook(() => useHomePage());
			expect(r2.result.current.isLoading).toBe(false);
		});
	});

	describe("combined state", () => {
		it("reports connected + signed in with user name", () => {
			mocks.healthCheck.data = { ok: true };
			mocks.session = { user: { email: "h@s.c", name: "Hiro" } };
			const { result } = renderHook(() => useHomePage());
			expect(result.current).toEqual({
				isConnected: true,
				isSignedIn: true,
				isLoading: false,
				userName: "Hiro",
			});
		});
	});
});

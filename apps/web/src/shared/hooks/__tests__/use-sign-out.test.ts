import type { QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { toast } from "sonner";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

const SERVER_URL = "http://localhost:8787";
const SIGN_OUT_URL = `${SERVER_URL}/api/auth/sign-out`;
const PERSISTED_CLIENT_KEY = "sapphire2-query-cache";

const mocks = vi.hoisted(() => ({
	failDelete: false,
	navigate: vi.fn(),
	store: new Map<string, unknown>(),
}));

vi.mock("@sapphire2/env/web", () => ({
	env: { VITE_SERVER_URL: "http://localhost:8787" },
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

vi.mock("idb-keyval", () => ({
	del: (key: string) => {
		if (mocks.failDelete) {
			return Promise.reject(new Error("IndexedDB unavailable"));
		}
		mocks.store.delete(key);
		return Promise.resolve();
	},
	get: (key: string) => Promise.resolve(mocks.store.get(key)),
	set: (key: string, value: unknown) => {
		mocks.store.set(key, value);
		return Promise.resolve();
	},
}));

const server = setupServer();
let useSignOut: typeof import("@/shared/hooks/use-sign-out").useSignOut;
let queryClient: QueryClient;

function signedInAs(data: string) {
	queryClient.setQueryData(["account"], data);
	mocks.store.set(PERSISTED_CLIENT_KEY, JSON.stringify({ data }));
}

describe("useSignOut", () => {
	beforeAll(async () => {
		server.listen({ onUnhandledFrame: "error" });
		({ useSignOut } = await import("@/shared/hooks/use-sign-out"));
		({ queryClient } = await import("@/utils/trpc"));
	});

	beforeEach(() => {
		mocks.failDelete = false;
		mocks.navigate.mockReset();
		vi.spyOn(toast, "error");
	});

	afterEach(() => {
		vi.restoreAllMocks();
		server.resetHandlers();
		queryClient.clear();
		mocks.store.clear();
	});

	afterAll(() => {
		server.close();
	});

	it("wipes the signed-out user's cache before leaving for home", async () => {
		const { promise: released, resolve: release } =
			Promise.withResolvers<void>();
		server.use(
			http.post(SIGN_OUT_URL, async () => {
				await released;
				return HttpResponse.json({ success: true });
			})
		);
		signedInAs("A-PRIVATE");
		let cacheAtNavigation: unknown[] = [];
		mocks.navigate.mockImplementation(() => {
			cacheAtNavigation = [
				queryClient.getQueryData(["account"]),
				mocks.store.get(PERSISTED_CLIENT_KEY),
			];
		});
		const { result } = renderHook(() => useSignOut());

		let signingOut: Promise<void> = Promise.resolve();
		act(() => {
			signingOut = result.current.onSignOut();
		});
		expect(result.current.isSignOutPending).toBe(true);
		expect(queryClient.getQueryData(["account"])).toBe("A-PRIVATE");

		release();
		await act(() => signingOut);

		expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith({ to: "/" });
		expect(cacheAtNavigation).toEqual([undefined, undefined]);
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("still leaves for home when the persisted store cannot be deleted", async () => {
		server.use(
			http.post(SIGN_OUT_URL, () => HttpResponse.json({ success: true }))
		);
		signedInAs("A-PRIVATE");
		mocks.failDelete = true;
		const { result } = renderHook(() => useSignOut());

		await act(() => result.current.onSignOut());

		expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith({ to: "/" });
		expect(queryClient.getQueryData(["account"])).toBeUndefined();
	});

	it("wipes the cache and reports the failure when the server rejects the sign-out", async () => {
		server.use(
			http.post(SIGN_OUT_URL, () =>
				HttpResponse.json({ message: "Server error" }, { status: 500 })
			)
		);
		signedInAs("A-PRIVATE");
		const { result } = renderHook(() => useSignOut());

		await act(() => result.current.onSignOut());

		expect(queryClient.getQueryData(["account"])).toBeUndefined();
		expect(mocks.store.has(PERSISTED_CLIENT_KEY)).toBe(false);
		expect(mocks.navigate).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledOnce();
		expect(result.current.isSignOutPending).toBe(false);
	});

	it("keeps the session's cache and reports the failure when the request never reaches the server", async () => {
		server.use(http.post(SIGN_OUT_URL, () => HttpResponse.error()));
		signedInAs("A-PRIVATE");
		const { result } = renderHook(() => useSignOut());

		await act(() => result.current.onSignOut());

		expect(queryClient.getQueryData(["account"])).toBe("A-PRIVATE");
		expect(mocks.navigate).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledOnce();
		expect(result.current.isSignOutPending).toBe(false);
	});
});

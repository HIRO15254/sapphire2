import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	redirect: vi.fn((input: unknown) => {
		const err = new Error("redirect");
		(err as Error & { redirectTo?: unknown }).redirectTo = input;
		return err;
	}),
}));

vi.mock("@tanstack/react-router", () => ({
	HeadContent: () => null,
	Outlet: () => null,
	createFileRoute:
		() => (options: { beforeLoad?: unknown; component: unknown }) => ({
			options,
		}),
	createRootRouteWithContext: () => (options: unknown) => options,
	redirect: mocks.redirect,
	useLocation: () => ({ pathname: "/" }),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		getSession: mocks.getSession,
	},
}));

vi.mock("@/shared/hooks/use-pwa-update", () => ({
	usePwaUpdate: vi.fn(),
}));
// __root.tsx value imports — stubbed so the test does not load the full shell.
vi.mock("@/shared/components/authenticated-shell", () => ({
	AuthenticatedShell: () => null,
}));
vi.mock("@/shared/components/theme-provider", () => ({
	ThemeProvider: () => null,
}));
vi.mock("@/shared/components/ui/sonner", () => ({
	Toaster: () => null,
}));

interface SessionResult {
	data: { user: { id: string } } | null;
}

type RootBeforeLoad = (ctx: {
	location: { pathname: string };
}) => Promise<{ session: SessionResult | null } | undefined>;

type IndexBeforeLoad = (ctx: {
	context: { session: SessionResult | null };
}) => unknown;

let rootBeforeLoad: RootBeforeLoad;
let indexBeforeLoad: IndexBeforeLoad;

/**
 * Simulates a single "/" navigation the way TanStack Router runs it: the root
 * guard's beforeLoad first (its return value merges into router context), then
 * the index route's beforeLoad with that merged context. Returns the thrown
 * redirect error.
 */
async function navigateToHome(): Promise<Error & { redirectTo?: unknown }> {
	let contextPatch: { session: SessionResult | null } | undefined;
	try {
		contextPatch = await rootBeforeLoad({ location: { pathname: "/" } });
	} catch (err) {
		// Root guard redirected (signed-out) — the index route never runs.
		return err as Error & { redirectTo?: unknown };
	}
	try {
		await indexBeforeLoad({
			context: { session: contextPatch?.session ?? null },
		});
	} catch (err) {
		return err as Error & { redirectTo?: unknown };
	}
	throw new Error("expected the root-path dispatch to redirect");
}

describe("HomeRoute dispatch", () => {
	beforeAll(async () => {
		const rootModule = await import("@/routes/__root");
		const indexModule = await import("@/routes/index");
		rootBeforeLoad = (
			rootModule.Route as unknown as { beforeLoad: RootBeforeLoad }
		).beforeLoad;
		indexBeforeLoad = (
			indexModule.Route as unknown as {
				options: { beforeLoad: IndexBeforeLoad };
			}
		).options.beforeLoad;
	});

	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.redirect.mockClear();
	});

	it("redirects a signed-in user hitting / to /statistics", async () => {
		mocks.getSession.mockResolvedValue({ data: { user: { id: "u1" } } });

		const err = await navigateToHome();

		expect(err.redirectTo).toEqual({ to: "/statistics" });
		expect(mocks.redirect).toHaveBeenCalledTimes(1);
		expect(mocks.redirect).toHaveBeenNthCalledWith(1, { to: "/statistics" });
	});

	it("sends a signed-out user hitting / to /login through the root guard", async () => {
		mocks.getSession.mockResolvedValue({ data: null });

		const err = await navigateToHome();

		expect(err.redirectTo).toEqual({ to: "/login" });
		expect(mocks.redirect).toHaveBeenCalledTimes(1);
		expect(mocks.redirect).toHaveBeenNthCalledWith(1, { to: "/login" });
	});

	it("fetches the session exactly once per / navigation when signed in", async () => {
		mocks.getSession.mockResolvedValue({ data: { user: { id: "u1" } } });

		await navigateToHome();

		expect(mocks.getSession).toHaveBeenCalledTimes(1);
	});

	it("fetches the session exactly once per / navigation when signed out", async () => {
		mocks.getSession.mockResolvedValue({ data: null });

		await navigateToHome();

		expect(mocks.getSession).toHaveBeenCalledTimes(1);
	});

	describe("index beforeLoad branch coverage (reads context, never re-fetches)", () => {
		it("dispatches to /statistics when context carries a session with data", async () => {
			await expect(async () =>
				indexBeforeLoad({
					context: { session: { data: { user: { id: "u1" } } } },
				})
			).rejects.toThrow("redirect");

			expect(mocks.redirect).toHaveBeenCalledTimes(1);
			expect(mocks.redirect).toHaveBeenNthCalledWith(1, { to: "/statistics" });
			expect(mocks.getSession).not.toHaveBeenCalled();
		});

		it("dispatches to /login when context carries no session", async () => {
			await expect(async () =>
				indexBeforeLoad({ context: { session: null } })
			).rejects.toThrow("redirect");

			expect(mocks.redirect).toHaveBeenCalledTimes(1);
			expect(mocks.redirect).toHaveBeenNthCalledWith(1, { to: "/login" });
			expect(mocks.getSession).not.toHaveBeenCalled();
		});

		it("dispatches to /login when the context session has null data", async () => {
			await expect(async () =>
				indexBeforeLoad({ context: { session: { data: null } } })
			).rejects.toThrow("redirect");

			expect(mocks.redirect).toHaveBeenCalledTimes(1);
			expect(mocks.redirect).toHaveBeenNthCalledWith(1, { to: "/login" });
			expect(mocks.getSession).not.toHaveBeenCalled();
		});
	});

	describe("root guard context contract", () => {
		it("returns the fetched session into router context for guarded paths", async () => {
			const session = { data: { user: { id: "u1" } } };
			mocks.getSession.mockResolvedValue(session);

			await expect(
				rootBeforeLoad({ location: { pathname: "/" } })
			).resolves.toEqual({ session, sessionUnavailable: false });
			expect(mocks.getSession).toHaveBeenCalledTimes(1);
		});

		it("returns a null session for /login without fetching", async () => {
			await expect(
				rootBeforeLoad({ location: { pathname: "/login" } })
			).resolves.toEqual({ session: null, sessionUnavailable: false });
			expect(mocks.getSession).not.toHaveBeenCalled();
		});
	});
});

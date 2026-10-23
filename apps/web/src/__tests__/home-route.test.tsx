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
let indexBeforeLoad: IndexBeforeLoad | undefined;

async function navigateToHome(): Promise<
	(Error & { redirectTo?: unknown }) | null
> {
	try {
		const contextPatch = await rootBeforeLoad({
			location: { pathname: "/" },
		});
		await indexBeforeLoad?.({
			context: { session: contextPatch?.session ?? null },
		});
	} catch (err) {
		return err as Error & { redirectTo?: unknown };
	}
	return null;
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
				options: { beforeLoad?: IndexBeforeLoad };
			}
		).options.beforeLoad;
	});

	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.redirect.mockClear();
	});

	it("keeps a signed-in user on the home page at /", async () => {
		mocks.getSession.mockResolvedValue({ data: { user: { id: "u1" } } });

		const err = await navigateToHome();

		expect(err).toBeNull();
		expect(mocks.redirect).not.toHaveBeenCalled();
	});

	it("sends a signed-out user hitting / to /login through the root guard", async () => {
		mocks.getSession.mockResolvedValue({ data: null });

		const err = await navigateToHome();

		expect(err?.redirectTo).toEqual({ to: "/login" });
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

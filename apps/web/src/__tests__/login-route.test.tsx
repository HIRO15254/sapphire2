import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	redirect: vi.fn((input: unknown) => {
		const err = new Error("redirect");
		(err as Error & { redirectTo?: unknown }).redirectTo = input;
		return err;
	}),
	env: { VITE_SERVER_URL: "http://localhost:8787" },
}));

vi.mock("@sapphire2/env/web", () => ({
	env: new Proxy(mocks.env, {
		get: (target, prop) => target[prop as keyof typeof target],
	}),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute:
		() => (options: { beforeLoad?: unknown; component: ComponentType }) => ({
			options,
		}),
	redirect: mocks.redirect,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		getSession: mocks.getSession,
	},
}));

vi.mock("@/features/auth/pages/login-page/preview-auto-login", () => ({
	PreviewAutoLogin: () => <div>Preview Auto Login</div>,
}));

vi.mock("@/features/auth/pages/login-page/sign-in-form", () => ({
	default: ({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) => (
		<div>
			<p>Sign In Form</p>
			<button onClick={onSwitchToSignUp} type="button">
				Switch To Sign Up
			</button>
		</div>
	),
}));

vi.mock("@/features/auth/pages/login-page/sign-up-form", () => ({
	default: ({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) => (
		<div>
			<p>Sign Up Form</p>
			<button onClick={onSwitchToSignIn} type="button">
				Switch To Sign In
			</button>
		</div>
	),
}));

let routeModule: typeof import("@/routes/login");

describe("LoginRoute", () => {
	beforeAll(async () => {
		routeModule = await import("@/routes/login");
	});

	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.redirect.mockClear();
	});

	it("renders preview auto login and defaults to sign up", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByText("Preview Auto Login")).toBeInTheDocument();
		expect(screen.getByText("Sign Up Form")).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Create your account." })
		).toBeInTheDocument();
	});

	it("switches between sign up and sign in", async () => {
		const Component = routeModule.Route.options.component as ComponentType;
		const user = userEvent.setup();

		render(<Component />);

		await user.click(screen.getByRole("button", { name: "Switch To Sign In" }));
		expect(screen.getByText("Sign In Form")).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Welcome back." })
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Switch To Sign Up" }));
		expect(screen.getByText("Sign Up Form")).toBeInTheDocument();
	});

	describe("beforeLoad guard", () => {
		interface BeforeLoadCtx {
			location: { search: Record<string, unknown> };
		}
		const ctx = (search: Record<string, unknown> = {}): BeforeLoadCtx => ({
			location: { search },
		});

		it("redirects to /statistics when a session already exists", async () => {
			mocks.getSession.mockResolvedValue({ data: { user: { id: "u1" } } });
			const beforeLoad = routeModule.Route.options.beforeLoad as (
				context: BeforeLoadCtx
			) => Promise<unknown>;

			await expect(beforeLoad(ctx())).rejects.toThrow("redirect");
			expect(mocks.redirect).toHaveBeenCalledWith({ to: "/statistics" });
		});

		it("resumes a pending MCP OAuth authorize flow instead of entering the app", async () => {
			mocks.getSession.mockResolvedValue({ data: { user: { id: "u1" } } });
			const beforeLoad = routeModule.Route.options.beforeLoad as (
				context: BeforeLoadCtx
			) => Promise<unknown>;

			await expect(
				beforeLoad(
					ctx({
						client_id: "c1",
						response_type: "code",
						state: "s1",
					})
				)
			).rejects.toThrow("redirect");
			expect(mocks.redirect).toHaveBeenCalledTimes(1);
			const arg = mocks.redirect.mock.calls[0]?.[0] as { href: string };
			expect(
				arg.href.startsWith("http://localhost:8787/api/auth/mcp/authorize?")
			).toBe(true);
			expect(arg.href).toContain("client_id=c1");
		});

		it("ignores a non-OAuth query and enters the app normally", async () => {
			mocks.getSession.mockResolvedValue({ data: { user: { id: "u1" } } });
			const beforeLoad = routeModule.Route.options.beforeLoad as (
				context: BeforeLoadCtx
			) => Promise<unknown>;

			await expect(beforeLoad(ctx({ foo: "bar" }))).rejects.toThrow("redirect");
			expect(mocks.redirect).toHaveBeenCalledWith({ to: "/statistics" });
		});

		it("does not redirect when there is no session", async () => {
			mocks.getSession.mockResolvedValue({ data: null });
			const beforeLoad = routeModule.Route.options.beforeLoad as (
				context: BeforeLoadCtx
			) => Promise<unknown>;

			await expect(
				beforeLoad(ctx({ client_id: "c1", response_type: "code" }))
			).resolves.toBeUndefined();
			expect(mocks.redirect).not.toHaveBeenCalled();
		});
	});
});

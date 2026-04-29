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

vi.mock("@/shared/components/preview-auto-login", () => ({
	PreviewAutoLogin: () => <div>Preview Auto Login</div>,
}));

vi.mock("@/shared/components/sign-in-form", () => ({
	default: ({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) => (
		<div>
			<p>Sign In Form</p>
			<button onClick={onSwitchToSignUp} type="button">
				Switch To Sign Up
			</button>
		</div>
	),
}));

vi.mock("@/shared/components/sign-up-form", () => ({
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
		it("redirects to /dashboard when a session already exists", async () => {
			mocks.getSession.mockResolvedValue({ data: { user: { id: "u1" } } });
			const beforeLoad = routeModule.Route.options
				.beforeLoad as () => Promise<unknown>;

			await expect(beforeLoad()).rejects.toThrow("redirect");
			expect(mocks.redirect).toHaveBeenCalledWith({ to: "/dashboard" });
		});

		it("does not redirect when there is no session", async () => {
			mocks.getSession.mockResolvedValue({ data: null });
			const beforeLoad = routeModule.Route.options
				.beforeLoad as () => Promise<unknown>;

			await expect(beforeLoad()).resolves.toBeUndefined();
			expect(mocks.redirect).not.toHaveBeenCalled();
		});
	});
});

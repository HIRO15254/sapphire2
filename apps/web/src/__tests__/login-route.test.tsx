import { render, screen } from "@testing-library/react";
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

vi.mock("@/features/auth/components/login-screen", () => ({
	LoginScreen: () => <div>Login Screen</div>,
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

	it("mounts the preview auto-login helper and the login screen", () => {
		const Component = routeModule.Route.options.component as ComponentType;
		render(<Component />);
		expect(screen.getByText("Preview Auto Login")).toBeInTheDocument();
		expect(screen.getByText("Login Screen")).toBeInTheDocument();
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

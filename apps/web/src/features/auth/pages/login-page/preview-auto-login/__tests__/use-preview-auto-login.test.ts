import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	env: {
		VITE_PREVIEW_AUTO_LOGIN: undefined as string | undefined,
		VITE_PREVIEW_LOGIN_EMAIL: undefined as string | undefined,
		VITE_PREVIEW_LOGIN_PASSWORD: undefined as string | undefined,
		VITE_SERVER_URL: "http://localhost:8787",
	},
	signInEmail: vi.fn(),
	navigate: vi.fn(),
}));

function stubLocation(overrides: Partial<Location>): () => void {
	const originalLocation = window.location;
	Object.defineProperty(window, "location", {
		configurable: true,
		value: { ...originalLocation, assign: vi.fn(), ...overrides },
	});
	return () => {
		Object.defineProperty(window, "location", {
			configurable: true,
			value: originalLocation,
		});
	};
}

const OAUTH_SEARCH =
	"?client_id=c1&response_type=code&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&state=s1";

vi.mock("@sapphire2/env/web", () => ({
	env: new Proxy(mocks.env, {
		get: (target, prop) => target[prop as keyof typeof target],
	}),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: { signIn: { email: mocks.signInEmail } },
}));

import { usePreviewAutoLogin } from "@/features/auth/pages/login-page/preview-auto-login/use-preview-auto-login";

describe("usePreviewAutoLogin", () => {
	beforeEach(() => {
		mocks.signInEmail.mockReset();
		mocks.navigate.mockReset();
		vi.spyOn(console, "error").mockReset();
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = undefined;
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = undefined;
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = undefined;
	});

	it("reports a rejected sign-in promise without leaking an unhandled rejection", async () => {
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "true";
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "preview-pass";
		const error = new Error("network unavailable");
		mocks.signInEmail.mockRejectedValue(error);

		renderHook(() => usePreviewAutoLogin());
		await waitFor(() => expect(mocks.signInEmail).toHaveBeenCalledTimes(1));
		await waitFor(() =>
			expect(console.error).toHaveBeenCalledWith(
				"Preview auto-login failed",
				error
			)
		);
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it("does nothing when VITE_PREVIEW_AUTO_LOGIN is not 'true'", () => {
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = undefined;
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "password";
		renderHook(() => usePreviewAutoLogin());
		expect(mocks.signInEmail).not.toHaveBeenCalled();
	});

	it("does nothing when VITE_PREVIEW_AUTO_LOGIN is the literal 'false'", () => {
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "false";
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "password";
		renderHook(() => usePreviewAutoLogin());
		expect(mocks.signInEmail).not.toHaveBeenCalled();
	});

	it("does nothing when email is missing", () => {
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "true";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "password";
		renderHook(() => usePreviewAutoLogin());
		expect(mocks.signInEmail).not.toHaveBeenCalled();
	});

	it("does nothing when password is missing", () => {
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "true";
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		renderHook(() => usePreviewAutoLogin());
		expect(mocks.signInEmail).not.toHaveBeenCalled();
	});

	it("calls signIn.email with preview credentials when flag is 'true' and both creds present", () => {
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "true";
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "preview-pass";
		mocks.signInEmail.mockResolvedValue({ data: null });
		renderHook(() => usePreviewAutoLogin());
		expect(mocks.signInEmail).toHaveBeenCalledWith({
			email: "preview@example.com",
			password: "preview-pass",
		});
	});

	it("navigates to /statistics when signIn returns data", async () => {
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "true";
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "preview-pass";
		mocks.signInEmail.mockResolvedValue({ data: { user: { id: "u1" } } });
		renderHook(() => usePreviewAutoLogin());
		await waitFor(() =>
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/statistics" })
		);
	});

	it("mid-OAuth: resumes the authorize flow instead of entering the app", async () => {
		const restore = stubLocation({ search: OAUTH_SEARCH });
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "true";
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "preview-pass";
		mocks.signInEmail.mockResolvedValue({ data: { user: { id: "u1" } } });
		renderHook(() => usePreviewAutoLogin());
		await waitFor(() =>
			expect(window.location.assign).toHaveBeenCalledTimes(1)
		);
		const target = (window.location.assign as ReturnType<typeof vi.fn>).mock
			.calls[0]?.[0] as string;
		expect(
			target.startsWith("http://localhost:8787/api/auth/mcp/authorize?")
		).toBe(true);
		expect(target).toContain("client_id=c1");
		expect(mocks.navigate).not.toHaveBeenCalled();
		restore();
	});

	it("mid-OAuth: does not resume the authorize flow when auto-login fails", async () => {
		const restore = stubLocation({ search: OAUTH_SEARCH });
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "true";
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "preview-pass";
		mocks.signInEmail.mockResolvedValue({ data: null });
		renderHook(() => usePreviewAutoLogin());
		await waitFor(() => expect(mocks.signInEmail).toHaveBeenCalled());
		expect(window.location.assign).not.toHaveBeenCalled();
		expect(mocks.navigate).not.toHaveBeenCalled();
		restore();
	});

	it("does NOT navigate when signIn returns no data (failed auto-login)", async () => {
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "true";
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "preview-pass";
		mocks.signInEmail.mockResolvedValue({ data: null });
		renderHook(() => usePreviewAutoLogin());
		await waitFor(() => expect(mocks.signInEmail).toHaveBeenCalled());
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it("attempts only once per mount (re-render does not re-trigger)", async () => {
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "true";
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "preview-pass";
		mocks.signInEmail.mockResolvedValue({ data: { user: { id: "u1" } } });
		const { rerender } = renderHook(() => usePreviewAutoLogin());
		await waitFor(() => expect(mocks.signInEmail).toHaveBeenCalledTimes(1));
		rerender();
		await Promise.resolve();
		expect(mocks.signInEmail).toHaveBeenCalledTimes(1);
	});
});

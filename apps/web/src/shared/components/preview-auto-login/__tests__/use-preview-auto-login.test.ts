import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	env: {
		VITE_PREVIEW_AUTO_LOGIN: undefined as string | undefined,
		VITE_PREVIEW_LOGIN_EMAIL: undefined as string | undefined,
		VITE_PREVIEW_LOGIN_PASSWORD: undefined as string | undefined,
	},
	signInEmail: vi.fn(),
	navigate: vi.fn(),
}));

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

import { usePreviewAutoLogin } from "@/shared/components/preview-auto-login/use-preview-auto-login";

describe("usePreviewAutoLogin", () => {
	beforeEach(() => {
		mocks.signInEmail.mockReset();
		mocks.navigate.mockReset();
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = undefined;
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = undefined;
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = undefined;
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

	it("navigates to /dashboard when signIn returns data", async () => {
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "true";
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "preview-pass";
		mocks.signInEmail.mockResolvedValue({ data: { user: { id: "u1" } } });
		renderHook(() => usePreviewAutoLogin());
		await waitFor(() =>
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" })
		);
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

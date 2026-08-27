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

import {
	locationAssignCalls,
	OAUTH_AUTHORIZE_SEARCH,
	stubLocation,
} from "@/__tests__/test-utils";
import { usePreviewAutoLogin } from "@/features/auth/pages/login-page/preview-auto-login/use-preview-auto-login";

describe("usePreviewAutoLogin", () => {
	beforeEach(() => {
		mocks.signInEmail.mockReset();
		mocks.navigate.mockReset();
		vi.spyOn(console, "error").mockReset();
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = undefined;
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = undefined;
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = undefined;
		sessionStorage.clear();
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
		stubLocation({ search: OAUTH_AUTHORIZE_SEARCH });
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "true";
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "preview-pass";
		mocks.signInEmail.mockResolvedValue({ data: { user: { id: "u1" } } });
		renderHook(() => usePreviewAutoLogin());
		await waitFor(() =>
			expect(window.location.assign).toHaveBeenCalledTimes(1)
		);
		const url = new URL(locationAssignCalls()[0]?.[0] as string);
		expect(url.origin).toBe("http://localhost:8787");
		expect(url.pathname).toBe("/api/auth/mcp/authorize");
		expect(url.searchParams.get("client_id")).toBe("c1");
		expect(url.searchParams.get("response_type")).toBe("code");
		expect(url.searchParams.get("redirect_uri")).toBe("https://claude.ai/cb");
		expect(url.searchParams.get("state")).toBe("s1");
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it("mid-OAuth: resumes only once per authorize request, so a bouncing authorize cannot be re-assigned forever", async () => {
		stubLocation({ search: OAUTH_AUTHORIZE_SEARCH });
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "true";
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "preview-pass";
		mocks.signInEmail.mockResolvedValue({ data: { user: { id: "u1" } } });

		const first = renderHook(() => usePreviewAutoLogin());
		await waitFor(() => expect(locationAssignCalls()).toHaveLength(1));
		first.unmount();

		renderHook(() => usePreviewAutoLogin());
		await waitFor(() =>
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/statistics" })
		);
		expect(locationAssignCalls()).toHaveLength(1);
	});

	it("mid-OAuth: resumes again when the authorize request is a different one", async () => {
		stubLocation({ search: OAUTH_AUTHORIZE_SEARCH });
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "true";
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "preview-pass";
		mocks.signInEmail.mockResolvedValue({ data: { user: { id: "u1" } } });

		const first = renderHook(() => usePreviewAutoLogin());
		await waitFor(() => expect(locationAssignCalls()).toHaveLength(1));
		first.unmount();

		stubLocation({
			search: OAUTH_AUTHORIZE_SEARCH.replace("client_id=c1", "client_id=c2"),
		});
		renderHook(() => usePreviewAutoLogin());
		await waitFor(() => expect(locationAssignCalls()).toHaveLength(1));
		expect(
			new URL(locationAssignCalls()[0]?.[0] as string).searchParams.get(
				"client_id"
			)
		).toBe("c2");
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it("mid-OAuth: does not resume the authorize flow when auto-login fails", async () => {
		stubLocation({ search: OAUTH_AUTHORIZE_SEARCH });
		mocks.env.VITE_PREVIEW_AUTO_LOGIN = "true";
		mocks.env.VITE_PREVIEW_LOGIN_EMAIL = "preview@example.com";
		mocks.env.VITE_PREVIEW_LOGIN_PASSWORD = "preview-pass";
		mocks.signInEmail.mockResolvedValue({ data: null });
		renderHook(() => usePreviewAutoLogin());
		await waitFor(() => expect(mocks.signInEmail).toHaveBeenCalled());
		expect(window.location.assign).not.toHaveBeenCalled();
		expect(mocks.navigate).not.toHaveBeenCalled();
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

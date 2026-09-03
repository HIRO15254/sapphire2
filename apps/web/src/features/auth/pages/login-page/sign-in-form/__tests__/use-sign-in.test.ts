import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubWebAuthnSupport } from "@/__tests__/test-utils";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	useSession: vi.fn(() => ({ isPending: false })),
	signInEmail: vi.fn(),
	signInSocial: vi.fn(),
	signInPasskey: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
	offerAutomaticPasskey: vi.fn(),
	env: { VITE_SERVER_URL: "http://localhost:8787" },
}));

vi.mock("@/features/auth/utils/auto-register-passkey", () => ({
	offerAutomaticPasskey: mocks.offerAutomaticPasskey,
}));

vi.mock("@sapphire2/env/web", () => ({
	env: new Proxy(mocks.env, {
		get: (target, prop) => target[prop as keyof typeof target],
	}),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

vi.mock("sonner", () => ({
	toast: {
		success: mocks.toastSuccess,
		error: mocks.toastError,
	},
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: mocks.useSession,
		signIn: {
			email: mocks.signInEmail,
			social: mocks.signInSocial,
			passkey: mocks.signInPasskey,
		},
	},
}));

import {
	locationAssignCalls,
	OAUTH_AUTHORIZE_SEARCH,
	stubLocation,
} from "@/__tests__/test-utils";
import { useSignIn } from "@/features/auth/pages/login-page/sign-in-form/use-sign-in";

describe("useSignIn", () => {
	beforeEach(() => {
		mocks.navigate.mockReset();
		mocks.useSession.mockReturnValue({ isPending: false });
		mocks.signInEmail.mockReset();
		mocks.signInSocial.mockReset();
		mocks.signInPasskey.mockReset();
		mocks.toastSuccess.mockReset();
		mocks.toastError.mockReset();
		mocks.offerAutomaticPasskey.mockReset();
	});

	async function submitValidCredentials(
		result: { current: ReturnType<typeof useSignIn> },
		mockSignIn = mocks.signInEmail
	) {
		mockSignIn.mockImplementation((_credentials, callbacks) => {
			callbacks?.onSuccess?.();
			return Promise.resolve();
		});
		act(() => {
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
	}

	it("exposes isPending from the session hook", () => {
		mocks.useSession.mockReturnValue({ isPending: true });
		const { result } = renderHook(() => useSignIn());
		expect(result.current.isPending).toBe(true);
	});

	it("starts with empty email and password", () => {
		const { result } = renderHook(() => useSignIn());
		expect(result.current.form.state.values).toEqual({
			email: "",
			password: "",
		});
	});

	it("rejects invalid email and short password on submit", async () => {
		const { result } = renderHook(() => useSignIn());
		act(() => {
			result.current.form.setFieldValue("email", "not-an-email");
			result.current.form.setFieldValue("password", "short");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.signInEmail).not.toHaveBeenCalled();
		expect(result.current.form.state.isSubmitSuccessful).toBe(false);
	});

	it("calls authClient.signIn.email with the form values on submit", async () => {
		mocks.signInEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onSuccess?.();
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignIn());
		act(() => {
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.signInEmail).toHaveBeenCalledWith(
			{ email: "user@example.com", password: "password123" },
			expect.objectContaining({
				onSuccess: expect.any(Function),
				onError: expect.any(Function),
			})
		);
	});

	it("on success: navigates to /statistics and toasts success", async () => {
		mocks.signInEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onSuccess?.();
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignIn());
		act(() => {
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/statistics" });
		expect(mocks.toastSuccess).toHaveBeenCalledWith("Sign in successful");
	});

	it("on success mid-OAuth: resumes the authorize flow instead of entering the app", async () => {
		stubLocation({ search: OAUTH_AUTHORIZE_SEARCH });
		mocks.signInEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onSuccess?.();
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignIn());
		act(() => {
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(window.location.assign).toHaveBeenCalledTimes(1);
		const url = new URL(locationAssignCalls()[0]?.[0] as string);
		expect(url.origin).toBe("http://localhost:8787");
		expect(url.pathname).toBe("/api/auth/mcp/authorize");
		expect(url.searchParams.get("client_id")).toBe("c1");
		expect(url.searchParams.get("response_type")).toBe("code");
		expect(url.searchParams.get("redirect_uri")).toBe("https://claude.ai/cb");
		expect(url.searchParams.get("state")).toBe("s1");
		expect(mocks.navigate).not.toHaveBeenCalled();
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
	});

	it("on error with message: toasts the error message", async () => {
		mocks.signInEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onError?.({
				error: { message: "Invalid credentials", statusText: "Unauthorized" },
			});
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignIn());
		act(() => {
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Invalid credentials");
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it("on error without message: falls back to statusText", async () => {
		mocks.signInEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onError?.({
				error: { message: "", statusText: "Unauthorized" },
			});
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignIn());
		act(() => {
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Unauthorized");
	});

	it("onSignInWithGoogle: calls social signin with google provider and statistics callback", async () => {
		stubLocation({ origin: "https://app.test" });
		mocks.signInSocial.mockResolvedValue({ error: null });

		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithGoogle();
		});
		expect(mocks.signInSocial).toHaveBeenCalledWith({
			provider: "google",
			callbackURL: "https://app.test/statistics",
		});
		expect(mocks.toastError).not.toHaveBeenCalled();
	});

	it("onSignInWithGoogle mid-OAuth: returns to /login with the authorize query preserved", async () => {
		stubLocation({
			origin: "https://app.test",
			search: OAUTH_AUTHORIZE_SEARCH,
		});
		mocks.signInSocial.mockResolvedValue({ error: null });

		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithGoogle();
		});
		expect(mocks.signInSocial).toHaveBeenCalledWith({
			provider: "google",
			callbackURL: `https://app.test/login${OAUTH_AUTHORIZE_SEARCH}`,
		});
	});

	it("onSignInWithGoogle: surfaces the error message when provider returns error", async () => {
		mocks.signInSocial.mockResolvedValue({
			error: { message: "Google down" },
		});
		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithGoogle();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Google down");
	});

	it("onSignInWithGoogle: falls back to fixed unavailable message when error has no message", async () => {
		mocks.signInSocial.mockResolvedValue({ error: { message: "" } });
		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithGoogle();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Google sign in unavailable");
	});

	it("onSignInWithDiscord: calls social signin with discord provider", async () => {
		mocks.signInSocial.mockResolvedValue({ error: null });
		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithDiscord();
		});
		expect(mocks.signInSocial).toHaveBeenCalledWith(
			expect.objectContaining({ provider: "discord" })
		);
	});

	it("onSignInWithDiscord: falls back to fixed unavailable message", async () => {
		mocks.signInSocial.mockResolvedValue({ error: { message: "" } });
		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithDiscord();
		});
		expect(mocks.toastError).toHaveBeenCalledWith(
			"Discord sign in unavailable"
		);
	});

	it("reports passkeys unsupported when the browser has no WebAuthn", () => {
		const restore = stubWebAuthnSupport(false);
		const { result } = renderHook(() => useSignIn());
		expect(result.current.isPasskeySupported).toBe(false);
		restore();
	});

	it("reports passkeys supported once PublicKeyCredential exists", () => {
		const restore = stubWebAuthnSupport(true);
		const { result } = renderHook(() => useSignIn());
		expect(result.current.isPasskeySupported).toBe(true);
		restore();
	});

	it("onSignInWithPasskey: signs in and enters the app", async () => {
		mocks.signInPasskey.mockResolvedValue({ data: { session: {} } });
		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithPasskey();
		});
		expect(mocks.signInPasskey).toHaveBeenCalledTimes(1);
		expect(mocks.navigate).toHaveBeenCalledTimes(1);
		expect(mocks.navigate).toHaveBeenNthCalledWith(1, { to: "/statistics" });
		expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
		expect(mocks.toastSuccess).toHaveBeenNthCalledWith(1, "Sign in successful");
	});

	it("onSignInWithPasskey mid-OAuth: resumes the authorize flow instead of entering the app", async () => {
		stubLocation({ search: OAUTH_AUTHORIZE_SEARCH });
		mocks.signInPasskey.mockResolvedValue({ data: { session: {} } });
		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithPasskey();
		});
		expect(locationAssignCalls()).toHaveLength(1);
		const url = new URL(locationAssignCalls()[0]?.[0] as string);
		expect(url.origin + url.pathname).toBe(
			"http://localhost:8787/api/auth/mcp/authorize"
		);
		expect(mocks.navigate).not.toHaveBeenCalled();
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
	});

	it("onSignInWithPasskey: surfaces the error message and stays on the page", async () => {
		mocks.signInPasskey.mockResolvedValue({
			data: null,
			error: { message: "No passkey available" },
		});
		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithPasskey();
		});
		expect(mocks.toastError).toHaveBeenCalledTimes(1);
		expect(mocks.toastError).toHaveBeenNthCalledWith(1, "No passkey available");
		expect(mocks.navigate).not.toHaveBeenCalled();
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
	});

	it("onSignInWithPasskey: falls back to a fixed message when the error has none", async () => {
		mocks.signInPasskey.mockResolvedValue({
			data: null,
			error: { message: "" },
		});
		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithPasskey();
		});
		expect(mocks.toastError).toHaveBeenNthCalledWith(
			1,
			"Passkey sign in failed"
		);
	});

	it("offers the silent passkey upgrade after a password sign-in", async () => {
		const { result } = renderHook(() => useSignIn());
		await submitValidCredentials(result);
		expect(mocks.offerAutomaticPasskey).toHaveBeenCalledTimes(1);
	});

	it("skips the upgrade mid-OAuth, where the page is about to be torn down", async () => {
		stubLocation({ search: OAUTH_AUTHORIZE_SEARCH });
		const { result } = renderHook(() => useSignIn());
		await submitValidCredentials(result);
		expect(mocks.offerAutomaticPasskey).not.toHaveBeenCalled();
	});

	it("does not offer the upgrade after a failed sign-in", async () => {
		mocks.signInEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onError?.({
				error: { message: "Invalid credentials", statusText: "Unauthorized" },
			});
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignIn());
		act(() => {
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.offerAutomaticPasskey).not.toHaveBeenCalled();
	});

	it("does not offer the upgrade after a passkey sign-in", async () => {
		mocks.signInPasskey.mockResolvedValue({ data: { session: {} } });
		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithPasskey();
		});
		expect(mocks.offerAutomaticPasskey).not.toHaveBeenCalled();
	});

	it("onSignInWithPasskey: treats a missing result as a failure", async () => {
		mocks.signInPasskey.mockResolvedValue(undefined);
		const { result } = renderHook(() => useSignIn());
		await act(async () => {
			await result.current.onSignInWithPasskey();
		});
		expect(mocks.toastError).toHaveBeenNthCalledWith(
			1,
			"Passkey sign in failed"
		);
		expect(mocks.navigate).not.toHaveBeenCalled();
	});
});

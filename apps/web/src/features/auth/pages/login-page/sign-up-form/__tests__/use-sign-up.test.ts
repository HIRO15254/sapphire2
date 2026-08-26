import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	useSession: vi.fn(() => ({ isPending: false })),
	signUpEmail: vi.fn(),
	signInSocial: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
	env: { VITE_SERVER_URL: "http://localhost:8787" },
}));

vi.mock("@sapphire2/env/web", () => ({
	env: new Proxy(mocks.env, {
		get: (target, prop) => target[prop as keyof typeof target],
	}),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
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

vi.mock("sonner", () => ({
	toast: {
		success: mocks.toastSuccess,
		error: mocks.toastError,
	},
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: mocks.useSession,
		signUp: { email: mocks.signUpEmail },
		signIn: { social: mocks.signInSocial },
	},
}));

import { useSignUp } from "@/features/auth/pages/login-page/sign-up-form/use-sign-up";

describe("useSignUp", () => {
	beforeEach(() => {
		mocks.navigate.mockReset();
		mocks.useSession.mockReturnValue({ isPending: false });
		mocks.signUpEmail.mockReset();
		mocks.signInSocial.mockReset();
		mocks.toastSuccess.mockReset();
		mocks.toastError.mockReset();
	});

	it("exposes isPending from session", () => {
		mocks.useSession.mockReturnValue({ isPending: true });
		const { result } = renderHook(() => useSignUp());
		expect(result.current.isPending).toBe(true);
	});

	it("starts with empty name, email, password", () => {
		const { result } = renderHook(() => useSignUp());
		expect(result.current.form.state.values).toEqual({
			email: "",
			name: "",
			password: "",
		});
	});

	it("rejects name shorter than 2 characters", async () => {
		const { result } = renderHook(() => useSignUp());
		act(() => {
			result.current.form.setFieldValue("name", "A");
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.signUpEmail).not.toHaveBeenCalled();
	});

	it("rejects invalid email", async () => {
		const { result } = renderHook(() => useSignUp());
		act(() => {
			result.current.form.setFieldValue("name", "Alice");
			result.current.form.setFieldValue("email", "not-an-email");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.signUpEmail).not.toHaveBeenCalled();
	});

	it("rejects short password", async () => {
		const { result } = renderHook(() => useSignUp());
		act(() => {
			result.current.form.setFieldValue("name", "Alice");
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "short");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.signUpEmail).not.toHaveBeenCalled();
	});

	it("submits valid values with name/email/password", async () => {
		mocks.signUpEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onSuccess?.();
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignUp());
		act(() => {
			result.current.form.setFieldValue("name", "Alice");
			result.current.form.setFieldValue("email", "alice@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.signUpEmail).toHaveBeenCalledWith(
			{ name: "Alice", email: "alice@example.com", password: "password123" },
			expect.objectContaining({
				onSuccess: expect.any(Function),
				onError: expect.any(Function),
			})
		);
	});

	it("on success: navigates to /statistics and toasts success", async () => {
		mocks.signUpEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onSuccess?.();
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignUp());
		act(() => {
			result.current.form.setFieldValue("name", "Alice");
			result.current.form.setFieldValue("email", "alice@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/statistics" });
		expect(mocks.toastSuccess).toHaveBeenCalledWith("Sign up successful");
	});

	it("on success mid-OAuth: resumes the authorize flow instead of entering the app", async () => {
		const restore = stubLocation({ search: OAUTH_SEARCH });
		mocks.signUpEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onSuccess?.();
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignUp());
		act(() => {
			result.current.form.setFieldValue("name", "Alice");
			result.current.form.setFieldValue("email", "alice@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(window.location.assign).toHaveBeenCalledTimes(1);
		const target = (window.location.assign as ReturnType<typeof vi.fn>).mock
			.calls[0]?.[0] as string;
		expect(
			target.startsWith("http://localhost:8787/api/auth/mcp/authorize?")
		).toBe(true);
		expect(target).toContain("client_id=c1");
		expect(mocks.navigate).not.toHaveBeenCalled();
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
		restore();
	});

	it("on error: toasts provided message", async () => {
		mocks.signUpEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onError?.({
				error: { message: "Email already in use", statusText: "Conflict" },
			});
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignUp());
		act(() => {
			result.current.form.setFieldValue("name", "Alice");
			result.current.form.setFieldValue("email", "alice@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Email already in use");
	});

	it("on error: falls back to statusText when message is empty", async () => {
		mocks.signUpEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onError?.({
				error: { message: "", statusText: "Conflict" },
			});
			return Promise.resolve();
		});
		const { result } = renderHook(() => useSignUp());
		act(() => {
			result.current.form.setFieldValue("name", "Alice");
			result.current.form.setFieldValue("email", "alice@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Conflict");
	});

	it("onSignInWithGoogle: calls social signin with google and statistics callback", async () => {
		const restore = stubLocation({ origin: "https://app.test", search: "" });
		mocks.signInSocial.mockResolvedValue({ error: null });
		const { result } = renderHook(() => useSignUp());
		await act(async () => {
			await result.current.onSignInWithGoogle();
		});
		expect(mocks.signInSocial).toHaveBeenCalledWith({
			provider: "google",
			callbackURL: "https://app.test/statistics",
		});
		restore();
	});

	it("onSignInWithGoogle mid-OAuth: returns to /login with the authorize query preserved", async () => {
		const restore = stubLocation({
			origin: "https://app.test",
			search: OAUTH_SEARCH,
		});
		mocks.signInSocial.mockResolvedValue({ error: null });
		const { result } = renderHook(() => useSignUp());
		await act(async () => {
			await result.current.onSignInWithGoogle();
		});
		expect(mocks.signInSocial).toHaveBeenCalledWith({
			provider: "google",
			callbackURL: `https://app.test/login${OAUTH_SEARCH}`,
		});
		restore();
	});

	it("onSignInWithDiscord mid-OAuth: returns to /login with the authorize query preserved", async () => {
		const restore = stubLocation({
			origin: "https://app.test",
			search: OAUTH_SEARCH,
		});
		mocks.signInSocial.mockResolvedValue({ error: null });
		const { result } = renderHook(() => useSignUp());
		await act(async () => {
			await result.current.onSignInWithDiscord();
		});
		expect(mocks.signInSocial).toHaveBeenCalledWith({
			provider: "discord",
			callbackURL: `https://app.test/login${OAUTH_SEARCH}`,
		});
		restore();
	});

	it("onSignInWithGoogle: toasts fallback 'Google sign up unavailable'", async () => {
		mocks.signInSocial.mockResolvedValue({ error: { message: "" } });
		const { result } = renderHook(() => useSignUp());
		await act(async () => {
			await result.current.onSignInWithGoogle();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Google sign up unavailable");
	});

	it("onSignInWithDiscord: toasts fallback 'Discord sign up unavailable'", async () => {
		mocks.signInSocial.mockResolvedValue({ error: { message: "" } });
		const { result } = renderHook(() => useSignUp());
		await act(async () => {
			await result.current.onSignInWithDiscord();
		});
		expect(mocks.toastError).toHaveBeenCalledWith(
			"Discord sign up unavailable"
		);
	});
});

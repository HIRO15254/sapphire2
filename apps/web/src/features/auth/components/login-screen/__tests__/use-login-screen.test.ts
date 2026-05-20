import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	useSession: vi.fn(() => ({ isPending: false })),
	signInEmail: vi.fn(),
	signUpEmail: vi.fn(),
	signInSocial: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
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
		},
		signUp: {
			email: mocks.signUpEmail,
		},
	},
}));

import { useLoginScreen } from "@/features/auth/components/login-screen/use-login-screen";

describe("useLoginScreen", () => {
	beforeEach(() => {
		mocks.navigate.mockReset();
		mocks.useSession.mockReturnValue({ isPending: false });
		mocks.signInEmail.mockReset();
		mocks.signUpEmail.mockReset();
		mocks.signInSocial.mockReset();
		mocks.toastSuccess.mockReset();
		mocks.toastError.mockReset();
	});

	it("defaults to signin mode", () => {
		const { result } = renderHook(() => useLoginScreen());
		expect(result.current.mode).toBe("signin");
	});

	it("starts with empty email and password", () => {
		const { result } = renderHook(() => useLoginScreen());
		expect(result.current.form.state.values).toEqual({
			email: "",
			password: "",
		});
	});

	it("forwards isPending from authClient.useSession", () => {
		mocks.useSession.mockReturnValue({ isPending: true });
		const { result } = renderHook(() => useLoginScreen());
		expect(result.current.isPending).toBe(true);
	});

	it("onSwitchToSignUp flips mode to signup", () => {
		const { result } = renderHook(() => useLoginScreen());
		act(() => {
			result.current.onSwitchToSignUp();
		});
		expect(result.current.mode).toBe("signup");
	});

	it("onSwitchToSignIn flips mode back to signin", () => {
		const { result } = renderHook(() => useLoginScreen());
		act(() => {
			result.current.onSwitchToSignUp();
		});
		expect(result.current.mode).toBe("signup");
		act(() => {
			result.current.onSwitchToSignIn();
		});
		expect(result.current.mode).toBe("signin");
	});

	it("rejects invalid email on submit", async () => {
		const { result } = renderHook(() => useLoginScreen());
		act(() => {
			result.current.form.setFieldValue("email", "not-an-email");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.signInEmail).not.toHaveBeenCalled();
		expect(mocks.signUpEmail).not.toHaveBeenCalled();
	});

	it("rejects short password on submit", async () => {
		const { result } = renderHook(() => useLoginScreen());
		act(() => {
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "short");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.signInEmail).not.toHaveBeenCalled();
		expect(mocks.signUpEmail).not.toHaveBeenCalled();
	});

	it("signin mode: calls authClient.signIn.email and ignores signUp.email", async () => {
		mocks.signInEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onSuccess?.();
			return Promise.resolve();
		});
		const { result } = renderHook(() => useLoginScreen());
		act(() => {
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.signInEmail).toHaveBeenCalledTimes(1);
		expect(mocks.signInEmail).toHaveBeenCalledWith(
			{ email: "user@example.com", password: "password123" },
			expect.objectContaining({
				onSuccess: expect.any(Function),
				onError: expect.any(Function),
			})
		);
		expect(mocks.signUpEmail).not.toHaveBeenCalled();
	});

	it("signin mode: on success navigates to /dashboard and toasts 'Sign in successful'", async () => {
		mocks.signInEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onSuccess?.();
			return Promise.resolve();
		});
		const { result } = renderHook(() => useLoginScreen());
		act(() => {
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" });
		expect(mocks.toastSuccess).toHaveBeenCalledWith("Sign in successful");
	});

	it("signin mode: on error toasts the error message", async () => {
		mocks.signInEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onError?.({
				error: { message: "Invalid credentials", statusText: "Unauthorized" },
			});
			return Promise.resolve();
		});
		const { result } = renderHook(() => useLoginScreen());
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

	it("signin mode: on error without message falls back to statusText", async () => {
		mocks.signInEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onError?.({
				error: { message: "", statusText: "Unauthorized" },
			});
			return Promise.resolve();
		});
		const { result } = renderHook(() => useLoginScreen());
		act(() => {
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Unauthorized");
	});

	it("signup mode: calls authClient.signUp.email with name derived from email local part", async () => {
		mocks.signUpEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onSuccess?.();
			return Promise.resolve();
		});
		const { result } = renderHook(() => useLoginScreen());
		act(() => {
			result.current.onSwitchToSignUp();
			result.current.form.setFieldValue("email", "ada.lovelace@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.signUpEmail).toHaveBeenCalledTimes(1);
		expect(mocks.signUpEmail).toHaveBeenCalledWith(
			{
				email: "ada.lovelace@example.com",
				password: "password123",
				name: "ada.lovelace",
			},
			expect.objectContaining({
				onSuccess: expect.any(Function),
				onError: expect.any(Function),
			})
		);
		expect(mocks.signInEmail).not.toHaveBeenCalled();
	});

	it("signup mode: on success navigates to /dashboard and toasts 'Sign up successful'", async () => {
		mocks.signUpEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onSuccess?.();
			return Promise.resolve();
		});
		const { result } = renderHook(() => useLoginScreen());
		act(() => {
			result.current.onSwitchToSignUp();
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" });
		expect(mocks.toastSuccess).toHaveBeenCalledWith("Sign up successful");
	});

	it("signup mode: on error toasts the error message", async () => {
		mocks.signUpEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onError?.({
				error: { message: "Email already in use", statusText: "Conflict" },
			});
			return Promise.resolve();
		});
		const { result } = renderHook(() => useLoginScreen());
		act(() => {
			result.current.onSwitchToSignUp();
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Email already in use");
	});

	it("signup mode: on error without message falls back to statusText", async () => {
		mocks.signUpEmail.mockImplementation((_credentials, callbacks) => {
			callbacks?.onError?.({ error: { message: "", statusText: "Conflict" } });
			return Promise.resolve();
		});
		const { result } = renderHook(() => useLoginScreen());
		act(() => {
			result.current.onSwitchToSignUp();
			result.current.form.setFieldValue("email", "user@example.com");
			result.current.form.setFieldValue("password", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Conflict");
	});

	it("onSignInWithGoogle calls social signin with the google provider and dashboard callback", async () => {
		const originalLocation = window.location;
		Object.defineProperty(window, "location", {
			configurable: true,
			value: { ...originalLocation, origin: "https://app.test" },
		});
		mocks.signInSocial.mockResolvedValue({ error: null });

		const { result } = renderHook(() => useLoginScreen());
		await act(async () => {
			await result.current.onSignInWithGoogle();
		});
		expect(mocks.signInSocial).toHaveBeenCalledWith({
			provider: "google",
			callbackURL: "https://app.test/dashboard",
		});
		expect(mocks.toastError).not.toHaveBeenCalled();

		Object.defineProperty(window, "location", {
			configurable: true,
			value: originalLocation,
		});
	});

	it("onSignInWithGoogle: surfaces the error message when provider returns error", async () => {
		mocks.signInSocial.mockResolvedValue({ error: { message: "Google down" } });
		const { result } = renderHook(() => useLoginScreen());
		await act(async () => {
			await result.current.onSignInWithGoogle();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Google down");
	});

	it("onSignInWithGoogle: falls back to fixed unavailable message when error has no message", async () => {
		mocks.signInSocial.mockResolvedValue({ error: { message: "" } });
		const { result } = renderHook(() => useLoginScreen());
		await act(async () => {
			await result.current.onSignInWithGoogle();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Google sign in unavailable");
	});

	it("onSignInWithDiscord: calls social signin with the discord provider", async () => {
		mocks.signInSocial.mockResolvedValue({ error: null });
		const { result } = renderHook(() => useLoginScreen());
		await act(async () => {
			await result.current.onSignInWithDiscord();
		});
		expect(mocks.signInSocial).toHaveBeenCalledWith(
			expect.objectContaining({ provider: "discord" })
		);
	});

	it("onSignInWithDiscord: falls back to fixed unavailable message", async () => {
		mocks.signInSocial.mockResolvedValue({ error: { message: "" } });
		const { result } = renderHook(() => useLoginScreen());
		await act(async () => {
			await result.current.onSignInWithDiscord();
		});
		expect(mocks.toastError).toHaveBeenCalledWith(
			"Discord sign in unavailable"
		);
	});
});

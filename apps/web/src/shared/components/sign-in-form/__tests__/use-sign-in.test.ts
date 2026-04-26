import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	useSession: vi.fn(() => ({ isPending: false })),
	signInEmail: vi.fn(),
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
	},
}));

import { useSignIn } from "@/shared/components/sign-in-form/use-sign-in";

describe("useSignIn", () => {
	beforeEach(() => {
		mocks.navigate.mockReset();
		mocks.useSession.mockReturnValue({ isPending: false });
		mocks.signInEmail.mockReset();
		mocks.signInSocial.mockReset();
		mocks.toastSuccess.mockReset();
		mocks.toastError.mockReset();
	});

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

	it("on success: navigates to /dashboard and toasts success", async () => {
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
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" });
		expect(mocks.toastSuccess).toHaveBeenCalledWith("Sign in successful");
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

	it("onSignInWithGoogle: calls social signin with google provider and dashboard callback", async () => {
		const originalLocation = window.location;
		Object.defineProperty(window, "location", {
			configurable: true,
			value: { ...originalLocation, origin: "https://app.test" },
		});
		mocks.signInSocial.mockResolvedValue({ error: null });

		const { result } = renderHook(() => useSignIn());
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
});

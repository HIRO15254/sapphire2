import {
	PASSWORD_MAX_LENGTH,
	SET_PASSWORD_MESSAGES,
} from "@sapphire2/api/set-password";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	SET_PASSWORD_NETWORK_MESSAGE,
	useSetPasswordForm,
} from "@/shared/hooks/use-set-password-form";

const mocks = vi.hoisted(() => ({
	fetch: vi.fn(),
	toastError: vi.fn(),
	toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: { $fetch: mocks.fetch },
}));

function renderSetPasswordForm() {
	const onOpenChange = vi.fn();
	const onSuccess = vi.fn();
	const view = renderHook(() =>
		useSetPasswordForm({ onOpenChange, onSuccess })
	);
	return { onOpenChange, onSuccess, ...view };
}

async function submit(
	result: ReturnType<typeof renderSetPasswordForm>["result"],
	newPassword: string,
	confirmPassword = newPassword
) {
	act(() => {
		result.current.form.setFieldValue("newPassword", newPassword);
		result.current.form.setFieldValue("confirmPassword", confirmPassword);
	});
	await act(async () => {
		await result.current.form.handleSubmit();
	});
}

function serverError(body: Record<string, unknown>, status: number) {
	return { data: null, error: { ...body, status, statusText: "" } };
}

describe("useSetPasswordForm", () => {
	beforeEach(() => {
		mocks.fetch.mockReset();
		mocks.toastSuccess.mockReset();
		mocks.toastError.mockReset();
	});

	it("starts with empty newPassword and confirmPassword", () => {
		const { result } = renderSetPasswordForm();
		expect(result.current.form.state.values).toEqual({
			confirmPassword: "",
			newPassword: "",
		});
	});

	it.each([
		{ name: "shorter than the minimum", newPassword: "short" },
		{
			name: "longer than the server's maximum",
			newPassword: "x".repeat(PASSWORD_MAX_LENGTH + 1),
		},
	])(
		"rejects a newPassword $name before calling the server",
		async ({ newPassword }) => {
			const { onSuccess, result } = renderSetPasswordForm();
			await submit(result, newPassword);
			expect(mocks.fetch).not.toHaveBeenCalled();
			expect(onSuccess).not.toHaveBeenCalled();
		}
	);

	it("rejects when newPassword and confirmPassword do not match", async () => {
		const { onSuccess, result } = renderSetPasswordForm();
		await submit(result, "password123", "password456");
		expect(mocks.fetch).not.toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it("calls $fetch with /set-password endpoint and the new password", async () => {
		mocks.fetch.mockResolvedValue({ data: { status: true }, error: null });
		const { result } = renderSetPasswordForm();
		await submit(result, "password123");
		expect(mocks.fetch).toHaveBeenCalledWith("/set-password", {
			body: { newPassword: "password123" },
			method: "POST",
		});
	});

	it("on success: toasts success, calls onSuccess and closes the dialog once", async () => {
		mocks.fetch.mockResolvedValue({ data: { status: true }, error: null });
		const { onOpenChange, onSuccess, result } = renderSetPasswordForm();
		await submit(result, "password123");
		expect(mocks.toastSuccess).toHaveBeenCalledWith("Password set", {
			description: "You can now sign in with your email.",
		});
		expect(onSuccess).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(mocks.toastError).not.toHaveBeenCalled();
	});

	it.each([
		{
			description: SET_PASSWORD_MESSAGES.unauthorized,
			name: "an expired session",
			respond: () =>
				mocks.fetch.mockResolvedValue(
					serverError(
						{
							code: "UNAUTHORIZED",
							message: SET_PASSWORD_MESSAGES.unauthorized,
						},
						401
					)
				),
		},
		{
			description: SET_PASSWORD_MESSAGES.passwordAlreadySet,
			name: "a password set in another tab",
			respond: () =>
				mocks.fetch.mockResolvedValue(
					serverError(
						{
							code: "PASSWORD_ALREADY_SET",
							message: SET_PASSWORD_MESSAGES.passwordAlreadySet,
						},
						409
					)
				),
		},
		{
			description: SET_PASSWORD_MESSAGES.internal,
			name: "a body outside the contract",
			respond: () =>
				mocks.fetch.mockResolvedValue(
					serverError({ message: "Error: D1_ERROR stack trace" }, 502)
				),
		},
		{
			description: SET_PASSWORD_NETWORK_MESSAGE,
			name: "a request that never reaches the server",
			respond: () =>
				mocks.fetch.mockRejectedValue(new TypeError("Failed to fetch")),
		},
	])(
		"toasts $name and keeps the sheet open",
		async ({ description, respond }) => {
			respond();
			const { onOpenChange, onSuccess, result } = renderSetPasswordForm();
			await submit(result, "password123");
			expect(mocks.toastError).toHaveBeenCalledTimes(1);
			expect(mocks.toastError).toHaveBeenCalledWith(
				"Couldn't set the password",
				{ description }
			);
			expect(onSuccess).not.toHaveBeenCalled();
			expect(onOpenChange).not.toHaveBeenCalled();
			expect(result.current.form.state.values.newPassword).toBe("password123");
		}
	);

	it("succeeds on retry after a failed attempt and closes only once", async () => {
		mocks.fetch
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockResolvedValueOnce({ data: { status: true }, error: null });
		const { onOpenChange, onSuccess, result } = renderSetPasswordForm();

		await submit(result, "password123");
		await act(async () => {
			await result.current.form.handleSubmit();
		});

		expect(mocks.fetch).toHaveBeenCalledTimes(2);
		expect(mocks.toastError).toHaveBeenCalledTimes(1);
		expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
		expect(onSuccess).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("clears the typed passwords when the sheet is dismissed", () => {
		const { onOpenChange, result } = renderSetPasswordForm();
		act(() => {
			result.current.form.setFieldValue("newPassword", "password123");
			result.current.form.setFieldValue("confirmPassword", "password123");
		});
		act(() => result.current.onSheetOpenChange(false));
		expect(result.current.form.state.values).toEqual({
			confirmPassword: "",
			newPassword: "",
		});
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});

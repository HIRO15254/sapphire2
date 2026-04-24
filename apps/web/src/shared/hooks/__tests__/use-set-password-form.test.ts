import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	fetch: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: { $fetch: mocks.fetch },
}));

import { useSetPasswordForm } from "@/shared/hooks/use-set-password-form";

describe("useSetPasswordForm", () => {
	beforeEach(() => {
		mocks.fetch.mockReset();
		mocks.toastSuccess.mockReset();
		mocks.toastError.mockReset();
	});

	it("starts with empty newPassword and confirmPassword", () => {
		const { result } = renderHook(() =>
			useSetPasswordForm({ onOpenChange: vi.fn(), onSuccess: vi.fn() })
		);
		expect(result.current.form.state.values).toEqual({
			newPassword: "",
			confirmPassword: "",
		});
	});

	it("rejects when newPassword is shorter than 8 characters", async () => {
		const onOpenChange = vi.fn();
		const onSuccess = vi.fn();
		const { result } = renderHook(() =>
			useSetPasswordForm({ onOpenChange, onSuccess })
		);
		act(() => {
			result.current.form.setFieldValue("newPassword", "short");
			result.current.form.setFieldValue("confirmPassword", "short");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.fetch).not.toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it("rejects when newPassword and confirmPassword do not match", async () => {
		const onOpenChange = vi.fn();
		const onSuccess = vi.fn();
		const { result } = renderHook(() =>
			useSetPasswordForm({ onOpenChange, onSuccess })
		);
		act(() => {
			result.current.form.setFieldValue("newPassword", "password123");
			result.current.form.setFieldValue("confirmPassword", "password456");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.fetch).not.toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it("calls $fetch with /set-password endpoint and the new password", async () => {
		mocks.fetch.mockResolvedValue({ error: null });
		const onOpenChange = vi.fn();
		const onSuccess = vi.fn();
		const { result } = renderHook(() =>
			useSetPasswordForm({ onOpenChange, onSuccess })
		);
		act(() => {
			result.current.form.setFieldValue("newPassword", "password123");
			result.current.form.setFieldValue("confirmPassword", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.fetch).toHaveBeenCalledWith("/set-password", {
			method: "POST",
			body: { newPassword: "password123" },
		});
	});

	it("on success: toasts success, calls onSuccess and closes the dialog", async () => {
		mocks.fetch.mockResolvedValue({ error: null });
		const onOpenChange = vi.fn();
		const onSuccess = vi.fn();
		const { result } = renderHook(() =>
			useSetPasswordForm({ onOpenChange, onSuccess })
		);
		act(() => {
			result.current.form.setFieldValue("newPassword", "password123");
			result.current.form.setFieldValue("confirmPassword", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.toastSuccess).toHaveBeenCalledWith(
			"Password set successfully"
		);
		expect(onSuccess).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(mocks.toastError).not.toHaveBeenCalled();
	});

	it("on error with message: toasts error and does NOT call onSuccess/onOpenChange", async () => {
		mocks.fetch.mockResolvedValue({
			error: { message: "Password rejected" },
		});
		const onOpenChange = vi.fn();
		const onSuccess = vi.fn();
		const { result } = renderHook(() =>
			useSetPasswordForm({ onOpenChange, onSuccess })
		);
		act(() => {
			result.current.form.setFieldValue("newPassword", "password123");
			result.current.form.setFieldValue("confirmPassword", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Password rejected");
		expect(onSuccess).not.toHaveBeenCalled();
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("on error without message: falls back to fixed 'Failed to set password'", async () => {
		mocks.fetch.mockResolvedValue({ error: {} });
		const { result } = renderHook(() =>
			useSetPasswordForm({ onOpenChange: vi.fn(), onSuccess: vi.fn() })
		);
		act(() => {
			result.current.form.setFieldValue("newPassword", "password123");
			result.current.form.setFieldValue("confirmPassword", "password123");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Failed to set password");
	});
});

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	addPasskey: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: { passkey: { addPasskey: mocks.addPasskey } },
}));

import { useAddPasskeyForm } from "@/features/settings/pages/settings-page/passkeys/use-add-passkey-form";

function renderForm() {
	const onOpenChange = vi.fn();
	const onSuccess = vi.fn();
	const { result } = renderHook(() =>
		useAddPasskeyForm({ onOpenChange, onSuccess })
	);
	return { onOpenChange, onSuccess, result };
}

async function submitWithName(
	result: ReturnType<typeof renderForm>["result"],
	name: string
) {
	act(() => {
		result.current.form.setFieldValue("name", name);
	});
	await act(async () => {
		await result.current.form.handleSubmit();
	});
}

describe("useAddPasskeyForm", () => {
	beforeEach(() => {
		mocks.addPasskey.mockReset();
		mocks.toastSuccess.mockReset();
		mocks.toastError.mockReset();
	});

	it("starts with an empty name", () => {
		const { result } = renderForm();
		expect(result.current.form.state.values).toEqual({ name: "" });
	});

	it("rejects an empty name without touching the authenticator", async () => {
		const { result } = renderForm();
		await submitWithName(result, "");
		expect(mocks.addPasskey).not.toHaveBeenCalled();
		expect(result.current.form.state.isSubmitSuccessful).toBe(false);
	});

	it("rejects a whitespace-only name", async () => {
		const { result } = renderForm();
		await submitWithName(result, "   ");
		expect(mocks.addPasskey).not.toHaveBeenCalled();
	});

	it("rejects a name longer than 64 characters", async () => {
		const { result } = renderForm();
		await submitWithName(result, "a".repeat(65));
		expect(mocks.addPasskey).not.toHaveBeenCalled();
	});

	it("accepts a 64-character name", async () => {
		mocks.addPasskey.mockResolvedValue({ data: {} });
		const { result } = renderForm();
		await submitWithName(result, "a".repeat(64));
		expect(mocks.addPasskey).toHaveBeenCalledTimes(1);
	});

	it("registers the passkey under the trimmed name", async () => {
		mocks.addPasskey.mockResolvedValue({ data: {} });
		const { onOpenChange, onSuccess, result } = renderForm();
		await submitWithName(result, "  Pixel 9  ");

		expect(mocks.addPasskey).toHaveBeenCalledTimes(1);
		expect(mocks.addPasskey).toHaveBeenNthCalledWith(1, { name: "Pixel 9" });
		expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
		expect(mocks.toastSuccess).toHaveBeenNthCalledWith(1, "Passkey added");
		expect(onSuccess).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
	});

	it("clears the field after a successful registration", async () => {
		mocks.addPasskey.mockResolvedValue({ data: {} });
		const { result } = renderForm();
		await submitWithName(result, "Pixel 9");
		expect(result.current.form.state.values).toEqual({ name: "" });
	});

	it("surfaces a cancelled ceremony and keeps the sheet open", async () => {
		mocks.addPasskey.mockResolvedValue({
			data: null,
			error: { message: "Registration was cancelled" },
		});
		const { onOpenChange, onSuccess, result } = renderForm();
		await submitWithName(result, "Pixel 9");

		expect(mocks.toastError).toHaveBeenCalledTimes(1);
		expect(mocks.toastError).toHaveBeenNthCalledWith(
			1,
			"Registration was cancelled"
		);
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled();
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("falls back to a fixed message when the error carries none", async () => {
		mocks.addPasskey.mockResolvedValue({ data: null, error: { message: "" } });
		const { result } = renderForm();
		await submitWithName(result, "Pixel 9");
		expect(mocks.toastError).toHaveBeenNthCalledWith(
			1,
			"Failed to add passkey"
		);
	});

	it("treats a result without the stored passkey as a failure", async () => {
		mocks.addPasskey.mockResolvedValue({ data: null, error: null });
		const { onOpenChange, onSuccess, result } = renderForm();
		await submitWithName(result, "Pixel 9");
		expect(mocks.toastError).toHaveBeenNthCalledWith(
			1,
			"Failed to add passkey"
		);
		expect(onSuccess).not.toHaveBeenCalled();
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("treats a missing result as a failure", async () => {
		mocks.addPasskey.mockResolvedValue(undefined);
		const { onSuccess, result } = renderForm();
		await submitWithName(result, "Pixel 9");
		expect(mocks.toastError).toHaveBeenNthCalledWith(
			1,
			"Failed to add passkey"
		);
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled();
	});
});

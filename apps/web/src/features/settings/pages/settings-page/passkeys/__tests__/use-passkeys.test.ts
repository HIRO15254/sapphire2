import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubWebAuthnSupport } from "@/__tests__/test-utils";

const mocks = vi.hoisted(() => ({
	listUserPasskeys: vi.fn(),
	deletePasskey: vi.fn(),
	updatePasskey: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
	setAutomaticPasskeyOptOut: vi.fn(),
}));

vi.mock("@/shared/lib/passkey-opt-out", () => ({
	setAutomaticPasskeyOptOut: mocks.setAutomaticPasskeyOptOut,
}));

vi.mock("sonner", () => ({
	toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		passkey: {
			listUserPasskeys: mocks.listUserPasskeys,
			deletePasskey: mocks.deletePasskey,
			updatePasskey: mocks.updatePasskey,
		},
	},
}));

import { usePasskeys } from "@/features/settings/pages/settings-page/passkeys/use-passkeys";

const PASSKEY_A = {
	backedUp: true,
	createdAt: "2026-04-11T03:00:00.000Z",
	id: "pk1",
	name: "MacBook",
};
const PASSKEY_B = {
	backedUp: false,
	createdAt: "2026-04-12T03:00:00.000Z",
	id: "pk2",
	name: "YubiKey",
};

describe("usePasskeys", () => {
	beforeEach(() => {
		mocks.listUserPasskeys.mockReset();
		mocks.deletePasskey.mockReset();
		mocks.updatePasskey.mockReset();
		mocks.toastSuccess.mockReset();
		mocks.toastError.mockReset();
		mocks.setAutomaticPasskeyOptOut.mockReset();
	});

	afterEach(() => {
		Reflect.deleteProperty(window, "PublicKeyCredential");
	});

	it("starts loading with no passkeys", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [] });
		const { result } = renderHook(() => usePasskeys());
		expect(result.current.loading).toBe(true);
		expect(result.current.passkeys).toEqual([]);
		await waitFor(() => expect(result.current.loading).toBe(false));
	});

	it("fetches and exposes the user's passkeys on mount", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A, PASSKEY_B] });
		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(mocks.listUserPasskeys).toHaveBeenCalledTimes(1);
		expect(result.current.passkeys).toEqual([PASSKEY_A, PASSKEY_B]);
		expect(result.current.totalPasskeys).toBe(2);
		expect(result.current.error).toBeNull();
	});

	it("falls back to an empty list when the response carries no data", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: null });
		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.passkeys).toEqual([]);
		expect(result.current.totalPasskeys).toBe(0);
	});

	it("surfaces an error and clears the list when the fetch throws", async () => {
		mocks.listUserPasskeys.mockRejectedValue(new Error("offline"));
		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).toBe("Unable to load passkeys");
		expect(result.current.passkeys).toEqual([]);
	});

	it("surfaces an HTTP failure rather than showing it as zero passkeys", async () => {
		mocks.listUserPasskeys.mockResolvedValue({
			data: null,
			error: { message: "Unauthorized", status: 401 },
		});
		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).toBe("Unable to load passkeys");
		expect(result.current.passkeys).toEqual([]);
		expect(result.current.totalPasskeys).toBe(0);
	});

	it("reports passkey support from the browser capability", async () => {
		stubWebAuthnSupport(true);
		mocks.listUserPasskeys.mockResolvedValue({ data: [] });
		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.isPasskeySupported).toBe(true);
	});

	it("reports no passkey support without WebAuthn", async () => {
		stubWebAuthnSupport(false);
		mocks.listUserPasskeys.mockResolvedValue({ data: [] });
		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.isPasskeySupported).toBe(false);
	});

	it("keeps the add sheet closed until it is opened", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [] });
		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.isAddOpen).toBe(false);
		act(() => {
			result.current.onAddOpenChange(true);
		});
		expect(result.current.isAddOpen).toBe(true);
		act(() => {
			result.current.onAddOpenChange(false);
		});
		expect(result.current.isAddOpen).toBe(false);
	});

	it("keeps the delete confirmation closed until a passkey is targeted", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A] });
		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.deleteTarget).toBeNull();
		act(() => {
			result.current.onDeleteTargetChange(PASSKEY_A);
		});
		expect(result.current.deleteTarget).toEqual(PASSKEY_A);
		act(() => {
			result.current.onDeleteTargetChange(null);
		});
		expect(result.current.deleteTarget).toBeNull();
	});

	it("onDeletePasskey does nothing when no passkey is targeted", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A] });
		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(async () => {
			await result.current.onDeletePasskey();
		});

		expect(mocks.deletePasskey).not.toHaveBeenCalled();
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
		expect(mocks.toastError).not.toHaveBeenCalled();
	});

	it("onDeletePasskey removes the targeted passkey, closes, and refetches", async () => {
		mocks.listUserPasskeys
			.mockResolvedValueOnce({ data: [PASSKEY_A, PASSKEY_B] })
			.mockResolvedValueOnce({ data: [PASSKEY_B] });
		mocks.deletePasskey.mockResolvedValue({ data: { status: true } });

		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		act(() => {
			result.current.onDeleteTargetChange(PASSKEY_A);
		});
		await act(async () => {
			await result.current.onDeletePasskey();
		});

		expect(mocks.deletePasskey).toHaveBeenCalledTimes(1);
		expect(mocks.deletePasskey).toHaveBeenNthCalledWith(1, { id: "pk1" });
		expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
		expect(mocks.toastSuccess).toHaveBeenNthCalledWith(1, "Passkey removed");
		expect(result.current.deleteTarget).toBeNull();
		expect(mocks.listUserPasskeys).toHaveBeenCalledTimes(2);
		await waitFor(() => expect(result.current.passkeys).toEqual([PASSKEY_B]));
	});

	it("stops the silent upgrade from re-creating a passkey the user removed", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A] });
		mocks.deletePasskey.mockResolvedValue({ data: { status: true } });

		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		act(() => {
			result.current.onDeleteTargetChange(PASSKEY_A);
		});
		await act(async () => {
			await result.current.onDeletePasskey();
		});

		expect(mocks.setAutomaticPasskeyOptOut).toHaveBeenCalledTimes(1);
		expect(mocks.setAutomaticPasskeyOptOut).toHaveBeenNthCalledWith(1, true);
	});

	it("does not opt out when the delete failed", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A] });
		mocks.deletePasskey.mockResolvedValue({ error: { message: "nope" } });

		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		act(() => {
			result.current.onDeleteTargetChange(PASSKEY_A);
		});
		await act(async () => {
			await result.current.onDeletePasskey();
		});

		expect(mocks.setAutomaticPasskeyOptOut).not.toHaveBeenCalled();
	});

	it("onDeletePasskey surfaces the error and keeps the confirmation open", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A] });
		mocks.deletePasskey.mockResolvedValue({
			error: { message: "Passkey not found" },
		});

		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		act(() => {
			result.current.onDeleteTargetChange(PASSKEY_A);
		});
		await act(async () => {
			await result.current.onDeletePasskey();
		});

		expect(mocks.toastError).toHaveBeenCalledTimes(1);
		expect(mocks.toastError).toHaveBeenNthCalledWith(1, "Passkey not found");
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
		expect(result.current.deleteTarget).toEqual(PASSKEY_A);
		expect(mocks.listUserPasskeys).toHaveBeenCalledTimes(1);
		expect(result.current.passkeys).toEqual([PASSKEY_A]);
	});

	it("onDeletePasskey falls back to a fixed message when the error has none", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A] });
		mocks.deletePasskey.mockResolvedValue({ error: {} });

		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		act(() => {
			result.current.onDeleteTargetChange(PASSKEY_A);
		});
		await act(async () => {
			await result.current.onDeletePasskey();
		});

		expect(mocks.toastError).toHaveBeenNthCalledWith(
			1,
			"Failed to remove passkey"
		);
	});

	it("marks the delete pending while it is in flight, and clears it after", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A] });
		let release: ((value: unknown) => void) | undefined;
		mocks.deletePasskey.mockReturnValue(
			new Promise((resolve) => {
				release = resolve;
			})
		);

		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		act(() => {
			result.current.onDeleteTargetChange(PASSKEY_A);
		});
		expect(result.current.isDeletePending).toBe(false);

		let pending: Promise<void> | undefined;
		act(() => {
			pending = result.current.onDeletePasskey();
		});
		await waitFor(() => expect(result.current.isDeletePending).toBe(true));

		await act(async () => {
			release?.({ data: { status: true } });
			await pending;
		});
		expect(result.current.isDeletePending).toBe(false);
	});

	it("clears the pending flag even when the delete rejects", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A] });
		mocks.deletePasskey.mockRejectedValue(new Error("offline"));

		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		act(() => {
			result.current.onDeleteTargetChange(PASSKEY_A);
		});
		await act(async () => {
			await expect(result.current.onDeletePasskey()).rejects.toThrow("offline");
		});

		expect(result.current.isDeletePending).toBe(false);
	});

	it("refreshPasskeys re-reads the list on demand", async () => {
		mocks.listUserPasskeys
			.mockResolvedValueOnce({ data: [] })
			.mockResolvedValueOnce({ data: [PASSKEY_A] });

		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		await act(async () => {
			await result.current.refreshPasskeys();
		});

		expect(mocks.listUserPasskeys).toHaveBeenCalledTimes(2);
		expect(result.current.passkeys).toEqual([PASSKEY_A]);
	});

	it("keeps the rename sheet closed until a passkey is targeted", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A] });
		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.renameTarget).toBeNull();
		act(() => {
			result.current.onRenameTargetChange(PASSKEY_A);
		});
		expect(result.current.renameTarget).toEqual(PASSKEY_A);
		act(() => {
			result.current.onRenameTargetChange(null);
		});
		expect(result.current.renameTarget).toBeNull();
	});

	it("onRenamePasskey renames the targeted passkey, closes, and refetches", async () => {
		const renamed = { ...PASSKEY_A, name: "Work laptop" };
		mocks.listUserPasskeys
			.mockResolvedValueOnce({ data: [PASSKEY_A] })
			.mockResolvedValueOnce({ data: [renamed] });
		mocks.updatePasskey.mockResolvedValue({ data: { passkey: renamed } });

		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		act(() => {
			result.current.onRenameTargetChange(PASSKEY_A);
		});
		await act(async () => {
			await result.current.onRenamePasskey("Work laptop");
		});

		expect(mocks.updatePasskey).toHaveBeenCalledTimes(1);
		expect(mocks.updatePasskey).toHaveBeenNthCalledWith(1, {
			id: "pk1",
			name: "Work laptop",
		});
		expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
		expect(mocks.toastSuccess).toHaveBeenNthCalledWith(1, "Passkey renamed");
		expect(result.current.renameTarget).toBeNull();
		expect(mocks.listUserPasskeys).toHaveBeenCalledTimes(2);
		await waitFor(() => expect(result.current.passkeys).toEqual([renamed]));
	});

	it("onRenamePasskey does nothing when no passkey is targeted", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A] });
		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(async () => {
			await result.current.onRenamePasskey("Work laptop");
		});

		expect(mocks.updatePasskey).not.toHaveBeenCalled();
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
		expect(mocks.toastError).not.toHaveBeenCalled();
	});

	it("onRenamePasskey surfaces the error and keeps the sheet open", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A] });
		mocks.updatePasskey.mockResolvedValue({
			error: { message: "Passkey not found" },
		});

		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		act(() => {
			result.current.onRenameTargetChange(PASSKEY_A);
		});
		await act(async () => {
			await result.current.onRenamePasskey("Work laptop");
		});

		expect(mocks.toastError).toHaveBeenCalledTimes(1);
		expect(mocks.toastError).toHaveBeenNthCalledWith(1, "Passkey not found");
		expect(result.current.renameTarget).toEqual(PASSKEY_A);
		expect(mocks.listUserPasskeys).toHaveBeenCalledTimes(1);
	});

	it("onRenamePasskey falls back to a fixed message when the error has none", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A] });
		mocks.updatePasskey.mockResolvedValue({ error: {} });

		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		act(() => {
			result.current.onRenameTargetChange(PASSKEY_A);
		});
		await act(async () => {
			await result.current.onRenamePasskey("Work laptop");
		});

		expect(mocks.toastError).toHaveBeenNthCalledWith(
			1,
			"Failed to rename passkey"
		);
	});

	it("ignores a second rename while one is in flight", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A] });
		let release: ((value: unknown) => void) | undefined;
		mocks.updatePasskey.mockReturnValue(
			new Promise((resolve) => {
				release = resolve;
			})
		);

		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		act(() => {
			result.current.onRenameTargetChange(PASSKEY_A);
		});

		let first: Promise<void> | undefined;
		act(() => {
			first = result.current.onRenamePasskey("Work laptop");
		});
		await waitFor(() => expect(result.current.isRenamePending).toBe(true));
		await act(async () => {
			await result.current.onRenamePasskey("Work laptop");
		});
		expect(mocks.updatePasskey).toHaveBeenCalledTimes(1);

		await act(async () => {
			release?.({ data: { passkey: PASSKEY_A } });
			await first;
		});
		expect(result.current.isRenamePending).toBe(false);
	});

	it("ignores a second delete while one is in flight", async () => {
		mocks.listUserPasskeys.mockResolvedValue({ data: [PASSKEY_A] });
		let release: ((value: unknown) => void) | undefined;
		mocks.deletePasskey.mockReturnValue(
			new Promise((resolve) => {
				release = resolve;
			})
		);

		const { result } = renderHook(() => usePasskeys());
		await waitFor(() => expect(result.current.loading).toBe(false));
		act(() => {
			result.current.onDeleteTargetChange(PASSKEY_A);
		});

		let first: Promise<void> | undefined;
		act(() => {
			first = result.current.onDeletePasskey();
		});
		await waitFor(() => expect(result.current.isDeletePending).toBe(true));
		await act(async () => {
			await result.current.onDeletePasskey();
		});
		expect(mocks.deletePasskey).toHaveBeenCalledTimes(1);

		await act(async () => {
			release?.({ data: { status: true } });
			await first;
		});
	});

	it("clears a previous error once a refetch succeeds", async () => {
		mocks.listUserPasskeys
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce({ data: [PASSKEY_A] });

		const { result } = renderHook(() => usePasskeys());
		await waitFor(() =>
			expect(result.current.error).toBe("Unable to load passkeys")
		);
		await act(async () => {
			await result.current.refreshPasskeys();
		});

		expect(result.current.error).toBeNull();
		expect(result.current.passkeys).toEqual([PASSKEY_A]);
	});
});

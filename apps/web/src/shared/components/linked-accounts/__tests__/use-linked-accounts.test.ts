import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	listAccounts: vi.fn(),
	linkSocial: vi.fn(),
	unlinkAccount: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		listAccounts: mocks.listAccounts,
		linkSocial: mocks.linkSocial,
		unlinkAccount: mocks.unlinkAccount,
	},
}));

import { useLinkedAccounts } from "@/shared/components/linked-accounts/use-linked-accounts";

describe("useLinkedAccounts", () => {
	beforeEach(() => {
		mocks.listAccounts.mockReset();
		mocks.linkSocial.mockReset();
		mocks.unlinkAccount.mockReset();
		mocks.toastSuccess.mockReset();
		mocks.toastError.mockReset();
	});

	it("starts loading with empty accounts", async () => {
		mocks.listAccounts.mockResolvedValue({ data: [] });
		const { result } = renderHook(() => useLinkedAccounts());
		expect(result.current.loading).toBe(true);
		expect(result.current.accounts).toEqual([]);
		await waitFor(() => expect(result.current.loading).toBe(false));
	});

	it("fetches and exposes accounts on mount", async () => {
		mocks.listAccounts.mockResolvedValue({
			data: [
				{ accountId: "a1", id: "ac1", providerId: "credential" },
				{ accountId: "a2", id: "ac2", providerId: "google" },
			],
		});
		const { result } = renderHook(() => useLinkedAccounts());
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.accounts).toHaveLength(2);
		expect(result.current.totalLinked).toBe(2);
		expect(result.current.hasCredential).toBe(true);
		expect(result.current.linkedProviderIds.has("credential")).toBe(true);
		expect(result.current.linkedProviderIds.has("google")).toBe(true);
	});

	it("falls back to empty array when listAccounts returns undefined data", async () => {
		mocks.listAccounts.mockResolvedValue({ data: undefined });
		const { result } = renderHook(() => useLinkedAccounts());
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.accounts).toEqual([]);
		expect(result.current.totalLinked).toBe(0);
		expect(result.current.hasCredential).toBe(false);
	});

	it("handleLink forwards the provider and callback URL", async () => {
		mocks.listAccounts.mockResolvedValue({ data: [] });
		mocks.linkSocial.mockResolvedValue(undefined);
		const originalLocation = window.location;
		Object.defineProperty(window, "location", {
			configurable: true,
			value: { ...originalLocation, origin: "https://app.test" },
		});

		const { result } = renderHook(() => useLinkedAccounts());
		await waitFor(() => expect(result.current.loading).toBe(false));
		await act(async () => {
			await result.current.handleLink("google");
		});
		expect(mocks.linkSocial).toHaveBeenCalledWith({
			provider: "google",
			callbackURL: "https://app.test/settings",
		});

		Object.defineProperty(window, "location", {
			configurable: true,
			value: originalLocation,
		});
	});

	it("handleUnlink on success: toasts and refetches accounts", async () => {
		mocks.listAccounts
			.mockResolvedValueOnce({
				data: [{ accountId: "a1", id: "ac1", providerId: "google" }],
			})
			.mockResolvedValueOnce({ data: [] });
		mocks.unlinkAccount.mockResolvedValue({ error: null });

		const { result } = renderHook(() => useLinkedAccounts());
		await waitFor(() => expect(result.current.loading).toBe(false));
		await act(async () => {
			await result.current.handleUnlink("google");
		});
		expect(mocks.unlinkAccount).toHaveBeenCalledWith({ providerId: "google" });
		expect(mocks.toastSuccess).toHaveBeenCalledWith("Account unlinked");
		await waitFor(() => expect(result.current.accounts).toEqual([]));
	});

	it("handleUnlink on error with message: toasts and does NOT refetch", async () => {
		mocks.listAccounts.mockResolvedValue({
			data: [{ accountId: "a1", id: "ac1", providerId: "google" }],
		});
		mocks.unlinkAccount.mockResolvedValue({
			error: { message: "Last account cannot be unlinked" },
		});

		const { result } = renderHook(() => useLinkedAccounts());
		await waitFor(() => expect(result.current.loading).toBe(false));
		const listCallCountBefore = mocks.listAccounts.mock.calls.length;
		await act(async () => {
			await result.current.handleUnlink("google");
		});
		expect(mocks.toastError).toHaveBeenCalledWith(
			"Last account cannot be unlinked"
		);
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
		expect(mocks.listAccounts).toHaveBeenCalledTimes(listCallCountBefore);
	});

	it("handleUnlink on error without message: falls back to fixed 'Failed to unlink account'", async () => {
		mocks.listAccounts.mockResolvedValue({
			data: [{ accountId: "a1", id: "ac1", providerId: "google" }],
		});
		mocks.unlinkAccount.mockResolvedValue({ error: {} });

		const { result } = renderHook(() => useLinkedAccounts());
		await waitFor(() => expect(result.current.loading).toBe(false));
		await act(async () => {
			await result.current.handleUnlink("google");
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Failed to unlink account");
	});

	it("exposes onSetPasswordOpenChange to control isSetPasswordOpen", async () => {
		mocks.listAccounts.mockResolvedValue({ data: [] });
		const { result } = renderHook(() => useLinkedAccounts());
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.isSetPasswordOpen).toBe(false);
		act(() => result.current.onSetPasswordOpenChange(true));
		expect(result.current.isSetPasswordOpen).toBe(true);
		act(() => result.current.onSetPasswordOpenChange(false));
		expect(result.current.isSetPasswordOpen).toBe(false);
	});

	it("hasCredential is false when accounts contain only social providers", async () => {
		mocks.listAccounts.mockResolvedValue({
			data: [
				{ accountId: "a1", id: "ac1", providerId: "google" },
				{ accountId: "a2", id: "ac2", providerId: "discord" },
			],
		});
		const { result } = renderHook(() => useLinkedAccounts());
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.hasCredential).toBe(false);
	});
});

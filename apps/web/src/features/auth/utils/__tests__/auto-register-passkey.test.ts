import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	addPasskey: vi.fn(),
	supportsAutomaticPasskeyRegistration: vi.fn(),
	toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: { success: mocks.toastSuccess },
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: { passkey: { addPasskey: mocks.addPasskey } },
}));

vi.mock("@/shared/lib/device-name", () => ({
	describeCurrentDevice: () => "Chrome on macOS",
}));

vi.mock("@/shared/lib/webauthn", () => ({
	supportsAutomaticPasskeyRegistration:
		mocks.supportsAutomaticPasskeyRegistration,
}));

import {
	autoRegisterPasskey,
	offerAutomaticPasskey,
} from "@/features/auth/utils/auto-register-passkey";

describe("autoRegisterPasskey", () => {
	beforeEach(() => {
		mocks.addPasskey.mockReset();
		mocks.supportsAutomaticPasskeyRegistration.mockReset();
		mocks.supportsAutomaticPasskeyRegistration.mockResolvedValue(true);
		mocks.toastSuccess.mockReset();
	});

	it("never touches the authenticator when the browser cannot upgrade silently", async () => {
		mocks.supportsAutomaticPasskeyRegistration.mockResolvedValue(false);
		expect(await autoRegisterPasskey()).toBe(false);
		expect(mocks.addPasskey).not.toHaveBeenCalled();
	});

	it("registers under conditional mediation and reports success", async () => {
		mocks.addPasskey.mockResolvedValue({ data: { id: "pk1" }, error: null });

		expect(await autoRegisterPasskey()).toBe(true);
		expect(mocks.addPasskey).toHaveBeenCalledTimes(1);
		expect(mocks.addPasskey).toHaveBeenNthCalledWith(1, {
			name: "Chrome on macOS",
			useAutoRegister: true,
		});
	});

	it("reports failure when the browser declines the credential", async () => {
		mocks.addPasskey.mockResolvedValue({
			data: null,
			error: { message: "Registration was cancelled" },
		});
		expect(await autoRegisterPasskey()).toBe(false);
	});

	it("reports failure when the result carries no stored passkey", async () => {
		mocks.addPasskey.mockResolvedValue({ data: null, error: null });
		expect(await autoRegisterPasskey()).toBe(false);
	});

	it("reports failure on a missing result", async () => {
		mocks.addPasskey.mockResolvedValue(undefined);
		expect(await autoRegisterPasskey()).toBe(false);
	});

	it("swallows a thrown registration rather than failing the sign-in", async () => {
		mocks.addPasskey.mockRejectedValue(new Error("NotAllowedError"));
		await expect(autoRegisterPasskey()).resolves.toBe(false);
	});

	it("never rejects, even when the capability probe throws", async () => {
		// Callers invoke this fire-and-forget, so a rejection would land as an
		// unhandled one on an otherwise successful sign-in.
		mocks.supportsAutomaticPasskeyRegistration.mockRejectedValue(
			new Error("probe exploded")
		);
		await expect(autoRegisterPasskey()).resolves.toBe(false);
		expect(mocks.addPasskey).not.toHaveBeenCalled();
	});
});

describe("offerAutomaticPasskey", () => {
	beforeEach(() => {
		mocks.addPasskey.mockReset();
		mocks.supportsAutomaticPasskeyRegistration.mockReset();
		mocks.supportsAutomaticPasskeyRegistration.mockResolvedValue(true);
		mocks.toastSuccess.mockReset();
	});

	it("returns without waiting on the ceremony", () => {
		mocks.addPasskey.mockReturnValue(new Promise(() => undefined));
		expect(offerAutomaticPasskey()).toBeUndefined();
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
	});

	it("announces a stored passkey once the ceremony settles", async () => {
		mocks.addPasskey.mockResolvedValue({ data: { id: "pk1" }, error: null });

		offerAutomaticPasskey();
		await vi.waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledTimes(1));
		expect(mocks.toastSuccess).toHaveBeenNthCalledWith(
			1,
			"Passkey saved for this device"
		);
	});

	it("stays silent when the browser declines the upgrade", async () => {
		mocks.addPasskey.mockResolvedValue({
			data: null,
			error: { message: "no" },
		});

		offerAutomaticPasskey();
		await vi.waitFor(() => expect(mocks.addPasskey).toHaveBeenCalledTimes(1));
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
	});

	it("stays silent, and never throws, when the browser cannot upgrade", async () => {
		mocks.supportsAutomaticPasskeyRegistration.mockResolvedValue(false);

		expect(() => offerAutomaticPasskey()).not.toThrow();
		await vi.waitFor(() =>
			expect(mocks.supportsAutomaticPasskeyRegistration).toHaveBeenCalledTimes(
				1
			)
		);
		expect(mocks.addPasskey).not.toHaveBeenCalled();
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
	});
});

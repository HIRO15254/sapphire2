import { afterEach, describe, expect, it, vi } from "vitest";
import {
	isCancelledCeremony,
	isPasskeySupported,
	supportsAutomaticPasskeyRegistration,
} from "@/shared/lib/webauthn";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

function setWindow(value: unknown): void {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value,
		writable: true,
	});
}

describe("isPasskeySupported", () => {
	afterEach(() => {
		if (originalWindow) {
			Object.defineProperty(globalThis, "window", originalWindow);
		} else {
			Reflect.deleteProperty(globalThis, "window");
		}
	});

	it("is true when the browser exposes PublicKeyCredential", () => {
		setWindow({ PublicKeyCredential: {} });
		expect(isPasskeySupported()).toBe(true);
	});

	it("is false when the window has no PublicKeyCredential", () => {
		setWindow({});
		expect(isPasskeySupported()).toBe(false);
	});

	it("is false with no window at all (SSR / worker contexts)", () => {
		Reflect.deleteProperty(globalThis, "window");
		expect(isPasskeySupported()).toBe(false);
	});
});

describe("supportsAutomaticPasskeyRegistration", () => {
	afterEach(() => {
		if (originalWindow) {
			Object.defineProperty(globalThis, "window", originalWindow);
		} else {
			Reflect.deleteProperty(globalThis, "window");
		}
	});

	it("is false without WebAuthn at all", async () => {
		setWindow({});
		expect(await supportsAutomaticPasskeyRegistration()).toBe(false);
	});

	it("is false on a WebAuthn browser that predates getClientCapabilities", async () => {
		setWindow({ PublicKeyCredential: {} });
		expect(await supportsAutomaticPasskeyRegistration()).toBe(false);
	});

	it("is false when the browser reports conditionalCreate: false", async () => {
		setWindow({
			PublicKeyCredential: {
				getClientCapabilities: vi.fn(async () => ({
					conditionalCreate: false,
					conditionalGet: true,
				})),
			},
		});
		expect(await supportsAutomaticPasskeyRegistration()).toBe(false);
	});

	it("is false when the capability is absent from the report", async () => {
		setWindow({
			PublicKeyCredential: {
				getClientCapabilities: vi.fn(async () => ({ conditionalGet: true })),
			},
		});
		expect(await supportsAutomaticPasskeyRegistration()).toBe(false);
	});

	it("is false when the report itself is undefined", async () => {
		setWindow({
			PublicKeyCredential: {
				getClientCapabilities: vi.fn(async () => undefined),
			},
		});
		expect(await supportsAutomaticPasskeyRegistration()).toBe(false);
	});

	it("is false when the capability probe rejects", async () => {
		setWindow({
			PublicKeyCredential: {
				getClientCapabilities: vi.fn(() =>
					Promise.reject(new Error("not allowed"))
				),
			},
		});
		expect(await supportsAutomaticPasskeyRegistration()).toBe(false);
	});

	it("is true only when the browser reports conditionalCreate", async () => {
		const getClientCapabilities = vi.fn(async () => ({
			conditionalCreate: true,
		}));
		setWindow({ PublicKeyCredential: { getClientCapabilities } });
		expect(await supportsAutomaticPasskeyRegistration()).toBe(true);
		expect(getClientCapabilities).toHaveBeenCalledTimes(1);
	});
});

describe("isCancelledCeremony", () => {
	it.each([
		"AUTH_CANCELLED",
		"ERROR_CEREMONY_ABORTED",
		"NotAllowedError",
		"AbortError",
		"ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
	])("treats %s as the user dismissing the prompt", (code) => {
		expect(isCancelledCeremony({ code })).toBe(true);
	});

	it.each([
		"PASSKEY_NOT_FOUND",
		"FAILED_TO_VERIFY_REGISTRATION",
		"UNKNOWN_ERROR",
	])("treats %s as a real failure", (code) => {
		expect(isCancelledCeremony({ code })).toBe(false);
	});

	it("is false for an error with no code", () => {
		expect(isCancelledCeremony({ message: "boom" })).toBe(false);
	});

	it("is false for a non-string code", () => {
		expect(isCancelledCeremony({ code: 400 })).toBe(false);
	});

	it("recognizes a real DOMException by name, whose code is a legacy number", () => {
		const aborted = new DOMException("aborted", "AbortError");
		expect(aborted.code).not.toBe("AbortError");
		expect(isCancelledCeremony(aborted)).toBe(true);
		expect(
			isCancelledCeremony(new DOMException("denied", "NotAllowedError"))
		).toBe(true);
	});

	it("is false for a DOMException that is not a cancellation", () => {
		expect(
			isCancelledCeremony(new DOMException("bad", "InvalidStateError"))
		).toBe(false);
	});

	it("is false for null and undefined", () => {
		expect(isCancelledCeremony(null)).toBe(false);
		expect(isCancelledCeremony(undefined)).toBe(false);
	});
});

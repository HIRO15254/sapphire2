import { afterEach, describe, expect, it, vi } from "vitest";
import {
	isPasskeySupported,
	supportsAutomaticPasskeyRegistration,
} from "@/shared/lib/webauthn";

// Runs in the node project (see vitest.node.config.ts), so `window` does not
// exist unless a test defines it — which is exactly the third branch below.
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
		// Only presence is checked, so any marker value will do.
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
		// The dangerous case: these browsers ignore `mediation: "conditional"`
		// and would show a modal create prompt instead of upgrading silently.
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

import { afterEach, describe, expect, it } from "vitest";
import { isPasskeySupported } from "@/shared/lib/webauthn";

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

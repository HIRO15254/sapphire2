import { afterEach, describe, expect, it, vi } from "vitest";
import {
	isAutomaticPasskeyOptedOut,
	setAutomaticPasskeyOptOut,
} from "@/shared/lib/passkey-opt-out";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

function setStorage(storage: unknown): void {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: { localStorage: storage },
		writable: true,
	});
}

function createMemoryStorage() {
	const entries = new Map<string, string>();
	return {
		entries,
		getItem: vi.fn((key: string) => entries.get(key) ?? null),
		removeItem: vi.fn((key: string) => {
			entries.delete(key);
		}),
		setItem: vi.fn((key: string, value: string) => {
			entries.set(key, value);
		}),
	};
}

describe("passkey auto-register opt-out", () => {
	afterEach(() => {
		if (originalWindow) {
			Object.defineProperty(globalThis, "window", originalWindow);
		} else {
			Reflect.deleteProperty(globalThis, "window");
		}
	});

	it("is not opted out by default", () => {
		setStorage(createMemoryStorage());
		expect(isAutomaticPasskeyOptedOut()).toBe(false);
	});

	it("round-trips an opt-out", () => {
		setStorage(createMemoryStorage());
		setAutomaticPasskeyOptOut(true);
		expect(isAutomaticPasskeyOptedOut()).toBe(true);
	});

	it("clears the opt-out again", () => {
		setStorage(createMemoryStorage());
		setAutomaticPasskeyOptOut(true);
		setAutomaticPasskeyOptOut(false);
		expect(isAutomaticPasskeyOptedOut()).toBe(false);
	});

	it("removes the key rather than storing a falsy value", () => {
		const storage = createMemoryStorage();
		setStorage(storage);
		setAutomaticPasskeyOptOut(false);
		expect(storage.removeItem).toHaveBeenCalledTimes(1);
		expect(storage.setItem).not.toHaveBeenCalled();
	});

	it("ignores a stored value that is not the opt-out marker", () => {
		const storage = createMemoryStorage();
		storage.entries.set("sapphire2:passkey-auto-register-opt-out", "0");
		setStorage(storage);
		expect(isAutomaticPasskeyOptedOut()).toBe(false);
	});

	it("reads false when storage throws (private mode, blocked cookies)", () => {
		setStorage({
			getItem: () => {
				throw new Error("SecurityError");
			},
		});
		expect(isAutomaticPasskeyOptedOut()).toBe(false);
	});

	it("stays opted in when storage rejects the opt-out write", () => {
		setStorage({
			getItem: () => null,
			removeItem: () => undefined,
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		});
		setAutomaticPasskeyOptOut(true);
		expect(isAutomaticPasskeyOptedOut()).toBe(false);
	});

	it("reads false with no window at all", () => {
		Reflect.deleteProperty(globalThis, "window");
		expect(isAutomaticPasskeyOptedOut()).toBe(false);
	});
});

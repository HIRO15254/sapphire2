import { runUserCreatedHook } from "@sapphire2/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// runUserCreatedHook lives in packages/auth (no vitest project of its own —
// see AGENTS.md's vitest workspace list) but packages/api already depends on
// @sapphire2/auth, so it's exercised from here (c13).
describe("runUserCreatedHook (signup must survive a failing onUserCreated, c13)", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// swallow — asserted on below
		});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	it("does not propagate when onUserCreated (e.g. seedDefaultGameData) rejects", async () => {
		const onUserCreated = vi
			.fn()
			.mockRejectedValue(new Error("seed insert failed"));
		await expect(
			runUserCreatedHook({ onUserCreated }, { id: "user-1" })
		).resolves.toBeUndefined();
		expect(onUserCreated).toHaveBeenCalledTimes(1);
		expect(onUserCreated).toHaveBeenNthCalledWith(1, "user-1");
	});

	it("logs the failure via console.error instead of swallowing it silently", async () => {
		const error = new Error("seed insert failed");
		const onUserCreated = vi.fn().mockRejectedValue(error);
		await runUserCreatedHook({ onUserCreated }, { id: "user-1" });
		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
		expect(consoleErrorSpy.mock.calls[0]).toContain(error);
	});

	it("still calls onUserCreated and resolves when it succeeds", async () => {
		const onUserCreated = vi.fn().mockResolvedValue(undefined);
		await expect(
			runUserCreatedHook({ onUserCreated }, { id: "user-1" })
		).resolves.toBeUndefined();
		expect(onUserCreated).toHaveBeenCalledTimes(1);
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	it("resolves without calling console.error when onUserCreated is undefined", async () => {
		await expect(
			runUserCreatedHook({}, { id: "user-1" })
		).resolves.toBeUndefined();
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});
});

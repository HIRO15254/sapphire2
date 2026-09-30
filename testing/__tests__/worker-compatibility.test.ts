import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readWorkerCompatibility } from "../worker-compatibility";

let configPath: string;

beforeEach(() => {
	configPath = path.join(
		mkdtempSync(path.join(tmpdir(), "sapphire-worker-compatibility-")),
		"wrangler.toml"
	);
});

afterEach(() => {
	unlinkSync(configPath);
	rmdirSync(path.dirname(configPath));
});

it("reads both the date and all flags from the Worker configuration", () => {
	writeFileSync(
		configPath,
		[
			'compatibility_date = "2025-02-14"',
			'compatibility_flags = ["nodejs_compat", "nodejs_compat_populate_process_env"]',
		].join("\n")
	);

	expect(readWorkerCompatibility(configPath)).toEqual({
		compatibilityDate: "2025-02-14",
		compatibilityFlags: ["nodejs_compat", "nodejs_compat_populate_process_env"],
	});
});

it("rejects a configuration without an explicit compatibility date", () => {
	writeFileSync(configPath, 'compatibility_flags = ["nodejs_compat"]');

	expect(() => readWorkerCompatibility(configPath)).toThrow(
		`Missing compatibility_date in ${configPath}`
	);
});

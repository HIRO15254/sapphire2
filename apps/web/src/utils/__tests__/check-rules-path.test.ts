import { normalizeRulePath } from "../../../../../scripts/check-rules-path";

describe("normalizeRulePath", () => {
	it("normalizes Windows separators for path-based rule exclusions", () => {
		expect(
			normalizeRulePath("apps\\web\\src\\components\\example\\use-example.tsx")
		).toBe("apps/web/src/components/example/use-example.tsx");
	});

	it("leaves POSIX paths unchanged", () => {
		expect(
			normalizeRulePath("apps/web/src/components/example/use-example.tsx")
		).toBe("apps/web/src/components/example/use-example.tsx");
	});

	it("normalizes every separator in a mixed path", () => {
		expect(normalizeRulePath("apps\\web/src\\components/example.tsx")).toBe(
			"apps/web/src/components/example.tsx"
		);
	});

	it("accepts an empty path", () => {
		expect(normalizeRulePath("")).toBe("");
	});
});

import {
	findSmokeOnlyTests,
	maskNonCode,
} from "../../../../../scripts/check-rules-tests";

const block = (name: string, body: string[]) => [
	`\tit("${name}", () => {`,
	...body.map((line) => `\t\t${line}`),
	"\t});",
];

const file = (...blocks: string[][]) =>
	['describe("suite", () => {', ...blocks.flat(), "});", ""].join("\n");

describe("findSmokeOnlyTests", () => {
	it("flags an it() whose only expect ends in toBeDefined", () => {
		const text = file(
			block("has list procedure", ["expect(router.list).toBeDefined();"])
		);
		expect(findSmokeOnlyTests(text)).toEqual([
			{ line: 2, name: "has list procedure" },
		]);
	});

	it("flags a block whose expects end in toBeTruthy and resolves.toBeDefined", () => {
		const text = file(
			block("smoke", [
				"expect(flag).toBeTruthy();",
				"await expect(promise).resolves.toBeDefined();",
			])
		);
		expect(findSmokeOnlyTests(text)).toEqual([{ line: 2, name: "smoke" }]);
	});

	it("does not flag a block whose only matcher is not.toThrow", () => {
		const text = file(
			block("applies", ["expect(() => db.exec(sql)).not.toThrow();"])
		);
		expect(findSmokeOnlyTests(text)).toEqual([]);
	});

	it("does not flag a block that also asserts a value", () => {
		const text = file(
			block("mixed", [
				"expect(result).toBeDefined();",
				"expect(result.id).toEqual(1);",
			])
		);
		expect(findSmokeOnlyTests(text)).toEqual([]);
	});

	it("does not flag a block with no expect call", () => {
		const text = file(block("helper", ["expectRejects(schema, {});"]));
		expect(findSmokeOnlyTests(text)).toEqual([]);
	});

	it("ignores an it( inside a template literal and reports the right line for the next block", () => {
		const text = file(
			block("template", [
				'const source = `it("fake", () => {',
				"expect(a).toBeDefined();",
				"});`;",
				"expect(source).toEqual(source);",
			]),
			block("real", ["expect(b).toBeDefined();"])
		);
		expect(findSmokeOnlyTests(text)).toEqual([{ line: 8, name: "real" }]);
	});

	it("handles it.each(rows)(name, fn) and names the block from the second call", () => {
		const text = [
			'describe("suite", () => {',
			'\tit.each(["a", "b"])("exists for %s", (key) => {',
			"\t\texpect(table[key]).toBeDefined();",
			"\t});",
			"});",
			"",
		].join("\n");
		expect(findSmokeOnlyTests(text)).toEqual([
			{ line: 2, name: "exists for %s" },
		]);
	});

	it("does not treat a RegExp test() call as a block start", () => {
		const text = file(
			block("regex", ["expect(PATTERN.test(value)).toBe(true);"])
		);
		expect(findSmokeOnlyTests(text)).toEqual([]);
	});

	it("treats a regex literal containing parens as opaque", () => {
		const text = file(
			block("opaque", [
				"expect(label).toMatch(/a\\(b/);",
				"expect(other).toBeDefined();",
			])
		);
		expect(findSmokeOnlyTests(text)).toEqual([]);
	});

	it("keeps a mixed-matcher block unflagged when a smoke matcher comes last", () => {
		const text = file(
			block("order", ["expect(a.name).toBe('x');", "expect(a).toBeDefined();"])
		);
		expect(findSmokeOnlyTests(text)).toEqual([]);
	});
});

describe("maskNonCode", () => {
	it("keeps length and newlines while blanking strings, comments and regex bodies", () => {
		const text = [
			'const a = "it(";',
			"const b = /it\\(/; const c = 4 / 2;",
			"let d = 1; ",
		].join("\n");
		const masked = maskNonCode(text);
		expect(masked.length).toBe(text.length);
		expect(masked.split("\n").length).toBe(3);
		expect(masked).not.toContain("it(");
		expect(masked).toContain("const c = 4 / 2;");
	});
});

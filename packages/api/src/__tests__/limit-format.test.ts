import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("limitFormat router structure", () => {
	it("appRouter has limitFormat namespace", () => {
		expect(appRouter.limitFormat).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.limitFormat).sort()).toEqual(
			["list", "create", "update", "delete"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.limitFormat.list);
		expectType(appRouter.limitFormat.list, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.limitFormat.create,
			appRouter.limitFormat.update,
			appRouter.limitFormat.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("limitFormat.list input validation", () => {
	it("accepts no input (undefined)", () => {
		// list takes no input — passing undefined is fine
		expect(appRouter.limitFormat.list).toBeDefined();
	});
});

describe("limitFormat.create input validation", () => {
	it("accepts minimal valid payload (name + required labels)", () => {
		expectAccepts(appRouter.limitFormat.create, {
			name: "NL",
			blind1Label: "Small blind",
			blind2Label: "Big blind",
		});
	});

	it("accepts full payload with all optional fields", () => {
		expectAccepts(appRouter.limitFormat.create, {
			name: "Stud",
			blind1Label: "Bring in",
			blind2Label: "Complete",
			blind3Label: "Small Bet",
			blind4Label: "Big Bet",
			sortOrder: 5,
		});
	});

	it("defaults sortOrder to 0 when omitted", () => {
		const schema = appRouter.limitFormat.create._def.inputs[0] as {
			safeParse: (v: unknown) => {
				success: boolean;
				data: { sortOrder: number };
			};
		};
		const result = schema.safeParse({
			name: "FL",
			blind1Label: "Small Bet",
			blind2Label: "Big Bet",
		});
		expect(result.success).toBe(true);
		expect(result.data.sortOrder).toBe(0);
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.limitFormat.create, {
			name: "",
			blind1Label: "SB",
			blind2Label: "BB",
		});
	});

	it("rejects empty blind1Label", () => {
		expectRejects(appRouter.limitFormat.create, {
			name: "NL",
			blind1Label: "",
			blind2Label: "BB",
		});
	});

	it("rejects empty blind2Label", () => {
		expectRejects(appRouter.limitFormat.create, {
			name: "NL",
			blind1Label: "SB",
			blind2Label: "",
		});
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.limitFormat.create, {
			blind1Label: "SB",
			blind2Label: "BB",
		});
	});

	it("rejects missing blind1Label", () => {
		expectRejects(appRouter.limitFormat.create, {
			name: "NL",
			blind2Label: "BB",
		});
	});

	it("rejects missing blind2Label", () => {
		expectRejects(appRouter.limitFormat.create, {
			name: "NL",
			blind1Label: "SB",
		});
	});

	it("rejects negative sortOrder", () => {
		expectRejects(appRouter.limitFormat.create, {
			name: "NL",
			blind1Label: "SB",
			blind2Label: "BB",
			sortOrder: -1,
		});
	});
});

describe("limitFormat.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.limitFormat.update, { id: 1 });
	});

	it("accepts all optional fields", () => {
		expectAccepts(appRouter.limitFormat.update, {
			id: 1,
			name: "PL",
			blind1Label: "Small blind",
			blind2Label: "Big blind",
			blind3Label: "Straddle",
			blind4Label: "Straddle2",
			sortOrder: 2,
		});
	});

	it("accepts null for optional label fields", () => {
		expectAccepts(appRouter.limitFormat.update, {
			id: 1,
			blind3Label: null,
			blind4Label: null,
		});
	});

	it("rejects empty name when provided", () => {
		expectRejects(appRouter.limitFormat.update, {
			id: 1,
			name: "",
		});
	});

	it("rejects empty blind1Label when provided", () => {
		expectRejects(appRouter.limitFormat.update, {
			id: 1,
			blind1Label: "",
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.limitFormat.update, { name: "NL" });
	});

	it("rejects string id", () => {
		expectRejects(appRouter.limitFormat.update, { id: "1", name: "NL" });
	});

	it("rejects negative sortOrder", () => {
		expectRejects(appRouter.limitFormat.update, {
			id: 1,
			sortOrder: -1,
		});
	});
});

describe("limitFormat.delete input validation", () => {
	it("accepts {id: number}", () => {
		expectAccepts(appRouter.limitFormat.delete, { id: 1 });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.limitFormat.delete, {});
	});

	it("rejects string id", () => {
		expectRejects(appRouter.limitFormat.delete, { id: "1" });
	});

	it("rejects non-integer id", () => {
		expectRejects(appRouter.limitFormat.delete, { id: 1.5 });
	});
});

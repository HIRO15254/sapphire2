import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	getDefaultWidgetConfig,
	parseWidgetConfig,
	stringifyWidgetConfig,
	widgetTypeSchema,
} from "../types/dashboard-widget";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("dashboardWidget router", () => {
	it("appRouter has dashboardWidget namespace", () => {
		expect(appRouter.dashboardWidget).toBeDefined();
	});

	it("exposes list/create/update/updateLayouts/delete procedures", () => {
		const keys = Object.keys(appRouter.dashboardWidget);
		expect(keys).toEqual(
			expect.arrayContaining([
				"list",
				"create",
				"update",
				"updateLayouts",
				"delete",
			])
		);
	});

	it("exposes exactly the expected procedure set (no extras)", () => {
		expect(Object.keys(appRouter.dashboardWidget).sort()).toEqual(
			["create", "delete", "list", "update", "updateLayouts"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.dashboardWidget.list);
		expectType(appRouter.dashboardWidget.list, "query");
	});

	it("all mutations are protected mutations", () => {
		for (const name of [
			"create",
			"update",
			"updateLayouts",
			"delete",
		] as const) {
			const proc = appRouter.dashboardWidget[name];
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("dashboardWidget.list input validation", () => {
	it("accepts device=desktop", () => {
		expectAccepts(appRouter.dashboardWidget.list, { device: "desktop" });
	});

	it("accepts device=mobile", () => {
		expectAccepts(appRouter.dashboardWidget.list, { device: "mobile" });
	});

	it("rejects unknown device value", () => {
		expectRejects(appRouter.dashboardWidget.list, { device: "tablet" });
	});

	it("rejects missing device", () => {
		expectRejects(appRouter.dashboardWidget.list, {});
	});
});

describe("dashboardWidget.create input validation", () => {
	it("accepts a valid widget creation payload", () => {
		expectAccepts(appRouter.dashboardWidget.create, {
			device: "desktop",
			type: widgetTypeSchema.options[0],
		});
	});

	it("accepts config and position", () => {
		expectAccepts(appRouter.dashboardWidget.create, {
			device: "mobile",
			type: widgetTypeSchema.options[0],
			config: { foo: "bar" },
			position: { x: 0, y: 0, w: 4, h: 2 },
		});
	});

	it("rejects unknown widget type", () => {
		expectRejects(appRouter.dashboardWidget.create, {
			device: "desktop",
			type: "nonexistent_widget",
		});
	});

	it("rejects position with w=0", () => {
		expectRejects(appRouter.dashboardWidget.create, {
			device: "desktop",
			type: widgetTypeSchema.options[0],
			position: { x: 0, y: 0, w: 0, h: 2 },
		});
	});

	it("rejects position with negative x", () => {
		expectRejects(appRouter.dashboardWidget.create, {
			device: "desktop",
			type: widgetTypeSchema.options[0],
			position: { x: -1, y: 0, w: 4, h: 2 },
		});
	});
});

describe("dashboardWidget.update input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.dashboardWidget.update, { id: "w1" });
	});

	it("accepts config update", () => {
		expectAccepts(appRouter.dashboardWidget.update, {
			id: "w1",
			config: { limit: 10 },
		});
	});

	it("accepts position update", () => {
		expectAccepts(appRouter.dashboardWidget.update, {
			id: "w1",
			position: { x: 2, y: 3, w: 4, h: 2 },
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.dashboardWidget.update, {
			config: { limit: 10 },
		});
	});
});

describe("dashboardWidget.updateLayouts input validation", () => {
	it("accepts a single-item layout batch", () => {
		expectAccepts(appRouter.dashboardWidget.updateLayouts, {
			device: "desktop",
			items: [{ id: "w1", x: 0, y: 0, w: 4, h: 2 }],
		});
	});

	it("rejects empty items array (.min(1))", () => {
		expectRejects(appRouter.dashboardWidget.updateLayouts, {
			device: "desktop",
			items: [],
		});
	});

	it("rejects items with non-integer x", () => {
		expectRejects(appRouter.dashboardWidget.updateLayouts, {
			device: "desktop",
			items: [{ id: "w1", x: 1.5, y: 0, w: 4, h: 2 }],
		});
	});

	it("rejects items with w<1", () => {
		expectRejects(appRouter.dashboardWidget.updateLayouts, {
			device: "desktop",
			items: [{ id: "w1", x: 0, y: 0, w: 0, h: 2 }],
		});
	});

	it("rejects items with negative y", () => {
		expectRejects(appRouter.dashboardWidget.updateLayouts, {
			device: "desktop",
			items: [{ id: "w1", x: 0, y: -1, w: 4, h: 2 }],
		});
	});
});

describe("dashboardWidget.delete input validation", () => {
	it("accepts valid id", () => {
		expectAccepts(appRouter.dashboardWidget.delete, { id: "w1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.dashboardWidget.delete, {});
	});
});

describe("widget config parsing", () => {
	it("returns defaults for each widget type when config is empty", () => {
		for (const type of widgetTypeSchema.options) {
			const defaults = getDefaultWidgetConfig(type);
			expect(defaults).toBeDefined();
			expect(typeof defaults).toBe("object");
		}
	});

	it("returns safe defaults when JSON is corrupted", () => {
		const parsed = parseWidgetConfig("summary_stats", "{not valid json}");
		expect(parsed).toBeDefined();
		expect(Array.isArray((parsed as { metrics: unknown }).metrics)).toBe(true);
	});

	it("returns safe defaults when JSON is missing fields", () => {
		const parsed = parseWidgetConfig("recent_sessions", "{}");
		expect((parsed as { limit: number }).limit).toBe(5);
		expect((parsed as { type: string }).type).toBe("all");
	});

	it("returns pnl_graph defaults with currency unit and date axis", () => {
		const parsed = parseWidgetConfig("pnl_graph", "{}") as {
			currencyId: string | null;
			dateRangeDays: number | null;
			ringGameId: string | null;
			sessionType: string;
			showFilters: Record<string, boolean>;
			storeId: string | null;
			unit: string;
			xAxis: string;
		};
		expect(parsed.xAxis).toBe("date");
		expect(parsed.dateRangeDays).toBeNull();
		expect(parsed.sessionType).toBe("all");
		expect(parsed.unit).toBe("currency");
		expect(parsed.storeId).toBeNull();
		expect(parsed.ringGameId).toBeNull();
		expect(parsed.currencyId).toBeNull();
		expect(parsed.showFilters.xAxis).toBe(false);
	});

	it("preserves valid pnl_graph config values", () => {
		const parsed = parseWidgetConfig(
			"pnl_graph",
			JSON.stringify({
				xAxis: "playTime",
				dateRangeDays: 30,
				sessionType: "cash_game",
				unit: "normalized",
				storeId: "s1",
				ringGameId: "rg1",
				currencyId: "c1",
				showFilters: { xAxis: true, unit: true },
			})
		) as {
			ringGameId: string | null;
			showFilters: Record<string, boolean>;
			storeId: string | null;
			unit: string;
			xAxis: string;
		};
		expect(parsed.xAxis).toBe("playTime");
		expect(parsed.unit).toBe("normalized");
		expect(parsed.storeId).toBe("s1");
		expect(parsed.ringGameId).toBe("rg1");
		expect(parsed.showFilters.xAxis).toBe(true);
		expect(parsed.showFilters.unit).toBe(true);
		expect(parsed.showFilters.dateRange).toBe(false);
	});

	it("falls back to defaults for invalid pnl_graph enum values, including legacy 'bb'/'bi'", () => {
		const parsed = parseWidgetConfig(
			"pnl_graph",
			JSON.stringify({ xAxis: "weird", unit: "bb" })
		) as { unit: string; xAxis: string };
		expect(parsed.xAxis).toBe("date");
		expect(parsed.unit).toBe("currency");
	});

	it("stringifies config safely", () => {
		expect(stringifyWidgetConfig({ foo: "bar" })).toBe('{"foo":"bar"}');
		expect(stringifyWidgetConfig(null)).toBe("{}");
		expect(stringifyWidgetConfig(undefined)).toBe("{}");
	});
});

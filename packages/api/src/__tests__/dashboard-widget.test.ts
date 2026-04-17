import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	getDefaultWidgetConfig,
	parseWidgetConfig,
	stringifyWidgetConfig,
	widgetTypeSchema,
} from "../types/dashboard-widget";

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

	it("stringifies config safely", () => {
		expect(stringifyWidgetConfig({ foo: "bar" })).toBe('{"foo":"bar"}');
		expect(stringifyWidgetConfig(null)).toBe("{}");
		expect(stringifyWidgetConfig(undefined)).toBe("{}");
	});
});

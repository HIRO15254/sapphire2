import { z } from "zod";

export const deviceSchema = z.enum(["mobile", "desktop"]);
export type Device = z.infer<typeof deviceSchema>;

export const widgetTypeSchema = z.enum([
	"summary_stats",
	"recent_sessions",
	"active_session",
	"currency_balance",
	"pnl_graph",
]);
export type WidgetType = z.infer<typeof widgetTypeSchema>;

export const widgetPositionSchema = z.object({
	x: z.number().int().min(0),
	y: z.number().int().min(0),
	w: z.number().int().min(1),
	h: z.number().int().min(1),
});
export type WidgetPosition = z.infer<typeof widgetPositionSchema>;

export const summaryStatsConfigSchema = z.object({
	metrics: z
		.array(
			z.enum([
				"totalSessions",
				"totalProfitLoss",
				"winRate",
				"avgProfitLoss",
				"totalEvProfitLoss",
				"totalEvDiff",
			])
		)
		.default(["totalSessions", "totalProfitLoss", "winRate", "avgProfitLoss"]),
	type: z.enum(["all", "cash_game", "tournament"]).default("all"),
	dateRangeDays: z.number().int().min(1).max(3650).nullable().default(null),
});
export type SummaryStatsConfig = z.infer<typeof summaryStatsConfigSchema>;

export const recentSessionsConfigSchema = z.object({
	limit: z.number().int().min(1).max(20).default(5),
	type: z.enum(["all", "cash_game", "tournament"]).default("all"),
});
export type RecentSessionsConfig = z.infer<typeof recentSessionsConfigSchema>;

export const activeSessionConfigSchema = z.object({
	sessionType: z.enum(["all", "cash_game", "tournament"]).default("all"),
});
export type ActiveSessionConfig = z.infer<typeof activeSessionConfigSchema>;

export const currencyBalanceConfigSchema = z.object({
	currencyId: z.string().nullable().default(null),
});
export type CurrencyBalanceConfig = z.infer<typeof currencyBalanceConfigSchema>;

export const pnlGraphXAxisSchema = z.enum(["date", "sessionCount", "playTime"]);
export type PnlGraphXAxis = z.infer<typeof pnlGraphXAxisSchema>;

export const pnlGraphSessionTypeSchema = z.enum([
	"all",
	"cash_game",
	"tournament",
]);
export type PnlGraphSessionType = z.infer<typeof pnlGraphSessionTypeSchema>;

export const pnlGraphUnitSchema = z.enum(["currency", "normalized"]);
export type PnlGraphUnit = z.infer<typeof pnlGraphUnitSchema>;

const pnlGraphFilterFlagsSchema = z
	.object({
		xAxis: z.boolean().default(false),
		dateRange: z.boolean().default(false),
		sessionType: z.boolean().default(false),
		unit: z.boolean().default(false),
		store: z.boolean().default(false),
		currency: z.boolean().default(false),
	})
	.default({
		xAxis: false,
		dateRange: false,
		sessionType: false,
		unit: false,
		store: false,
		currency: false,
	});

export const pnlGraphConfigSchema = z.object({
	xAxis: pnlGraphXAxisSchema.default("date"),
	dateRangeDays: z.number().int().min(1).max(3650).nullable().default(null),
	sessionType: pnlGraphSessionTypeSchema.default("all"),
	unit: pnlGraphUnitSchema.default("currency"),
	storeId: z.string().nullable().default(null),
	ringGameId: z.string().nullable().default(null),
	currencyId: z.string().nullable().default(null),
	showEvCash: z.boolean().default(false),
	showFilters: pnlGraphFilterFlagsSchema,
});
export type PnlGraphConfig = z.infer<typeof pnlGraphConfigSchema>;

export const widgetConfigSchema = z.union([
	summaryStatsConfigSchema,
	recentSessionsConfigSchema,
	activeSessionConfigSchema,
	currencyBalanceConfigSchema,
	pnlGraphConfigSchema,
]);

const configSchemaByType = {
	summary_stats: summaryStatsConfigSchema,
	recent_sessions: recentSessionsConfigSchema,
	active_session: activeSessionConfigSchema,
	currency_balance: currencyBalanceConfigSchema,
	pnl_graph: pnlGraphConfigSchema,
} as const;

export function parseWidgetConfig(
	type: WidgetType,
	rawConfig: string | null | undefined
): Record<string, unknown> {
	let parsed: unknown = {};
	if (typeof rawConfig === "string" && rawConfig.length > 0) {
		try {
			parsed = JSON.parse(rawConfig);
		} catch {
			parsed = {};
		}
	}
	const schema = configSchemaByType[type];
	const result = schema.safeParse(parsed);
	if (result.success) {
		return result.data as Record<string, unknown>;
	}
	const defaults = schema.safeParse({});
	return (defaults.success ? defaults.data : {}) as Record<string, unknown>;
}

export function getDefaultWidgetConfig(
	type: WidgetType
): Record<string, unknown> {
	const schema = configSchemaByType[type];
	const result = schema.safeParse({});
	return (result.success ? result.data : {}) as Record<string, unknown>;
}

export function stringifyWidgetConfig(config: unknown): string {
	try {
		return JSON.stringify(config ?? {});
	} catch {
		return "{}";
	}
}

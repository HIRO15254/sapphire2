import z from "zod";

export const FILTER_PRESET_SCREEN_KEYS = ["sessions", "statistics"] as const;

export const filterPresetScreenKeySchema = z.enum(FILTER_PRESET_SCREEN_KEYS);

export type FilterPresetScreenKey = z.infer<typeof filterPresetScreenKeySchema>;

export const presetNameSchema = z.string().trim().min(1).max(50);

const periodSchema = z.string().min(1).max(30);

export const sessionsFilterPresetPayloadSchema = z
	.object({
		period: periodSchema.optional(),
		from: z.number().int().optional(),
		to: z.number().int().optional(),
		type: z.enum(["cash_game", "tournament"]).optional(),
		roomId: z.string().min(1).optional(),
		currencyId: z.string().min(1).optional(),
		display: z.enum(["currency", "normalized"]).optional(),
	})
	.strict();

export type SessionsFilterPresetPayload = z.infer<
	typeof sessionsFilterPresetPayloadSchema
>;

export const statisticsFilterPresetPayloadSchema = z
	.object({
		period: periodSchema.optional(),
		from: z.number().int().optional(),
		to: z.number().int().optional(),
		currency: z.string().min(1).optional(),
		norm: z.enum(["off", "normalized"]).optional(),
		type: z.enum(["all", "cash_game", "tournament"]).optional(),
		room: z.string().min(1).optional(),
	})
	.strict();

export type StatisticsFilterPresetPayload = z.infer<
	typeof statisticsFilterPresetPayloadSchema
>;

export type FilterPresetPayload =
	| SessionsFilterPresetPayload
	| StatisticsFilterPresetPayload;

export function payloadSchemaForScreenKey(
	screenKey: "sessions"
): typeof sessionsFilterPresetPayloadSchema;
export function payloadSchemaForScreenKey(
	screenKey: "statistics"
): typeof statisticsFilterPresetPayloadSchema;
export function payloadSchemaForScreenKey(screenKey: FilterPresetScreenKey) {
	if (screenKey === "sessions") {
		return sessionsFilterPresetPayloadSchema;
	}
	return statisticsFilterPresetPayloadSchema;
}

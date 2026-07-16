// Shared write=read Zod schemas for saved "filter preset" payloads. A preset
// stores the filter state of one screen (sessions list, statistics) so a
// user can reapply it later. Stored as JSON on filter_preset.payload
// (packages/db/src/schema/filter-preset.ts). db, api, and web must all
// validate through these exact objects — never a looser inline copy
// (api-data-integrity.md).
//
// Layering note: packages/db must not import from apps/web. The fuller
// period vocabulary (e.g. "this_month", "last_7_days", ...) lives in
// apps/web/src/shared/lib/period-filter.ts, out of reach here — period is
// therefore validated only as a bounded non-empty string in this file.
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

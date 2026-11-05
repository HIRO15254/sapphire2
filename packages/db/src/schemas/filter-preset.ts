import z from "zod";
import { refineStatsFilter, statsFilterShape } from "./stats-filter";

export const FILTER_PRESET_SCREEN_KEYS = ["sessions", "statistics"] as const;

export const filterPresetScreenKeySchema = z.enum(FILTER_PRESET_SCREEN_KEYS);

export type FilterPresetScreenKey = z.infer<typeof filterPresetScreenKeySchema>;

export const presetNameSchema = z.string().trim().min(1).max(50);

const periodSchema = z.string().min(1).max(30);

export const sessionsFilterPresetPayloadSchema = z
	.object({
		period: periodSchema.optional(),
		...statsFilterShape,
	})
	.strict()
	.superRefine((filter, ctx) =>
		refineStatsFilter(filter, ctx, { requireMode: false })
	);

export type SessionsFilterPresetPayload = z.infer<
	typeof sessionsFilterPresetPayloadSchema
>;

export const statisticsFilterPresetPayloadSchema = z
	.object({
		period: periodSchema.optional(),
		...statsFilterShape,
	})
	.strict()
	.superRefine((filter, ctx) =>
		refineStatsFilter(filter, ctx, { requireMode: true })
	);

export type StatisticsFilterPresetPayload = z.infer<
	typeof statisticsFilterPresetPayloadSchema
>;

export type FilterPresetPayload =
	| SessionsFilterPresetPayload
	| StatisticsFilterPresetPayload;

export function payloadSchemaForScreenKey(screenKey: FilterPresetScreenKey) {
	if (screenKey === "sessions") {
		return sessionsFilterPresetPayloadSchema;
	}
	return statisticsFilterPresetPayloadSchema;
}

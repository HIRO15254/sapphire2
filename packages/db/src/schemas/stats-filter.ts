import z from "zod";
import { ENTRY_KINDS } from "../constants/entry";
import { dateOnlySchema } from "./date-only";
import { idSchema } from "./id";
import { tagIdsSchema } from "./tag-ids";

const STATS_VALUATIONS = ["real", "virtual"] as const;
export type StatsValuation = (typeof STATS_VALUATIONS)[number];

export const statsFilterShape = {
	assetId: idSchema.optional(),
	baseAssetId: idSchema.optional(),
	dateFrom: dateOnlySchema.optional(),
	dateTo: dateOnlySchema.optional(),
	entryTagIds: tagIdsSchema.optional(),
	kind: z.enum(ENTRY_KINDS).optional(),
	normalized: z.boolean().optional(),
	roomId: idSchema.optional(),
	tournamentTagIds: tagIdsSchema.optional(),
	valuation: z.enum(STATS_VALUATIONS).optional(),
};

interface StatsFilterFields {
	assetId?: string;
	baseAssetId?: string;
	dateFrom?: string;
	dateTo?: string;
	normalized?: boolean;
	valuation?: StatsValuation;
}

type StatsMode = "asset" | "valuation" | "normalized";

function statsModesOf(filter: StatsFilterFields): StatsMode[] {
	const modes: StatsMode[] = [];
	if (filter.assetId !== undefined) {
		modes.push("asset");
	}
	if (filter.valuation !== undefined) {
		modes.push("valuation");
	}
	if (filter.normalized === true) {
		modes.push("normalized");
	}
	return modes;
}

export function refineStatsFilter(
	filter: StatsFilterFields,
	ctx: z.RefinementCtx,
	options: { requireMode: boolean }
): void {
	if (
		filter.dateFrom !== undefined &&
		filter.dateTo !== undefined &&
		filter.dateFrom > filter.dateTo
	) {
		ctx.addIssue({
			code: "custom",
			message: "dateFrom must not be after dateTo",
			path: ["dateTo"],
		});
	}
	if (filter.baseAssetId !== undefined && filter.valuation === undefined) {
		ctx.addIssue({
			code: "custom",
			message: "baseAssetId is only valid with valuation",
			path: ["baseAssetId"],
		});
	}
	const modes = statsModesOf(filter);
	if (modes.length > 1) {
		ctx.addIssue({
			code: "custom",
			message:
				"Choose exactly one stats mode: assetId, valuation, or normalized: true",
			path: [modes[1] === "normalized" ? "normalized" : "valuation"],
		});
	} else if (options.requireMode && modes.length === 0) {
		ctx.addIssue({
			code: "custom",
			message:
				"A stats mode is required: assetId, valuation, or normalized: true",
			path: ["normalized"],
		});
	}
}

const statsFilterObject = z.object(statsFilterShape);

export type StatsFilter = z.infer<typeof statsFilterObject>;

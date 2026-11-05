import { entryTag } from "@sapphire2/db/schema/entry-tag";
import { tournamentTag } from "@sapphire2/db/schema/tournament-tag";
import {
	refineStatsFilter,
	type StatsFilter,
	statsFilterShape,
} from "@sapphire2/db/schemas/stats-filter";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { protectedProcedure, router } from "../index";
import {
	validateEntityOwnership,
	validateTagsOwnership,
} from "../lib/ownership";
import {
	loadValuationTables,
	selectBaseAssetId,
} from "../services/entry-reads";
import {
	breakdownFacts,
	computeEntryFacts,
	STATS_GROUP_BY,
	type StatsMode,
	seriesPoints,
	statsCoverage,
	summarizeFacts,
} from "../services/stats";
import { loadStatsPopulation } from "../services/stats-data";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

export const statsInputSchema = z
	.object(statsFilterShape)
	.superRefine((filter, ctx) =>
		refineStatsFilter(filter, ctx, { requireMode: true })
	);

export const statsBreakdownInputSchema = z
	.object({ ...statsFilterShape, groupBy: z.enum(STATS_GROUP_BY) })
	.superRefine((filter, ctx) =>
		refineStatsFilter(filter, ctx, { requireMode: true })
	);

async function resolveMode(
	db: DbInstance,
	userId: string,
	filter: StatsFilter
): Promise<StatsMode> {
	if (filter.roomId) {
		await validateEntityOwnership(db, "room", filter.roomId, userId);
	}
	await validateTagsOwnership(db, entryTag, filter.entryTagIds, userId);
	await validateTagsOwnership(
		db,
		tournamentTag,
		filter.tournamentTagIds,
		userId
	);
	const userBaseAssetId = await selectBaseAssetId(db, userId);
	if (filter.assetId !== undefined) {
		await validateEntityOwnership(db, "asset", filter.assetId, userId);
		return { kind: "asset", assetId: filter.assetId, userBaseAssetId };
	}
	if (filter.valuation !== undefined) {
		const baseAssetId = filter.baseAssetId ?? userBaseAssetId;
		if (baseAssetId === null) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message:
					"Set a base asset in user settings or pass baseAssetId to use valuation",
			});
		}
		const base = await validateEntityOwnership(
			db,
			"asset",
			baseAssetId,
			userId
		);
		if (base.kind !== "currency") {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "The base asset must be a currency",
			});
		}
		return { kind: "valuation", valuation: filter.valuation, baseAssetId };
	}
	return { kind: "normalized", userBaseAssetId };
}

async function loadFacts(db: DbInstance, userId: string, filter: StatsFilter) {
	const mode = await resolveMode(db, userId, filter);
	const entries = await loadStatsPopulation(db, userId, filter);
	const tables = await loadValuationTables(db, userId);
	return { mode, facts: computeEntryFacts(entries, mode, tables) };
}

export const statsRouter = router({
	summary: protectedProcedure
		.input(statsInputSchema)
		.query(async ({ ctx, input }) => {
			const { mode, facts } = await loadFacts(
				ctx.db,
				ctx.session.user.id,
				input
			);
			return {
				mode: mode.kind,
				assetId: mode.kind === "asset" ? mode.assetId : null,
				valuation: mode.kind === "valuation" ? mode.valuation : null,
				baseAssetId: mode.kind === "valuation" ? mode.baseAssetId : null,
				...summarizeFacts(facts, mode),
			};
		}),

	breakdown: protectedProcedure
		.input(statsBreakdownInputSchema)
		.query(async ({ ctx, input }) => {
			const { mode, facts } = await loadFacts(
				ctx.db,
				ctx.session.user.id,
				input
			);
			return {
				groups: breakdownFacts(facts, mode, input.groupBy),
				coverage: statsCoverage(facts, mode),
			};
		}),

	profitLossSeries: protectedProcedure
		.input(statsInputSchema)
		.query(async ({ ctx, input }) => {
			const { mode, facts } = await loadFacts(
				ctx.db,
				ctx.session.user.id,
				input
			);
			return {
				points: seriesPoints(facts, mode),
				coverage: statsCoverage(facts, mode),
			};
		}),
});

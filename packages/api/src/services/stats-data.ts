import type { Database } from "@sapphire2/db";
import type { EntryKind } from "@sapphire2/db/constants/entry";
import { entry, entryCash, entryTournament } from "@sapphire2/db/schema/entry";
import { entryTagLink } from "@sapphire2/db/schema/entry-tag";
import { ledgerLine } from "@sapphire2/db/schema/ledger";
import { room } from "@sapphire2/db/schema/room";
import { tournamentRule } from "@sapphire2/db/schema/rule";
import { tournamentTagLink } from "@sapphire2/db/schema/tournament-tag";
import type { StatsFilter } from "@sapphire2/db/schemas/stats-filter";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import { selectInChunks } from "../lib/batch";
import { hydrateCashRules } from "./cash-rules";
import {
	cashBigBlind,
	countEntryHands,
	type EntryLine,
	groupBy,
	selectEntryLines,
	selectEntryPlaySessions,
} from "./entry-reads";
import {
	hydrateLineups,
	type LineupMap,
	type LineupOutput,
} from "./game-lineup";
import type { StakeValues } from "./rule-stakes";

const OWNER_SCOPED_CHUNK_EXTRA = 1;

export interface StatsPlay {
	breakMinutes: number;
	endedAt: Date | null;
	startedAt: Date | null;
}

export interface StatsBucket {
	key: string;
	label: string;
}

export interface StatsEntry {
	assetId: string | null;
	bigBlind: number | null;
	evDiff: number | null;
	handCount: number;
	id: string;
	kind: EntryKind;
	lines: EntryLine[];
	placement: number | null;
	playedOn: string;
	plays: StatsPlay[];
	roomId: string | null;
	roomName: string | null;
	stakes: StatsBucket;
	variant: StatsBucket;
}

const CUSTOM_MIX: StatsBucket = { key: "custom", label: "Custom mix" };
const MULTI_GROUP_STAKES: StatsBucket = {
	key: "multi-group",
	label: "Multiple game groups",
};
const TOURNAMENT_STAKES: StatsBucket = {
	key: "tournament",
	label: "Tournament (no stakes)",
};

function variantBucket(lineup: LineupOutput | undefined): StatsBucket {
	if (!lineup) {
		return CUSTOM_MIX;
	}
	if (lineup.gameMixId) {
		return { key: `mix:${lineup.gameMixId}`, label: lineup.displayName };
	}
	const [onlyGroup, ...otherGroups] = lineup.groups;
	const [onlyVariant, ...otherVariants] = onlyGroup?.variants ?? [];
	if (onlyVariant && otherGroups.length === 0 && otherVariants.length === 0) {
		return { key: `variant:${onlyVariant.id}`, label: lineup.displayName };
	}
	return CUSTOM_MIX;
}

function formatStake(stake: StakeValues): string {
	const blinds = [stake.blind1, stake.blind2, stake.blind3]
		.filter((blind) => blind !== null)
		.join("/");
	const ante =
		stake.ante !== null && stake.anteType !== "none"
			? ` ante ${stake.ante}${stake.anteType === "bb" ? " (BB)" : ""}`
			: "";
	return `${blinds || "-"}${ante}`;
}

function cashStakesBucket(
	stakes: (StakeValues & { gameGroupId: string })[],
	lineup: LineupOutput | undefined
): StatsBucket {
	const [only, ...rest] = stakes;
	if (!only || rest.length > 0) {
		return MULTI_GROUP_STAKES;
	}
	const values = [
		only.blind1,
		only.blind2,
		only.blind3,
		only.ante,
		only.anteType,
	].map((value) => value ?? "");
	const groupName = lineup?.groups[0]?.name;
	return {
		key: `${only.gameGroupId}:${values.join("/")}`,
		label: groupName ? `${groupName} ${formatStake(only)}` : formatStake(only),
	};
}

function populationConditions(userId: string, filter: StatsFilter): SQL[] {
	const conditions: (SQL | undefined)[] = [
		eq(entry.userId, userId),
		eq(entry.status, "settled"),
		filter.kind ? eq(entry.kind, filter.kind) : undefined,
		filter.roomId ? eq(entry.roomId, filter.roomId) : undefined,
		filter.dateFrom ? sql`${entry.playedOn} >= ${filter.dateFrom}` : undefined,
		filter.dateTo ? sql`${entry.playedOn} <= ${filter.dateTo}` : undefined,
		filter.assetId
			? sql`EXISTS (SELECT 1 FROM ${ledgerLine} WHERE ${ledgerLine.entryId} = ${entry.id} AND ${ledgerLine.userId} = ${entry.userId} AND ${ledgerLine.assetId} = ${filter.assetId} AND ${ledgerLine.effect} = 'real')`
			: undefined,
	];
	return conditions.filter((condition) => condition !== undefined);
}

async function taggedEntryIds(
	db: Database,
	userId: string,
	tagIds: string[]
): Promise<Set<string>> {
	const rows = await selectInChunks(
		tagIds,
		(chunk) =>
			db
				.selectDistinct({ id: entryTagLink.entryId })
				.from(entryTagLink)
				.where(
					and(
						eq(entryTagLink.userId, userId),
						inArray(entryTagLink.tagId, chunk)
					)
				),
		OWNER_SCOPED_CHUNK_EXTRA
	);
	return new Set(rows.map((row) => row.id));
}

async function taggedTournamentIds(
	db: Database,
	userId: string,
	tagIds: string[]
): Promise<Set<string>> {
	const rows = await selectInChunks(
		tagIds,
		(chunk) =>
			db
				.selectDistinct({ id: tournamentTagLink.tournamentId })
				.from(tournamentTagLink)
				.where(
					and(
						eq(tournamentTagLink.userId, userId),
						inArray(tournamentTagLink.tagId, chunk)
					)
				),
		OWNER_SCOPED_CHUNK_EXTRA
	);
	return new Set(rows.map((row) => row.id));
}

async function selectPopulationRows(
	db: Database,
	userId: string,
	filter: StatsFilter
) {
	const rows = await db
		.select({
			id: entry.id,
			kind: entry.kind,
			playedOn: entry.playedOn,
			roomId: entry.roomId,
			roomName: room.name,
			assetId: entry.assetId,
			cashRuleId: entryCash.cashRuleId,
			evDiff: entryCash.evDiff,
			tournamentId: entryTournament.tournamentId,
			tournamentRuleId: entryTournament.tournamentRuleId,
			placement: entryTournament.placement,
		})
		.from(entry)
		.leftJoin(
			room,
			and(eq(room.id, entry.roomId), eq(room.userId, entry.userId))
		)
		.leftJoin(
			entryCash,
			and(eq(entryCash.entryId, entry.id), eq(entryCash.userId, entry.userId))
		)
		.leftJoin(
			entryTournament,
			and(
				eq(entryTournament.entryId, entry.id),
				eq(entryTournament.userId, entry.userId)
			)
		)
		.where(and(...populationConditions(userId, filter)));
	const entryTagged =
		filter.entryTagIds && filter.entryTagIds.length > 0
			? await taggedEntryIds(db, userId, filter.entryTagIds)
			: null;
	const tournamentTagged =
		filter.tournamentTagIds && filter.tournamentTagIds.length > 0
			? await taggedTournamentIds(db, userId, filter.tournamentTagIds)
			: null;
	return rows.filter(
		(row) =>
			(entryTagged === null || entryTagged.has(row.id)) &&
			(tournamentTagged === null ||
				(row.tournamentId !== null && tournamentTagged.has(row.tournamentId)))
	);
}

async function tournamentRuleLineups(
	db: Database,
	userId: string,
	ruleIds: string[]
): Promise<{ lineupIdByRule: Map<string, string>; lineups: LineupMap }> {
	const rows = await selectInChunks(
		[...new Set(ruleIds)],
		(chunk) =>
			db
				.select({ id: tournamentRule.id, lineupId: tournamentRule.lineupId })
				.from(tournamentRule)
				.where(
					and(
						eq(tournamentRule.userId, userId),
						inArray(tournamentRule.id, chunk)
					)
				),
		OWNER_SCOPED_CHUNK_EXTRA
	);
	return {
		lineupIdByRule: new Map(rows.map((row) => [row.id, row.lineupId])),
		lineups: await hydrateLineups(
			db,
			userId,
			rows.map((row) => row.lineupId)
		),
	};
}

export async function loadStatsPopulation(
	db: Database,
	userId: string,
	filter: StatsFilter
): Promise<StatsEntry[]> {
	const rows = await selectPopulationRows(db, userId, filter);
	if (rows.length === 0) {
		return [];
	}
	const ids = rows.map((row) => row.id);
	const playsByEntry = groupBy(
		await selectEntryPlaySessions(db, userId, ids),
		(play) => play.entryId
	);
	const hands = await countEntryHands(db, userId, ids);
	const linesByEntry = groupBy(
		await selectEntryLines(db, userId, ids),
		(line) => line.entryId
	);
	const cash = await hydrateCashRules(
		db,
		userId,
		rows.flatMap((row) => (row.cashRuleId ? [row.cashRuleId] : []))
	);
	const tournament = await tournamentRuleLineups(
		db,
		userId,
		rows.flatMap((row) => (row.tournamentRuleId ? [row.tournamentRuleId] : []))
	);
	return rows.map((row) => {
		const shared = {
			id: row.id,
			kind: row.kind,
			playedOn: row.playedOn,
			roomId: row.roomId,
			roomName: row.roomName,
			assetId: row.assetId,
			handCount: hands.get(row.id) ?? 0,
			lines: linesByEntry.get(row.id) ?? [],
			plays: (playsByEntry.get(row.id) ?? []).map((play) => ({
				startedAt: play.startedAt,
				endedAt: play.endedAt,
				breakMinutes: play.breakMinutes,
			})),
		};
		if (row.kind === "cash") {
			const cashRule = row.cashRuleId
				? cash.rules.get(row.cashRuleId)
				: undefined;
			if (!cashRule) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Entry is missing its cash rule",
				});
			}
			const lineup = cash.lineups[cashRule.lineupId];
			return {
				...shared,
				evDiff: row.evDiff,
				placement: null,
				bigBlind: cashBigBlind(cashRule),
				variant: variantBucket(lineup),
				stakes: cashStakesBucket(cashRule.stakes, lineup),
			};
		}
		const lineupId = row.tournamentRuleId
			? tournament.lineupIdByRule.get(row.tournamentRuleId)
			: undefined;
		return {
			...shared,
			evDiff: null,
			placement: row.placement,
			bigBlind: null,
			variant: variantBucket(
				lineupId ? tournament.lineups[lineupId] : undefined
			),
			stakes: TOURNAMENT_STAKES,
		};
	});
}

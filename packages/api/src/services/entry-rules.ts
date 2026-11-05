import type { Database } from "@sapphire2/db";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { type BatchStatement, selectInChunks } from "../lib/batch";
import {
	type CashRuleInput,
	type CashRuleOutput,
	hydrateCashRules,
	prepareCashRule,
} from "./cash-rules";
import { hydrateLineups, type LineupMap } from "./game-lineup";
import {
	hydrateTournamentRules,
	planTournamentRuleWrite,
	ruleLineupIds,
	type TournamentRuleInput,
	type TournamentRuleOutput,
} from "./tournament-rule";

const MASTER_FORBIDDEN_MESSAGE = "Rule master unavailable";

export type EntryRuleSelection =
	| { kind: "cash"; ringGameId: string | null; rule?: CashRuleInput }
	| {
			kind: "tournament";
			rule?: TournamentRuleInput;
			tournamentId: string | null;
	  };

export interface EntryRuleWrite {
	ruleVersionId: string;
	statements: BatchStatement[];
}

export interface EntryRuleRef {
	entryId: string;
	kind: "cash" | "tournament";
	masterId: string | null;
	ruleVersionId: string;
}

export type EntryRuleOutput = {
	currentMasterRuleId: string | null;
	ruleDrift: boolean;
	ruleVersionId: string;
} & (
	| { kind: "cash"; ruleVersion: CashRuleOutput }
	| { kind: "tournament"; ruleVersion: TournamentRuleOutput }
);

async function currentRuleOf(
	db: Database,
	userId: string,
	selection: EntryRuleSelection
): Promise<string> {
	const [row] =
		selection.kind === "cash"
			? await db
					.select({ currentRuleId: ringGame.currentRuleId })
					.from(ringGame)
					.where(
						and(
							eq(ringGame.id, selection.ringGameId ?? ""),
							eq(ringGame.userId, userId)
						)
					)
			: await db
					.select({ currentRuleId: tournament.currentRuleId })
					.from(tournament)
					.where(
						and(
							eq(tournament.id, selection.tournamentId ?? ""),
							eq(tournament.userId, userId)
						)
					);
	if (!row) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: MASTER_FORBIDDEN_MESSAGE,
		});
	}
	return row.currentRuleId;
}

export async function planEntryRule(
	db: Database,
	userId: string,
	selection: EntryRuleSelection
): Promise<EntryRuleWrite> {
	const masterId =
		selection.kind === "cash" ? selection.ringGameId : selection.tournamentId;
	const currentId = masterId
		? await currentRuleOf(db, userId, selection)
		: undefined;
	if (currentId && !selection.rule) {
		return { ruleVersionId: currentId, statements: [] };
	}
	if (selection.kind === "cash") {
		const { id, statements } = await prepareCashRule(
			db,
			userId,
			masterId,
			selection.rule ?? {},
			currentId
		);
		return { ruleVersionId: id, statements };
	}
	const current = currentId
		? ((await hydrateTournamentRules(db, userId, [currentId])).get(currentId) ??
			null)
		: null;
	if (currentId && !current) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: MASTER_FORBIDDEN_MESSAGE,
		});
	}
	const { ruleId, statements } = await planTournamentRuleWrite({
		current,
		db,
		input: selection.rule ?? {},
		tournamentId: masterId,
		userId,
	});
	return { ruleVersionId: ruleId, statements };
}

async function currentMasterRules(
	db: Database,
	userId: string,
	refs: EntryRuleRef[]
): Promise<Map<string, string>> {
	const masterIds = (kind: EntryRuleRef["kind"]) => [
		...new Set(
			refs.flatMap((ref) =>
				ref.kind === kind && ref.masterId ? [ref.masterId] : []
			)
		),
	];
	const rings = await selectInChunks(
		masterIds("cash"),
		(chunk) =>
			db
				.select({ id: ringGame.id, currentRuleId: ringGame.currentRuleId })
				.from(ringGame)
				.where(and(eq(ringGame.userId, userId), inArray(ringGame.id, chunk))),
		1
	);
	const tournaments = await selectInChunks(
		masterIds("tournament"),
		(chunk) =>
			db
				.select({
					id: tournament.id,
					currentRuleId: tournament.currentRuleId,
				})
				.from(tournament)
				.where(
					and(eq(tournament.userId, userId), inArray(tournament.id, chunk))
				),
		1
	);
	return new Map([
		...rings.map((row) => [`cash:${row.id}`, row.currentRuleId] as const),
		...tournaments.map(
			(row) => [`tournament:${row.id}`, row.currentRuleId] as const
		),
	]);
}

export async function hydrateEntryRules(
	db: Database,
	userId: string,
	refs: EntryRuleRef[]
): Promise<{ entries: Map<string, EntryRuleOutput>; lineups: LineupMap }> {
	const cash = await hydrateCashRules(
		db,
		userId,
		refs.flatMap((ref) => (ref.kind === "cash" ? [ref.ruleVersionId] : []))
	);
	const tournamentRules = await hydrateTournamentRules(
		db,
		userId,
		refs.flatMap((ref) =>
			ref.kind === "tournament" ? [ref.ruleVersionId] : []
		)
	);
	const tournamentLineups = await hydrateLineups(
		db,
		userId,
		[...tournamentRules.values()].flatMap(ruleLineupIds)
	);
	const currents = await currentMasterRules(db, userId, refs);
	const entries = new Map<string, EntryRuleOutput>();
	for (const ref of refs) {
		const currentMasterRuleId = ref.masterId
			? (currents.get(`${ref.kind}:${ref.masterId}`) ?? null)
			: null;
		const shared = {
			ruleVersionId: ref.ruleVersionId,
			currentMasterRuleId,
			ruleDrift:
				currentMasterRuleId !== null &&
				currentMasterRuleId !== ref.ruleVersionId,
		};
		const cashVersion =
			ref.kind === "cash" ? cash.rules.get(ref.ruleVersionId) : undefined;
		const tournamentVersion =
			ref.kind === "tournament"
				? tournamentRules.get(ref.ruleVersionId)
				: undefined;
		if (cashVersion) {
			entries.set(ref.entryId, {
				...shared,
				kind: "cash",
				ruleVersion: cashVersion,
			});
		} else if (tournamentVersion) {
			entries.set(ref.entryId, {
				...shared,
				kind: "tournament",
				ruleVersion: tournamentVersion,
			});
		} else {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Missing entry rule version",
			});
		}
	}
	return { entries, lineups: { ...cash.lineups, ...tournamentLineups } };
}

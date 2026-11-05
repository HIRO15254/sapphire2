import type { Database } from "@sapphire2/db";
import type { EntryKind, EntrySource } from "@sapphire2/db/constants/entry";
import { entry, entryCash, entryTournament } from "@sapphire2/db/schema/entry";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { cashRule, tournamentRule } from "@sapphire2/db/schema/rule";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { type BatchStatement, runBatch } from "../lib/batch";
import { validateEntityOwnership } from "../lib/ownership";
import {
	type CashRuleInput,
	hydrateCashRules,
	planCashRuleCopy,
	prepareCashRule,
} from "./cash-rules";
import { loadEntryEventState } from "./entry-live-writes";
import { assertSelectable } from "./entry-writes";
import { assertLiveEntry } from "./live-entry";
import { foldTablePlayers } from "./table-player-fold";
import {
	hydrateTournamentRules,
	planTournamentRuleCopy,
	planTournamentRuleWrite,
	type TournamentRuleInput,
} from "./tournament-rule";

export interface RuleOperationContext {
	live: boolean;
	now: Date;
}

export type EntryOverrideRuleInput = { id: string } & (
	| { kind: "cash"; rule: CashRuleInput }
	| { kind: "tournament"; rule: TournamentRuleInput }
);

export type EntryRelinkInput = { id: string; keepRule: boolean } & (
	| { ringGameId: string | null }
	| { tournamentId: string | null }
);

export interface EntryRestoreRuleInput {
	id: string;
	masterId: string | null;
	masterRuleVersionId?: string;
	ruleVersionId: string;
}

interface EntryRuleTarget {
	id: string;
	kind: EntryKind;
	masterId: string | null;
	ruleVersionId: string;
	source: EntrySource;
}

interface MasterFacts {
	archivedAt: Date | null;
	currentRuleId: string;
	id: string;
}

interface VersionFacts {
	id: string;
	masterId: string | null;
	tableSize: number | null;
}

interface PlannedVersion {
	ruleVersionId: string;
	statements: BatchStatement[];
	tableSize: number | null;
}

const MASTER_LABEL: Record<EntryKind, string> = {
	cash: "ring game",
	tournament: "tournament",
};

function badRequest(message: string): never {
	throw new TRPCError({ code: "BAD_REQUEST", message });
}

async function loadTarget(
	db: Database,
	userId: string,
	id: string,
	context: RuleOperationContext
): Promise<EntryRuleTarget> {
	const [row] = await db
		.select({
			kind: entry.kind,
			source: entry.source,
			ringGameId: entryCash.ringGameId,
			cashRuleId: entryCash.cashRuleId,
			tournamentId: entryTournament.tournamentId,
			tournamentRuleId: entryTournament.tournamentRuleId,
		})
		.from(entry)
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
		.where(and(eq(entry.id, id), eq(entry.userId, userId)));
	if (!row) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Entry unavailable" });
	}
	if (context.live) {
		assertLiveEntry(row);
	}
	const ruleVersionId =
		row.kind === "cash" ? row.cashRuleId : row.tournamentRuleId;
	if (!ruleVersionId) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Entry is missing its kind detail",
		});
	}
	return {
		id,
		kind: row.kind,
		source: row.source,
		masterId: row.kind === "cash" ? row.ringGameId : row.tournamentId,
		ruleVersionId,
	};
}

function assertKind(target: EntryRuleTarget, kind: EntryKind): void {
	if (target.kind !== kind) {
		badRequest(`This operation needs a ${kind} entry`);
	}
}

function requireLinkedMaster(target: EntryRuleTarget): string {
	if (target.masterId === null) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: `This entry is not linked to a ${MASTER_LABEL[target.kind]}`,
		});
	}
	return target.masterId;
}

async function loadMaster(
	db: Database,
	userId: string,
	kind: EntryKind,
	id: string
): Promise<MasterFacts> {
	return kind === "cash"
		? await validateEntityOwnership(db, "ringGame", id, userId)
		: await validateEntityOwnership(db, "tournament", id, userId);
}

async function loadVersion(
	db: Database,
	userId: string,
	kind: EntryKind,
	id: string
): Promise<VersionFacts> {
	const [row] =
		kind === "cash"
			? await db
					.select({
						id: cashRule.id,
						masterId: cashRule.ringGameId,
						tableSize: cashRule.tableSize,
					})
					.from(cashRule)
					.where(and(eq(cashRule.id, id), eq(cashRule.userId, userId)))
			: await db
					.select({
						id: tournamentRule.id,
						masterId: tournamentRule.tournamentId,
						tableSize: tournamentRule.tableSize,
					})
					.from(tournamentRule)
					.where(
						and(eq(tournamentRule.id, id), eq(tournamentRule.userId, userId))
					);
	if (!row) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Rule version unavailable",
		});
	}
	return row;
}

function hydrated<Value>(value: Value | undefined): Value {
	if (value === undefined) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Missing rule version",
		});
	}
	return value;
}

async function planVersionUnder(
	db: Database,
	userId: string,
	kind: EntryKind,
	source: VersionFacts,
	target: { currentRuleId: string | null; masterId: string | null }
): Promise<PlannedVersion> {
	if (source.masterId === target.masterId) {
		return {
			ruleVersionId: source.id,
			statements: [],
			tableSize: source.tableSize,
		};
	}
	const ids = target.currentRuleId
		? [source.id, target.currentRuleId]
		: [source.id];
	if (kind === "cash") {
		const { rules } = await hydrateCashRules(db, userId, ids);
		const copy = await planCashRuleCopy(
			db,
			userId,
			hydrated(rules.get(source.id)),
			{
				ringGameId: target.masterId,
				parent: target.currentRuleId
					? hydrated(rules.get(target.currentRuleId))
					: null,
			}
		);
		return {
			ruleVersionId: copy.id,
			statements: copy.statements,
			tableSize: source.tableSize,
		};
	}
	const rules = await hydrateTournamentRules(db, userId, ids);
	const copy = await planTournamentRuleCopy(
		db,
		userId,
		hydrated(rules.get(source.id)),
		{
			tournamentId: target.masterId,
			parent: target.currentRuleId
				? hydrated(rules.get(target.currentRuleId))
				: null,
		}
	);
	return {
		ruleVersionId: copy.ruleId,
		statements: copy.statements,
		tableSize: source.tableSize,
	};
}

async function assertSeatsFit(
	db: Database,
	userId: string,
	target: EntryRuleTarget,
	tableSize: number | null
): Promise<void> {
	if (target.source !== "live" || tableSize === null) {
		return;
	}
	const { events } = await loadEntryEventState(db, userId, target.id);
	const outside = foldTablePlayers(events).find(
		(item) =>
			item.isActive &&
			item.seatPosition !== null &&
			item.seatPosition >= tableSize
	);
	if (outside) {
		badRequest(
			`Seat ${outside.seatPosition} is taken and would be outside a ${tableSize}-handed table`
		);
	}
}

function linkStatements(
	db: Database,
	userId: string,
	target: EntryRuleTarget,
	link: { masterId: string | null; ruleVersionId: string },
	now: Date
): BatchStatement[] {
	const detail =
		target.kind === "cash"
			? db
					.update(entryCash)
					.set({ ringGameId: link.masterId, cashRuleId: link.ruleVersionId })
					.where(
						and(eq(entryCash.entryId, target.id), eq(entryCash.userId, userId))
					)
			: db
					.update(entryTournament)
					.set({
						tournamentId: link.masterId,
						tournamentRuleId: link.ruleVersionId,
					})
					.where(
						and(
							eq(entryTournament.entryId, target.id),
							eq(entryTournament.userId, userId)
						)
					);
	return [
		detail,
		db
			.update(entry)
			.set({ updatedAt: now })
			.where(and(eq(entry.id, target.id), eq(entry.userId, userId))),
	];
}

function masterCurrentStatement(
	db: Database,
	userId: string,
	kind: EntryKind,
	masterId: string,
	ruleVersionId: string,
	now: Date
): BatchStatement {
	return kind === "cash"
		? db
				.update(ringGame)
				.set({ currentRuleId: ruleVersionId, updatedAt: now })
				.where(and(eq(ringGame.id, masterId), eq(ringGame.userId, userId)))
		: db
				.update(tournament)
				.set({ currentRuleId: ruleVersionId, updatedAt: now })
				.where(and(eq(tournament.id, masterId), eq(tournament.userId, userId)));
}

async function planOverride(
	db: Database,
	userId: string,
	target: EntryRuleTarget,
	input: EntryOverrideRuleInput
): Promise<{ ruleVersionId: string; statements: BatchStatement[] }> {
	if (input.kind === "cash") {
		const { id, statements } = await prepareCashRule(
			db,
			userId,
			target.masterId,
			input.rule,
			target.ruleVersionId
		);
		return { ruleVersionId: id, statements };
	}
	const current = hydrated(
		(await hydrateTournamentRules(db, userId, [target.ruleVersionId])).get(
			target.ruleVersionId
		)
	);
	const { ruleId, statements } = await planTournamentRuleWrite({
		current,
		db,
		input: input.rule,
		tournamentId: target.masterId,
		userId,
	});
	return { ruleVersionId: ruleId, statements };
}

export async function overrideEntryRule(
	db: Database,
	userId: string,
	input: EntryOverrideRuleInput,
	context: RuleOperationContext
): Promise<void> {
	const target = await loadTarget(db, userId, input.id, context);
	assertKind(target, input.kind);
	const current = await loadVersion(
		db,
		userId,
		target.kind,
		target.ruleVersionId
	);
	await assertSeatsFit(
		db,
		userId,
		target,
		input.rule.tableSize === undefined
			? current.tableSize
			: input.rule.tableSize
	);
	const planned = await planOverride(db, userId, target, input);
	await runBatch(db, [
		...planned.statements,
		...linkStatements(
			db,
			userId,
			target,
			{ masterId: target.masterId, ruleVersionId: planned.ruleVersionId },
			context.now
		),
	]);
}

export async function applyMasterRule(
	db: Database,
	userId: string,
	id: string,
	context: RuleOperationContext
): Promise<void> {
	const target = await loadTarget(db, userId, id, context);
	const masterId = requireLinkedMaster(target);
	const master = await loadMaster(db, userId, target.kind, masterId);
	const version = await loadVersion(
		db,
		userId,
		target.kind,
		master.currentRuleId
	);
	await assertSeatsFit(db, userId, target, version.tableSize);
	await runBatch(
		db,
		linkStatements(
			db,
			userId,
			target,
			{ masterId, ruleVersionId: master.currentRuleId },
			context.now
		)
	);
}

export async function pushRuleToMaster(
	db: Database,
	userId: string,
	id: string,
	context: RuleOperationContext
): Promise<void> {
	const target = await loadTarget(db, userId, id, context);
	const masterId = requireLinkedMaster(target);
	const master = await loadMaster(db, userId, target.kind, masterId);
	const source = await loadVersion(
		db,
		userId,
		target.kind,
		target.ruleVersionId
	);
	const planned = await planVersionUnder(db, userId, target.kind, source, {
		masterId,
		currentRuleId: master.currentRuleId,
	});
	await runBatch(db, [
		...planned.statements,
		masterCurrentStatement(
			db,
			userId,
			target.kind,
			masterId,
			planned.ruleVersionId,
			context.now
		),
		...linkStatements(
			db,
			userId,
			target,
			{ masterId, ruleVersionId: planned.ruleVersionId },
			context.now
		),
	]);
}

export async function relinkEntry(
	db: Database,
	userId: string,
	input: EntryRelinkInput,
	context: RuleOperationContext
): Promise<void> {
	const target = await loadTarget(db, userId, input.id, context);
	const destinationId =
		"ringGameId" in input ? input.ringGameId : input.tournamentId;
	assertKind(target, "ringGameId" in input ? "cash" : "tournament");
	const source = await loadVersion(
		db,
		userId,
		target.kind,
		target.ruleVersionId
	);
	let planned: PlannedVersion;
	if (destinationId === null) {
		planned = await planVersionUnder(db, userId, target.kind, source, {
			masterId: null,
			currentRuleId: null,
		});
	} else {
		if (destinationId !== target.masterId) {
			await assertSelectable(
				db,
				userId,
				target.kind === "cash"
					? { ringGameId: destinationId }
					: { tournamentId: destinationId }
			);
		}
		const master = await loadMaster(db, userId, target.kind, destinationId);
		planned = input.keepRule
			? await planVersionUnder(db, userId, target.kind, source, {
					masterId: destinationId,
					currentRuleId: master.currentRuleId,
				})
			: {
					ruleVersionId: master.currentRuleId,
					statements: [],
					tableSize: (
						await loadVersion(db, userId, target.kind, master.currentRuleId)
					).tableSize,
				};
	}
	await assertSeatsFit(db, userId, target, planned.tableSize);
	await runBatch(db, [
		...planned.statements,
		...linkStatements(
			db,
			userId,
			target,
			{ masterId: destinationId, ruleVersionId: planned.ruleVersionId },
			context.now
		),
	]);
}

export async function restoreEntryRule(
	db: Database,
	userId: string,
	input: EntryRestoreRuleInput,
	context: RuleOperationContext
): Promise<void> {
	const target = await loadTarget(db, userId, input.id, context);
	if (input.masterRuleVersionId !== undefined && input.masterId === null) {
		badRequest("masterRuleVersionId needs a masterId");
	}
	if (input.masterId !== null) {
		await loadMaster(db, userId, target.kind, input.masterId);
	}
	const owner = input.masterId
		? `this ${MASTER_LABEL[target.kind]}`
		: "no master";
	const version = await loadVersion(
		db,
		userId,
		target.kind,
		input.ruleVersionId
	);
	if (version.masterId !== input.masterId) {
		badRequest(`The rule version does not belong to ${owner}`);
	}
	const masterVersion =
		input.masterRuleVersionId === undefined
			? null
			: await loadVersion(db, userId, target.kind, input.masterRuleVersionId);
	if (masterVersion && masterVersion.masterId !== input.masterId) {
		badRequest(`The master rule version does not belong to ${owner}`);
	}
	await assertSeatsFit(db, userId, target, version.tableSize);
	await runBatch(db, [
		...(masterVersion && input.masterId
			? [
					masterCurrentStatement(
						db,
						userId,
						target.kind,
						input.masterId,
						masterVersion.id,
						context.now
					),
				]
			: []),
		...linkStatements(
			db,
			userId,
			target,
			{ masterId: input.masterId, ruleVersionId: version.id },
			context.now
		),
	]);
}

export async function assignCreatedMaster(
	db: Database,
	userId: string,
	input: {
		entryId: string;
		kind: EntryKind;
		masterId: string;
		plan: () => Promise<{ ruleId: string; statements: BatchStatement[] }>;
		tableSize: number | null;
	},
	context: RuleOperationContext
): Promise<void> {
	const target = await loadTarget(db, userId, input.entryId, context);
	assertKind(target, input.kind);
	await assertSeatsFit(db, userId, target, input.tableSize);
	const { ruleId, statements } = await input.plan();
	await runBatch(db, [
		...statements,
		...linkStatements(
			db,
			userId,
			target,
			{ masterId: input.masterId, ruleVersionId: ruleId },
			context.now
		),
	]);
}

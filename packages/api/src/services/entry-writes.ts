import type { Database } from "@sapphire2/db";
import {
	END_STATES_REQUIRING_STACK,
	type EntryKind,
	endStatesForKind,
	type PlaySessionEndState,
	SETTLING_END_STATES,
} from "@sapphire2/db/constants/entry";
import {
	LEDGER_ENTRY_ROLES_BY_KIND,
	LEDGER_PRICE_ROLES,
	type LedgerEffect,
	type LedgerRole,
	signedLedgerQuantity,
} from "@sapphire2/db/constants/ledger";
import { asset } from "@sapphire2/db/schema/asset";
import {
	entry,
	entryCash,
	entryTournament,
	playSession,
} from "@sapphire2/db/schema/entry";
import { entryTag, entryTagLink } from "@sapphire2/db/schema/entry-tag";
import { ledgerLine } from "@sapphire2/db/schema/ledger";
import { tournamentRulePrice } from "@sapphire2/db/schema/rule";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { type BatchStatement, runBatch, selectInChunks } from "../lib/batch";
import {
	validateEntityOwnership,
	validateTagsOwnership,
} from "../lib/ownership";
import type { CashRuleInput } from "./cash-rules";
import { type EntryRuleWrite, planEntryRule } from "./entry-rules";
import { insertChunks } from "./game-lineup";
import { manualLineOccurredAt } from "./ledger-writes";
import type { TournamentRuleInput } from "./tournament-rule";

export const MAX_ENTRY_PLAY_SESSIONS = 100;
export const MAX_ENTRY_PAYMENTS = 1000;

const SEQ_SHIFT = 1_000_000;
const OWNER_SCOPED_CHUNK_EXTRA = 1;
const DAY_DELETE_CHUNK_EXTRA = 2;

const PRICE_KIND_ROLES: Record<string, readonly LedgerRole[]> = {
	entry: ["buy_in", "fee"],
	reentry: ["reentry", "fee"],
	addon: ["chip_purchase", "fee"],
};

export interface ManualPaymentInput {
	assetId: string;
	effect: LedgerEffect;
	priceId?: string;
	quantity: number;
	role: LedgerRole;
}

export interface ManualPlayInput {
	breakMinutes?: number;
	endedAt?: number;
	endStack?: number;
	endState: PlaySessionEndState;
	id?: string;
	label?: string;
	localDate: string;
	payments: ManualPaymentInput[];
	startedAt?: number;
}

interface EntryMetadataInput {
	assetId?: string | null;
	memo?: string | null;
	roomId?: string | null;
	tagIds?: string[];
	title?: string | null;
}

interface ManualMoneyInput {
	payments?: ManualPaymentInput[];
	playedOn?: string;
	playSessions?: ManualPlayInput[];
}

export type EntryCreateInput = EntryMetadataInput &
	ManualMoneyInput & { playedOn: string } & (
		| {
				evDiff?: number;
				kind: "cash";
				ringGameId?: string;
				rule?: CashRuleInput;
		  }
		| {
				beforeDeadline?: boolean;
				kind: "tournament";
				placement?: number;
				rule?: TournamentRuleInput;
				totalEntries?: number;
				tournamentId?: string;
		  }
	);

export interface EntryUpdateInput extends EntryMetadataInput, ManualMoneyInput {
	beforeDeadline?: boolean;
	evDiff?: number | null;
	id: string;
	placement?: number | null;
	totalEntries?: number | null;
}

function badRequest(message: string): never {
	throw new TRPCError({ code: "BAD_REQUEST", message });
}

function forbidden(message: string): never {
	throw new TRPCError({ code: "FORBIDDEN", message });
}

const CARRY_OVER_END_STATE = {
	cash: "held",
	tournament: "bagged",
} as const satisfies Record<EntryKind, PlaySessionEndState>;

function synthesizedEndState(
	kind: EntryKind,
	placement: number | null
): PlaySessionEndState {
	if (kind === "cash") {
		return "cashed_out";
	}
	return placement === 1 ? "finished" : "busted";
}

function validatePayments(kind: EntryKind, payments: ManualPaymentInput[]) {
	const allowed = LEDGER_ENTRY_ROLES_BY_KIND[kind] as readonly LedgerRole[];
	for (const payment of payments) {
		if (!allowed.includes(payment.role)) {
			badRequest(`A ${kind} entry cannot record a ${payment.role} payment`);
		}
		if (payment.priceId !== undefined) {
			if (kind === "cash") {
				badRequest("A cash payment cannot reference a tournament price");
			}
			if (
				!(LEDGER_PRICE_ROLES as readonly LedgerRole[]).includes(payment.role)
			) {
				badRequest(`A ${payment.role} payment cannot reference a price`);
			}
		}
	}
}

function validatePlayDay(
	kind: EntryKind,
	play: ManualPlayInput,
	isLast: boolean
): void {
	if (!endStatesForKind(kind).includes(play.endState)) {
		badRequest(`A ${kind} entry cannot end a day as ${play.endState}`);
	}
	if (isLast) {
		if (!(SETTLING_END_STATES as readonly string[]).includes(play.endState)) {
			badRequest("The last play session must end the entry");
		}
	} else if (play.endState !== CARRY_OVER_END_STATE[kind]) {
		badRequest(
			`Every play session before the last must end as ${CARRY_OVER_END_STATE[kind]}`
		);
	}
	if (
		(END_STATES_REQUIRING_STACK as readonly string[]).includes(play.endState) &&
		play.endStack === undefined
	) {
		badRequest(`A play session ending ${play.endState} needs endStack`);
	}
	if (play.startedAt !== undefined && play.endedAt !== undefined) {
		if (play.endedAt < play.startedAt) {
			badRequest("A play session cannot end before it starts");
		}
		if (play.endedAt - play.startedAt < 60 * (play.breakMinutes ?? 0)) {
			badRequest("A play session's break is longer than the session");
		}
	}
}

function validateManualPlays(
	kind: EntryKind,
	playedOn: string,
	plays: ManualPlayInput[]
): void {
	if (plays.length === 0 || plays.length > MAX_ENTRY_PLAY_SESSIONS) {
		badRequest(
			`An entry has between 1 and ${MAX_ENTRY_PLAY_SESSIONS} play sessions`
		);
	}
	const ids = new Set<string>();
	let paymentCount = 0;
	let latest: number | undefined;
	let previousDate: string | undefined;
	for (const [index, play] of plays.entries()) {
		if (play.id !== undefined) {
			if (ids.has(play.id)) {
				badRequest("A play session id appears more than once");
			}
			ids.add(play.id);
		}
		validatePlayDay(kind, play, index === plays.length - 1);
		if (previousDate !== undefined && play.localDate < previousDate) {
			badRequest("Play sessions must be in chronological order");
		}
		previousDate = play.localDate;
		const instants = [play.startedAt, play.endedAt].filter(
			(value): value is number => value !== undefined
		);
		if (instants.length > 0) {
			if (latest !== undefined && Math.min(...instants) < latest) {
				badRequest("Play sessions must not overlap");
			}
			latest = Math.max(...instants);
		}
		validatePayments(kind, play.payments);
		paymentCount += play.payments.length;
	}
	if (paymentCount > MAX_ENTRY_PAYMENTS) {
		badRequest(`An entry records at most ${MAX_ENTRY_PAYMENTS} payments`);
	}
	if (plays[0]?.localDate !== playedOn) {
		badRequest("playedOn must equal the first play session's local date");
	}
}

function attachTopLevelPayments(
	plays: ManualPlayInput[],
	payments: ManualPaymentInput[] | undefined
): ManualPlayInput[] {
	if (payments === undefined) {
		return plays;
	}
	const [only, ...rest] = plays;
	if (!only || rest.length > 0) {
		badRequest(
			"Top-level payments apply to a single play session; send payments inside each play session instead"
		);
	}
	if (only.payments.length > 0) {
		badRequest(
			"Send payments either at the top level or inside the play session, not both"
		);
	}
	return [{ ...only, payments }];
}

export async function assertSelectable(
	db: Database,
	userId: string,
	target: { ringGameId: string } | { roomId: string } | { tournamentId: string }
) {
	let found: { archivedAt: Date | null };
	let label: string;
	if ("roomId" in target) {
		found = await validateEntityOwnership(db, "room", target.roomId, userId);
		label = "room";
	} else if ("ringGameId" in target) {
		found = await validateEntityOwnership(
			db,
			"ringGame",
			target.ringGameId,
			userId
		);
		label = "ring game";
	} else {
		found = await validateEntityOwnership(
			db,
			"tournament",
			target.tournamentId,
			userId
		);
		label = "tournament";
	}
	if (found.archivedAt !== null) {
		badRequest(`An archived ${label} cannot be selected; restore it first`);
	}
}

export async function assertPaymentAssets(
	db: Database,
	userId: string,
	payments: ManualPaymentInput[],
	keptAssetIds: ReadonlySet<string>
) {
	const ids = [...new Set(payments.map((payment) => payment.assetId))];
	const rows = await selectInChunks(
		ids,
		(chunk) =>
			db
				.select({ id: asset.id, archivedAt: asset.archivedAt })
				.from(asset)
				.where(and(eq(asset.userId, userId), inArray(asset.id, chunk))),
		OWNER_SCOPED_CHUNK_EXTRA
	);
	if (rows.length !== ids.length) {
		forbidden("You do not own one or more of these assets");
	}
	if (
		rows.some((row) => row.archivedAt !== null && !keptAssetIds.has(row.id))
	) {
		badRequest("An archived asset cannot be selected; restore it first");
	}
}

export async function assertPaymentPrices(
	db: Database,
	userId: string,
	ruleVersionId: string | null,
	payments: ManualPaymentInput[],
	keptPriceIds: ReadonlySet<string>,
	keptPriceCounts?: ReadonlyMap<string, number>
) {
	const ids = [
		...new Set(
			payments.flatMap((payment) =>
				payment.priceId === undefined ? [] : [payment.priceId]
			)
		),
	];
	if (ids.length === 0) {
		return;
	}
	const rows = await selectInChunks(
		ids,
		(chunk) =>
			db
				.select({
					id: tournamentRulePrice.id,
					ruleId: tournamentRulePrice.ruleId,
					assetId: tournamentRulePrice.assetId,
					kind: tournamentRulePrice.kind,
				})
				.from(tournamentRulePrice)
				.where(
					and(
						eq(tournamentRulePrice.userId, userId),
						inArray(tournamentRulePrice.id, chunk)
					)
				),
		OWNER_SCOPED_CHUNK_EXTRA
	);
	const prices = new Map(
		rows
			.filter((row) => row.ruleId === ruleVersionId || keptPriceIds.has(row.id))
			.map((row) => [row.id, row] as const)
	);
	const remaining = keptPriceCounts ? new Map(keptPriceCounts) : undefined;
	for (const payment of payments) {
		if (payment.priceId === undefined) {
			continue;
		}
		const price = prices.get(payment.priceId);
		if (!price) {
			forbidden("This price is not part of the entry's tournament rule");
		}
		if (price.ruleId !== ruleVersionId && remaining) {
			const count = remaining.get(price.id) ?? 0;
			if (count === 0) {
				forbidden("This price is not part of the entry's tournament rule");
			}
			remaining.set(price.id, count - 1);
		}
		if (price.assetId !== payment.assetId) {
			badRequest("A priced payment must be paid in the price's asset");
		}
		if (!(PRICE_KIND_ROLES[price.kind] ?? []).includes(payment.role)) {
			badRequest(`A ${price.kind} price cannot pay a ${payment.role} line`);
		}
	}
}

export async function assertMetadata(
	db: Database,
	userId: string,
	input: EntryMetadataInput,
	current: { assetId: string | null; roomId: string | null } | null
) {
	if (input.roomId && input.roomId !== current?.roomId) {
		await assertSelectable(db, userId, { roomId: input.roomId });
	}
	if (input.assetId && input.assetId !== current?.assetId) {
		const found = await validateEntityOwnership(
			db,
			"asset",
			input.assetId,
			userId
		);
		if (found.archivedAt !== null) {
			badRequest("An archived asset cannot be selected; restore it first");
		}
	}
	await validateTagsOwnership(db, entryTag, input.tagIds, userId);
}

interface PlayRowPlan {
	existing: boolean;
	id: string;
	play: ManualPlayInput;
	seq: number;
}

function planPlayRows(plays: ManualPlayInput[]): PlayRowPlan[] {
	return plays.map((play, index) => ({
		existing: play.id !== undefined,
		id: play.id ?? crypto.randomUUID(),
		play,
		seq: index + 1,
	}));
}

function toDate(seconds: number | undefined): Date | null {
	return seconds === undefined ? null : new Date(seconds * 1000);
}

function playColumns(play: ManualPlayInput, now: Date) {
	return {
		label: play.label ?? null,
		localDate: play.localDate,
		startedAt: toDate(play.startedAt),
		endedAt: toDate(play.endedAt),
		breakMinutes: play.breakMinutes ?? 0,
		status: "ended" as const,
		endState: play.endState,
		endStack: play.endStack ?? null,
		updatedAt: now,
	};
}

function lineRows(
	entryId: string,
	userId: string,
	plan: PlayRowPlan[],
	now: Date
) {
	const nextByRole: Partial<Record<LedgerRole, number>> = {};
	return plan.flatMap(({ id, play }) => {
		const occurredAt = manualLineOccurredAt(
			toDate(play.startedAt),
			play.localDate
		);
		return play.payments.map((payment) => {
			const n = nextByRole[payment.role] ?? 0;
			nextByRole[payment.role] = n + 1;
			return {
				id: `m:${entryId}:${payment.role}:${n}`,
				userId,
				assetId: payment.assetId,
				quantity: signedLedgerQuantity(payment.role, payment.quantity),
				role: payment.role,
				effect: payment.effect,
				entryId,
				playSessionId: id,
				priceId: payment.priceId ?? null,
				occurredAt,
				createdAt: now,
				updatedAt: now,
			};
		});
	});
}

function tagStatements(
	db: Database,
	entryId: string,
	userId: string,
	tagIds: string[] | undefined,
	replace: boolean
): BatchStatement[] {
	if (tagIds === undefined) {
		return [];
	}
	return [
		...(replace
			? [
					db
						.delete(entryTagLink)
						.where(
							and(
								eq(entryTagLink.entryId, entryId),
								eq(entryTagLink.userId, userId)
							)
						),
				]
			: []),
		...insertChunks(
			tagIds.map((tagId) => ({ userId, entryId, tagId })),
			(chunk) => db.insert(entryTagLink).values(chunk)
		),
	];
}

export type EntryRuleRequest =
	| { kind: "cash"; ringGameId?: string; rule?: CashRuleInput }
	| { kind: "tournament"; rule?: TournamentRuleInput; tournamentId?: string };

export async function planCreateRule(
	db: Database,
	userId: string,
	input: EntryRuleRequest
): Promise<EntryRuleWrite> {
	if (input.kind === "cash") {
		if (input.ringGameId) {
			await assertSelectable(db, userId, { ringGameId: input.ringGameId });
		}
		return await planEntryRule(db, userId, {
			kind: "cash",
			ringGameId: input.ringGameId ?? null,
			rule: input.rule,
		});
	}
	if (input.tournamentId) {
		await assertSelectable(db, userId, { tournamentId: input.tournamentId });
	}
	return await planEntryRule(db, userId, {
		kind: "tournament",
		tournamentId: input.tournamentId ?? null,
		rule: input.rule,
	});
}

export async function createManualEntry(
	db: Database,
	userId: string,
	input: EntryCreateInput,
	now: Date
): Promise<string> {
	const placement =
		input.kind === "tournament" && !input.beforeDeadline
			? (input.placement ?? null)
			: null;
	const plays = input.playSessions
		? attachTopLevelPayments(input.playSessions, input.payments)
		: [
				{
					localDate: input.playedOn,
					endState: synthesizedEndState(input.kind, placement),
					payments: input.payments ?? [],
				},
			];
	if (plays.some((play) => play.id !== undefined)) {
		forbidden("A new entry has no existing play session");
	}
	validateManualPlays(input.kind, input.playedOn, plays);
	if (
		input.kind === "tournament" &&
		placement !== null &&
		input.totalEntries !== undefined &&
		placement > input.totalEntries
	) {
		badRequest("Placement must be less than or equal to total entries");
	}
	await assertMetadata(db, userId, input, null);
	const payments = plays.flatMap((play) => play.payments);
	await assertPaymentAssets(db, userId, payments, new Set());
	const rule = await planCreateRule(db, userId, input);
	await assertPaymentPrices(
		db,
		userId,
		rule.ruleVersionId,
		payments,
		new Set()
	);
	const id = crypto.randomUUID();
	const plan = planPlayRows(plays);
	await runBatch(db, [
		...rule.statements,
		db.insert(entry).values({
			id,
			userId,
			kind: input.kind,
			source: "manual",
			status: "settled",
			roomId: input.roomId ?? null,
			assetId: input.assetId ?? null,
			title: input.title ?? null,
			playedOn: input.playedOn,
			memo: input.memo ?? null,
			createdAt: now,
			updatedAt: now,
		}),
		input.kind === "cash"
			? db.insert(entryCash).values({
					entryId: id,
					userId,
					ringGameId: input.ringGameId ?? null,
					cashRuleId: rule.ruleVersionId,
					evDiff: input.evDiff ?? null,
				})
			: db.insert(entryTournament).values({
					entryId: id,
					userId,
					tournamentId: input.tournamentId ?? null,
					tournamentRuleId: rule.ruleVersionId,
					placement,
					totalEntries: input.totalEntries ?? null,
					beforeDeadline: input.beforeDeadline ?? false,
				}),
		...insertChunks(
			plan.map(({ id: playId, play, seq }) => ({
				id: playId,
				userId,
				entryId: id,
				kind: input.kind,
				seq,
				...playColumns(play, now),
				createdAt: now,
			})),
			(chunk) => db.insert(playSession).values(chunk)
		),
		...insertChunks(lineRows(id, userId, plan, now), (chunk) =>
			db.insert(ledgerLine).values(chunk)
		),
		...tagStatements(db, id, userId, input.tagIds, false),
	]);
	return id;
}

interface StoredEntry {
	assetId: string | null;
	beforeDeadline: boolean;
	evDiff: number | null;
	kind: EntryKind;
	placement: number | null;
	playedOn: string;
	roomId: string | null;
	ruleVersionId: string;
	source: string;
	totalEntries: number | null;
}

async function loadStoredEntry(
	db: Database,
	userId: string,
	id: string
): Promise<StoredEntry> {
	const [row] = await db
		.select({
			kind: entry.kind,
			source: entry.source,
			playedOn: entry.playedOn,
			roomId: entry.roomId,
			assetId: entry.assetId,
			cashRuleId: entryCash.cashRuleId,
			evDiff: entryCash.evDiff,
			tournamentRuleId: entryTournament.tournamentRuleId,
			placement: entryTournament.placement,
			totalEntries: entryTournament.totalEntries,
			beforeDeadline: entryTournament.beforeDeadline,
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
		forbidden("Entry unavailable");
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
		...row,
		ruleVersionId,
		beforeDeadline: row.beforeDeadline ?? false,
	};
}

const LIVE_DERIVED_FIELDS = [
	"playedOn",
	"playSessions",
	"payments",
	"evDiff",
	"placement",
	"totalEntries",
	"beforeDeadline",
] as const satisfies readonly (keyof EntryUpdateInput)[];

function assertKindFields(kind: EntryKind, input: EntryUpdateInput) {
	if (kind === "cash") {
		if (
			input.placement !== undefined ||
			input.totalEntries !== undefined ||
			input.beforeDeadline !== undefined
		) {
			badRequest("A cash entry has no tournament result");
		}
	} else if (input.evDiff !== undefined) {
		badRequest("A tournament entry has no EV difference");
	}
}

function storedPlayToInput(
	play: typeof playSession.$inferSelect,
	payments: ManualPaymentInput[]
): ManualPlayInput {
	if (play.endState === null) {
		badRequest("Only ended play sessions can be edited manually");
	}
	return {
		id: play.id,
		localDate: play.localDate,
		label: play.label ?? undefined,
		startedAt: play.startedAt ? play.startedAt.getTime() / 1000 : undefined,
		endedAt: play.endedAt ? play.endedAt.getTime() / 1000 : undefined,
		breakMinutes: play.breakMinutes,
		endState: play.endState,
		endStack: play.endStack ?? undefined,
		payments,
	};
}

function dayDeleteStatements(
	db: Database,
	entryId: string,
	userId: string,
	ids: string[]
): BatchStatement[] {
	const statements: BatchStatement[] = [];
	const perChunk = 100 - DAY_DELETE_CHUNK_EXTRA;
	for (let index = 0; index < ids.length; index += perChunk) {
		statements.push(
			db
				.delete(playSession)
				.where(
					and(
						eq(playSession.entryId, entryId),
						eq(playSession.userId, userId),
						inArray(playSession.id, ids.slice(index, index + perChunk))
					)
				)
		);
	}
	return statements;
}

async function manualMoneyStatements(
	db: Database,
	userId: string,
	stored: StoredEntry,
	input: EntryUpdateInput,
	now: Date
): Promise<BatchStatement[]> {
	if (input.playSessions === undefined && input.payments === undefined) {
		if (input.playedOn !== undefined) {
			const [first] = await db
				.select({ localDate: playSession.localDate })
				.from(playSession)
				.where(
					and(eq(playSession.entryId, input.id), eq(playSession.userId, userId))
				)
				.orderBy(asc(playSession.localDate))
				.limit(1);
			if (first?.localDate !== input.playedOn) {
				badRequest("playedOn must equal the first play session's local date");
			}
		}
		return [];
	}
	const storedPlays = await db
		.select()
		.from(playSession)
		.where(
			and(eq(playSession.entryId, input.id), eq(playSession.userId, userId))
		)
		.orderBy(asc(playSession.seq));
	const storedLines = await db
		.select({ assetId: ledgerLine.assetId, priceId: ledgerLine.priceId })
		.from(ledgerLine)
		.where(
			and(eq(ledgerLine.entryId, input.id), eq(ledgerLine.userId, userId))
		);
	let plays: ManualPlayInput[];
	if (input.playSessions === undefined) {
		const [only, ...rest] = storedPlays;
		if (!only || rest.length > 0) {
			badRequest(
				"Top-level payments apply to a single play session; send playSessions with per-day payments instead"
			);
		}
		plays = [storedPlayToInput(only, input.payments ?? [])];
	} else {
		plays = attachTopLevelPayments(input.playSessions, input.payments);
	}
	const storedIds = new Set(storedPlays.map((play) => play.id));
	if (plays.some((play) => play.id !== undefined && !storedIds.has(play.id))) {
		forbidden("This play session does not belong to the entry");
	}
	validateManualPlays(stored.kind, input.playedOn ?? stored.playedOn, plays);
	const payments = plays.flatMap((play) => play.payments);
	await assertPaymentAssets(
		db,
		userId,
		payments,
		new Set(storedLines.map((line) => line.assetId))
	);
	const keptPriceCounts = new Map<string, number>();
	for (const line of storedLines) {
		if (line.priceId) {
			keptPriceCounts.set(
				line.priceId,
				(keptPriceCounts.get(line.priceId) ?? 0) + 1
			);
		}
	}
	await assertPaymentPrices(
		db,
		userId,
		stored.ruleVersionId,
		payments,
		new Set(keptPriceCounts.keys()),
		keptPriceCounts
	);
	const plan = planPlayRows(plays);
	const keptIds = new Set(
		plan.filter((row) => row.existing).map((row) => row.id)
	);
	const owned = and(
		eq(playSession.entryId, input.id),
		eq(playSession.userId, userId)
	);
	return [
		db
			.delete(ledgerLine)
			.where(
				and(
					eq(ledgerLine.entryId, input.id),
					eq(ledgerLine.userId, userId),
					isNull(ledgerLine.sourceEventId)
				)
			),
		...dayDeleteStatements(
			db,
			input.id,
			userId,
			[...storedIds].filter((id) => !keptIds.has(id))
		),
		...(keptIds.size > 0
			? [
					db
						.update(playSession)
						.set({ seq: sql`${playSession.seq} + ${SEQ_SHIFT}` })
						.where(owned),
				]
			: []),
		...plan
			.filter((row) => row.existing)
			.map(({ id, play, seq }) =>
				db
					.update(playSession)
					.set({ seq, ...playColumns(play, now) })
					.where(and(owned, eq(playSession.id, id)))
			),
		...insertChunks(
			plan
				.filter((row) => !row.existing)
				.map(({ id, play, seq }) => ({
					id,
					userId,
					entryId: input.id,
					kind: stored.kind,
					seq,
					...playColumns(play, now),
					createdAt: now,
				})),
			(chunk) => db.insert(playSession).values(chunk)
		),
		...insertChunks(lineRows(input.id, userId, plan, now), (chunk) =>
			db.insert(ledgerLine).values(chunk)
		),
	];
}

function detailStatement(
	db: Database,
	userId: string,
	stored: StoredEntry,
	input: EntryUpdateInput
): BatchStatement[] {
	if (stored.kind === "cash") {
		if (input.evDiff === undefined) {
			return [];
		}
		return [
			db
				.update(entryCash)
				.set({ evDiff: input.evDiff })
				.where(
					and(eq(entryCash.entryId, input.id), eq(entryCash.userId, userId))
				),
		];
	}
	if (
		input.placement === undefined &&
		input.totalEntries === undefined &&
		input.beforeDeadline === undefined
	) {
		return [];
	}
	const beforeDeadline = input.beforeDeadline ?? stored.beforeDeadline;
	let placement =
		input.placement === undefined ? stored.placement : input.placement;
	if (beforeDeadline) {
		placement = null;
	}
	const totalEntries =
		input.totalEntries === undefined ? stored.totalEntries : input.totalEntries;
	if (placement !== null && totalEntries !== null && placement > totalEntries) {
		badRequest("Placement must be less than or equal to total entries");
	}
	return [
		db
			.update(entryTournament)
			.set({ placement, totalEntries, beforeDeadline })
			.where(
				and(
					eq(entryTournament.entryId, input.id),
					eq(entryTournament.userId, userId)
				)
			),
	];
}

export async function updateEntry(
	db: Database,
	userId: string,
	input: EntryUpdateInput,
	now: Date
): Promise<void> {
	const stored = await loadStoredEntry(db, userId, input.id);
	if (
		stored.source === "live" &&
		LIVE_DERIVED_FIELDS.some((field) => input[field] !== undefined)
	) {
		badRequest(
			"A live entry's days, money, times and results come from its events and cannot be edited here"
		);
	}
	assertKindFields(stored.kind, input);
	await assertMetadata(db, userId, input, stored);
	const detail = detailStatement(db, userId, stored, input);
	const money = await manualMoneyStatements(db, userId, stored, input, now);
	await runBatch(db, [
		db
			.update(entry)
			.set({
				playedOn: input.playedOn,
				roomId: input.roomId,
				assetId: input.assetId,
				title: input.title,
				memo: input.memo,
				updatedAt: now,
			})
			.where(and(eq(entry.id, input.id), eq(entry.userId, userId))),
		...detail,
		...money,
		...tagStatements(db, input.id, userId, input.tagIds, true),
	]);
}

export async function deleteEntry(
	db: Database,
	userId: string,
	id: string
): Promise<void> {
	await loadStoredEntry(db, userId, id);
	await db.delete(entry).where(and(eq(entry.id, id), eq(entry.userId, userId)));
}

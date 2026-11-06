import {
	type EntryProjection,
	type ProjectorEvent,
	projectEntry,
} from "../../packages/api/src/services/entry-projector";
import type { EntryKind } from "../../packages/db/src/constants/entry";
import { playEventPayloadSchema } from "../../packages/db/src/constants/play-event-payloads";
import type { ReplayPart } from "./catalogue";
import {
	type AuditDatabase,
	integer,
	nullableInteger,
	nullableText,
	type Row,
	sqlString,
	text,
} from "./database";

const ENTRY_PAGE = 100;

export type ReplayFindings = Record<ReplayPart, Row[]>;

interface StoredSession {
	breakMinutes: number;
	clockStartedAt: number | null;
	clockStartLevel: number | null;
	endedAt: number | null;
	endStack: number | null;
	endState: string | null;
	id: string;
	localDate: string;
	seq: number;
	startedAt: number | null;
	status: string;
}

interface StoredLine {
	assetId: string;
	effect: string;
	occurredAt: number;
	playSessionId: string | null;
	priceId: string | null;
	quantity: number;
	role: string;
	sourceEventId: string | null;
}

function entryKind(value: string): EntryKind {
	if (value !== "cash" && value !== "tournament") {
		throw new Error(`unknown entry kind ${value}`);
	}
	return value;
}

function seconds(date: Date | null): number | null {
	return date === null ? null : Math.floor(date.getTime() / 1000);
}

function groupBy<T>(rows: Row[], key: string, map: (row: Row) => T) {
	const groups = new Map<string, T[]>();
	for (const row of rows) {
		const id = text(row, key);
		const group = groups.get(id) ?? [];
		group.push(map(row));
		groups.set(id, group);
	}
	return groups;
}

function toEvent(row: Row): ProjectorEvent {
	return {
		id: text(row, "id"),
		occurredAt: new Date(integer(row, "occurred_at") * 1000),
		payload: text(row, "payload"),
		playSessionId: text(row, "play_session_id"),
		sortOrder: integer(row, "sort_order"),
		type: text(row, "type"),
	};
}

function payloadSchemaFindings(
	entryId: string,
	kind: EntryKind,
	events: readonly Row[]
): Row[] {
	const findings: Row[] = [];
	for (const event of events) {
		const id = text(event, "id");
		const type = text(event, "type");
		const version = integer(event, "schema_version");
		if (version !== 2) {
			findings.push({
				entry_id: entryId,
				event_id: id,
				problem: `schema_version ${version} is not 2`,
			});
			continue;
		}
		const schema = playEventPayloadSchema(kind, type);
		if (schema === null) {
			findings.push({
				entry_id: entryId,
				event_id: id,
				problem: `no ${kind} payload schema for ${type} v${version}`,
			});
			continue;
		}
		let payload: unknown;
		try {
			payload = JSON.parse(text(event, "payload"));
		} catch {
			findings.push({
				entry_id: entryId,
				event_id: id,
				problem: "payload is not valid JSON",
			});
			continue;
		}
		const parsed = schema.safeParse(payload);
		if (!parsed.success) {
			findings.push({
				entry_id: entryId,
				event_id: id,
				problem: parsed.error.issues
					.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
					.join("; "),
			});
		}
	}
	return findings;
}

type FieldPair = [field: string, stored: unknown, projected: unknown];

function compare(
	findings: Row[],
	entryId: string,
	target: string,
	pairs: readonly FieldPair[]
): void {
	for (const [field, stored, projected] of pairs) {
		if (stored !== projected) {
			findings.push({ entry_id: entryId, field, projected, stored, target });
		}
	}
}

interface EntryReplayInput {
	entry: Row;
	events: ProjectorEvent[];
	lines: Map<string, StoredLine>;
	sessions: StoredSession[];
}

function project(
	{ events, sessions }: EntryReplayInput,
	kind: EntryKind
): EntryProjection {
	return projectEntry(events, {
		kind,
		playSessions: sessions.map(({ id, seq, localDate }) => ({
			id,
			localDate,
			seq,
		})),
	});
}

function compareCore(
	input: EntryReplayInput,
	projection: EntryProjection,
	core: Row[]
): void {
	const entryId = text(input.entry, "id");
	compare(core, entryId, "entry", [
		["status", text(input.entry, "status"), projection.status],
		["played_on", text(input.entry, "played_on"), projection.playedOn],
	]);
	const stored = new Map(
		input.sessions.map((session) => [session.id, session])
	);
	for (const day of projection.playSessions) {
		const row = stored.get(day.id);
		compare(core, entryId, `play_session ${day.id}`, [
			["started_at", row?.startedAt, seconds(day.startedAt)],
			["ended_at", row?.endedAt, seconds(day.endedAt)],
			["break_minutes", row?.breakMinutes, day.breakMinutes],
			["status", row?.status, day.status],
			["end_state", row?.endState, day.endState],
			["end_stack", row?.endStack, day.endStack],
			["clock_started_at", row?.clockStartedAt, seconds(day.clockStartedAt)],
			["clock_start_level", row?.clockStartLevel, day.clockStartLevel],
		]);
	}
	const { detail } = projection;
	if (detail.kind === "tournament") {
		compare(core, entryId, "entry_tournament", [
			[
				"placement",
				nullableInteger(input.entry, "placement"),
				detail.placement,
			],
			[
				"total_entries",
				nullableInteger(input.entry, "total_entries"),
				detail.totalEntries,
			],
			[
				"before_deadline",
				nullableInteger(input.entry, "before_deadline") === 1,
				detail.beforeDeadline,
			],
		]);
	}
}

function compareLines(
	input: EntryReplayInput,
	projection: EntryProjection,
	found: Row[]
): void {
	const entryId = text(input.entry, "id");
	const projected = new Set(projection.lines.map((line) => line.id));
	for (const line of projection.lines) {
		const row = input.lines.get(line.id);
		const target = `ledger_line ${line.id}`;
		if (!row) {
			compare(found, entryId, target, [["row", null, "projected"]]);
			continue;
		}
		compare(found, entryId, target, [
			["asset_id", row.assetId, line.assetId],
			["price_id", row.priceId, line.priceId],
			["quantity", row.quantity, line.quantity],
			["role", row.role, line.role],
			["effect", row.effect, line.effect],
			["play_session_id", row.playSessionId, line.playSessionId],
			["source_event_id", row.sourceEventId, line.sourceEventId],
			["occurred_at", row.occurredAt, seconds(line.occurredAt)],
		]);
	}
	for (const id of input.lines.keys()) {
		if (!projected.has(id)) {
			compare(found, entryId, `ledger_line ${id}`, [["row", "stored", null]]);
		}
	}
}

function replayEntry(
	input: EntryReplayInput,
	parts: ReadonlySet<ReplayPart>,
	findings: ReplayFindings
): void {
	const entryId = text(input.entry, "id");
	let projection: EntryProjection;
	try {
		projection = project(input, entryKind(text(input.entry, "kind")));
	} catch (error) {
		compare(findings["a6-core"], entryId, "entry", [
			[
				"projectEntry",
				null,
				error instanceof Error ? error.message : String(error),
			],
		]);
		return;
	}
	compareCore(input, projection, findings["a6-core"]);
	const { detail } = projection;
	const evPart = projection.status === "settled" ? "a6-core" : "a6-open-ev";
	if (detail.kind === "cash" && parts.has(evPart)) {
		compare(findings[evPart], entryId, "entry_cash", [
			["ev_diff", nullableInteger(input.entry, "ev_diff"), detail.evDiff],
		]);
	}
	if (parts.has("a6-lines")) {
		compareLines(input, projection, findings["a6-lines"]);
	}
}

function entryStatements(
	ids: readonly string[],
	parts: ReadonlySet<ReplayPart>
) {
	const list = ids.map(sqlString).join(",");
	const replays =
		parts.has("a6-core") || parts.has("a6-lines") || parts.has("a6-open-ev");
	return {
		replays,
		statements: [
			replays
				? `SELECT e.id AS id, e.kind AS kind, e.source AS source, e.status AS status, e.played_on AS played_on,
ec.ev_diff AS ev_diff, et.placement AS placement, et.total_entries AS total_entries, et.before_deadline AS before_deadline
FROM entry e
LEFT JOIN entry_cash ec ON ec.entry_id = e.id AND ec.user_id = e.user_id
LEFT JOIN entry_tournament et ON et.entry_id = e.id AND et.user_id = e.user_id
WHERE e.id IN (${list})`
				: `SELECT id, kind FROM entry WHERE id IN (${list})`,
			`SELECT pe.id AS id, pe.entry_id AS entry_id, pe.play_session_id AS play_session_id, pe.type AS type,
pe.schema_version AS schema_version, pe.occurred_at AS occurred_at, pe.sort_order AS sort_order, pe.payload AS payload
FROM play_event pe JOIN entry e ON e.id = pe.entry_id AND e.user_id = pe.user_id
WHERE pe.entry_id IN (${list})`,
			...(replays
				? [
						`SELECT p.id AS id, p.entry_id AS entry_id, p.seq AS seq, p.local_date AS local_date, p.started_at AS started_at,
p.ended_at AS ended_at, p.break_minutes AS break_minutes, p.status AS status, p.end_state AS end_state,
p.end_stack AS end_stack, p.clock_started_at AS clock_started_at, p.clock_start_level AS clock_start_level
FROM play_session p JOIN entry e ON e.id = p.entry_id AND e.user_id = p.user_id
WHERE p.entry_id IN (${list}) ORDER BY p.entry_id, p.seq`,
						`SELECT l.id AS id, l.entry_id AS entry_id, l.asset_id AS asset_id, l.price_id AS price_id, l.quantity AS quantity, l.role AS role,
l.effect AS effect, l.play_session_id AS play_session_id, l.source_event_id AS source_event_id, l.occurred_at AS occurred_at
FROM ledger_line l JOIN entry e ON e.id = l.entry_id AND e.user_id = l.user_id
WHERE l.entry_id IN (${list}) AND l.source_event_id IS NOT NULL`,
					]
				: []),
		],
	};
}

export function runReplay(
	db: AuditDatabase,
	parts: ReadonlySet<ReplayPart>
): ReplayFindings {
	const findings: ReplayFindings = {
		"a6-core": [],
		"a6-lines": [],
		"a6-open-ev": [],
		"a15-payload-schema": [],
	};
	const [selectedEntries = []] = db.query([
		parts.has("a15-payload-schema")
			? "SELECT id FROM entry ORDER BY id"
			: "SELECT id FROM entry WHERE source = 'live' ORDER BY id",
	]);
	const ids = selectedEntries.map((row) => text(row, "id"));
	for (let i = 0; i < ids.length; i += ENTRY_PAGE) {
		const { replays, statements } = entryStatements(
			ids.slice(i, i + ENTRY_PAGE),
			parts
		);
		const [entries = [], eventRows = [], sessionRows = [], lineRows = []] =
			db.query(statements);
		const events = groupBy(eventRows, "entry_id", toEvent);
		const schemaEvents = groupBy(eventRows, "entry_id", (row) => row);
		const sessions = groupBy(sessionRows, "entry_id", (row) => ({
			breakMinutes: integer(row, "break_minutes"),
			clockStartedAt: nullableInteger(row, "clock_started_at"),
			clockStartLevel: nullableInteger(row, "clock_start_level"),
			endedAt: nullableInteger(row, "ended_at"),
			endStack: nullableInteger(row, "end_stack"),
			endState: nullableText(row, "end_state"),
			id: text(row, "id"),
			localDate: text(row, "local_date"),
			seq: integer(row, "seq"),
			startedAt: nullableInteger(row, "started_at"),
			status: text(row, "status"),
		}));
		const lines = groupBy(lineRows, "entry_id", (row) => ({
			assetId: text(row, "asset_id"),
			effect: text(row, "effect"),
			id: text(row, "id"),
			occurredAt: integer(row, "occurred_at"),
			playSessionId: nullableText(row, "play_session_id"),
			priceId: nullableText(row, "price_id"),
			quantity: integer(row, "quantity"),
			role: text(row, "role"),
			sourceEventId: nullableText(row, "source_event_id"),
		}));
		for (const entry of entries) {
			const entryId = text(entry, "id");
			const entryEvents = events.get(entryId) ?? [];
			if (parts.has("a15-payload-schema")) {
				findings["a15-payload-schema"].push(
					...payloadSchemaFindings(
						entryId,
						entryKind(text(entry, "kind")),
						schemaEvents.get(entryId) ?? []
					)
				);
			}
			if (replays && text(entry, "source") === "live") {
				replayEntry(
					{
						entry,
						events: entryEvents,
						lines: new Map(
							(lines.get(entryId) ?? []).map(({ id, ...line }) => [id, line])
						),
						sessions: sessions.get(entryId) ?? [],
					},
					parts,
					findings
				);
			}
		}
	}
	return findings;
}

export type ProcedureKind = "query" | "mutation";

export type FieldKind =
	| "string"
	| "number"
	| "boolean"
	| "json"
	| "stringArray";

export interface ProcedureField {
	defaultValue?: string;
	description?: string;
	kind: FieldKind;
	name: string;
	nullable?: boolean;
	required?: boolean;
}

export interface ProcedureMeta {
	fields: ProcedureField[];
	kind: ProcedureKind;
	procedure: string;
	router: string;
}

const ID = (
	name = "id",
	required = true,
	kind: FieldKind = "string"
): ProcedureField => ({ name, kind, required });

const STR = (
	name: string,
	required = false,
	defaultValue = "",
	nullable = false
): ProcedureField => ({
	name,
	kind: "string",
	required,
	defaultValue,
	nullable,
});

const NUM = (
	name: string,
	required = false,
	defaultValue = "",
	nullable = false
): ProcedureField => ({
	name,
	kind: "number",
	required,
	defaultValue,
	nullable,
});

const BOOL = (
	name: string,
	required = false,
	defaultValue = "false"
): ProcedureField => ({ name, kind: "boolean", required, defaultValue });

const JSON_F = (
	name: string,
	required = false,
	defaultValue = ""
): ProcedureField => ({ name, kind: "json", required, defaultValue });

const ARR_STR = (name: string, required = false): ProcedureField => ({
	name,
	kind: "stringArray",
	required,
	defaultValue: "",
});

export const PROCEDURES: ProcedureMeta[] = [
	{ router: "healthCheck", procedure: "", kind: "query", fields: [] },

	{
		router: "aiExtract",
		procedure: "extractTournamentData",
		kind: "mutation",
		fields: [STR("text", true)],
	},
	{
		router: "aiExtract",
		procedure: "extractTablePlayers",
		kind: "mutation",
		fields: [STR("text", true)],
	},

	{ router: "store", procedure: "list", kind: "query", fields: [] },
	{ router: "store", procedure: "getById", kind: "query", fields: [ID()] },
	{
		router: "store",
		procedure: "create",
		kind: "mutation",
		fields: [STR("name", true), STR("memo", false, "", true)],
	},
	{
		router: "store",
		procedure: "update",
		kind: "mutation",
		fields: [ID(), STR("name"), STR("memo", false, "", true)],
	},
	{ router: "store", procedure: "delete", kind: "mutation", fields: [ID()] },

	{ router: "currency", procedure: "list", kind: "query", fields: [] },
	{
		router: "currency",
		procedure: "create",
		kind: "mutation",
		fields: [STR("name", true), STR("unit", true)],
	},
	{
		router: "currency",
		procedure: "update",
		kind: "mutation",
		fields: [ID(), STR("name"), STR("unit")],
	},
	{ router: "currency", procedure: "delete", kind: "mutation", fields: [ID()] },

	{
		router: "currencyTransaction",
		procedure: "listByCurrency",
		kind: "query",
		fields: [STR("currencyId", true)],
	},
	{
		router: "currencyTransaction",
		procedure: "create",
		kind: "mutation",
		fields: [
			STR("currencyId", true),
			STR("transactionTypeId", true),
			NUM("amount", true),
			NUM("occurredAt", true),
			STR("memo", false, "", true),
		],
	},
	{
		router: "currencyTransaction",
		procedure: "update",
		kind: "mutation",
		fields: [
			ID(),
			NUM("amount"),
			NUM("occurredAt"),
			STR("memo", false, "", true),
		],
	},
	{
		router: "currencyTransaction",
		procedure: "delete",
		kind: "mutation",
		fields: [ID()],
	},

	{ router: "transactionType", procedure: "list", kind: "query", fields: [] },
	{
		router: "transactionType",
		procedure: "create",
		kind: "mutation",
		fields: [STR("name", true), NUM("sign", true)],
	},
	{
		router: "transactionType",
		procedure: "update",
		kind: "mutation",
		fields: [ID(), STR("name"), NUM("sign")],
	},
	{
		router: "transactionType",
		procedure: "delete",
		kind: "mutation",
		fields: [ID()],
	},

	{ router: "player", procedure: "list", kind: "query", fields: [] },
	{ router: "player", procedure: "getById", kind: "query", fields: [ID()] },
	{
		router: "player",
		procedure: "create",
		kind: "mutation",
		fields: [STR("name", true), ARR_STR("tagIds")],
	},
	{
		router: "player",
		procedure: "update",
		kind: "mutation",
		fields: [ID(), STR("name"), ARR_STR("tagIds")],
	},
	{ router: "player", procedure: "delete", kind: "mutation", fields: [ID()] },

	{ router: "playerTag", procedure: "list", kind: "query", fields: [] },
	{
		router: "playerTag",
		procedure: "create",
		kind: "mutation",
		fields: [STR("name", true), STR("color", true, "gray")],
	},
	{
		router: "playerTag",
		procedure: "update",
		kind: "mutation",
		fields: [ID(), STR("name"), STR("color")],
	},
	{
		router: "playerTag",
		procedure: "delete",
		kind: "mutation",
		fields: [ID()],
	},

	{ router: "sessionTag", procedure: "list", kind: "query", fields: [] },
	{
		router: "sessionTag",
		procedure: "create",
		kind: "mutation",
		fields: [STR("name", true)],
	},
	{
		router: "sessionTag",
		procedure: "update",
		kind: "mutation",
		fields: [ID(), STR("name")],
	},
	{
		router: "sessionTag",
		procedure: "delete",
		kind: "mutation",
		fields: [ID()],
	},

	{
		router: "ringGame",
		procedure: "listByStore",
		kind: "query",
		fields: [STR("storeId", true)],
	},
	{ router: "ringGame", procedure: "getById", kind: "query", fields: [ID()] },
	{
		router: "ringGame",
		procedure: "create",
		kind: "mutation",
		fields: [
			STR("storeId", true),
			STR("name", true),
			NUM("variantId", true, "1"),
			NUM("minBuyIn", false, "", true),
			NUM("maxBuyIn", false, "", true),
			NUM("tableSize", false, "", true),
			STR("currencyId", false, "", true),
			STR("memo", false, "", true),
			JSON_F(
				"blindSets",
				false,
				'[{"limitFormatId":1,"blind1":100,"blind2":200}]'
			),
		],
	},
	{
		router: "ringGame",
		procedure: "update",
		kind: "mutation",
		fields: [
			ID(),
			STR("name"),
			NUM("variantId", false, "", true),
			NUM("minBuyIn", false, "", true),
			NUM("maxBuyIn", false, "", true),
			NUM("tableSize", false, "", true),
			STR("currencyId", false, "", true),
			STR("memo", false, "", true),
		],
	},
	{
		router: "ringGame",
		procedure: "archive",
		kind: "mutation",
		fields: [ID()],
	},
	{
		router: "ringGame",
		procedure: "restore",
		kind: "mutation",
		fields: [ID()],
	},
	{ router: "ringGame", procedure: "delete", kind: "mutation", fields: [ID()] },
	{
		router: "ringGame",
		procedure: "listBlindSets",
		kind: "query",
		fields: [STR("ringGameId", true)],
	},
	{
		router: "ringGame",
		procedure: "addBlindSet",
		kind: "mutation",
		fields: [
			STR("ringGameId", true),
			NUM("limitFormatId", true, "1"),
			NUM("blind1", true, "100"),
			NUM("blind2", true, "200"),
			NUM("blind3", false, "", true),
			NUM("blind4", false, "", true),
			NUM("ante", false, "", true),
			STR("anteType", false, "", true),
		],
	},
	{
		router: "ringGame",
		procedure: "updateBlindSet",
		kind: "mutation",
		fields: [
			ID("id", true, "number"),
			NUM("blind1"),
			NUM("blind2"),
			NUM("blind3", false, "", true),
			NUM("blind4", false, "", true),
			NUM("ante", false, "", true),
			STR("anteType", false, "", true),
		],
	},
	{
		router: "ringGame",
		procedure: "removeBlindSet",
		kind: "mutation",
		fields: [ID("id", true, "number")],
	},

	{
		router: "tournament",
		procedure: "listByStore",
		kind: "query",
		fields: [STR("storeId", true)],
	},
	{ router: "tournament", procedure: "getById", kind: "query", fields: [ID()] },
	{
		router: "tournament",
		procedure: "create",
		kind: "mutation",
		fields: [
			STR("storeId", true),
			STR("name", true),
			NUM("variantId", true, "1"),
			NUM("buyIn", false, "", true),
			NUM("entryFee", false, "", true),
			NUM("startingStack", false, "", true),
			NUM("bountyAmount", false, "", true),
			NUM("tableSize", false, "", true),
			STR("currencyId", false, "", true),
			STR("memo", false, "", true),
		],
	},
	{
		router: "tournament",
		procedure: "update",
		kind: "mutation",
		fields: [
			ID(),
			STR("name"),
			NUM("variantId", false, "", true),
			NUM("buyIn", false, "", true),
			NUM("entryFee", false, "", true),
			NUM("startingStack", false, "", true),
			NUM("bountyAmount", false, "", true),
			NUM("tableSize", false, "", true),
			STR("currencyId", false, "", true),
			STR("memo", false, "", true),
		],
	},
	{
		router: "tournament",
		procedure: "archive",
		kind: "mutation",
		fields: [ID()],
	},
	{
		router: "tournament",
		procedure: "restore",
		kind: "mutation",
		fields: [ID()],
	},
	{
		router: "tournament",
		procedure: "delete",
		kind: "mutation",
		fields: [ID()],
	},
	{
		router: "tournament",
		procedure: "addTag",
		kind: "mutation",
		fields: [STR("tournamentId", true), STR("tagId", true)],
	},
	{
		router: "tournament",
		procedure: "removeTag",
		kind: "mutation",
		fields: [STR("tournamentId", true), STR("tagId", true)],
	},
	{
		router: "tournament",
		procedure: "listBlindLevels",
		kind: "query",
		fields: [STR("tournamentId", true)],
	},
	{
		router: "tournament",
		procedure: "addBlindLevel",
		kind: "mutation",
		fields: [
			STR("tournamentId", true),
			NUM("levelIndex", true, "1"),
			BOOL("isBreak", true, "false"),
			NUM("minutes", false, "20", true),
		],
	},
	{
		router: "tournament",
		procedure: "updateBlindLevel",
		kind: "mutation",
		fields: [
			ID("id", true, "number"),
			NUM("levelIndex"),
			BOOL("isBreak"),
			NUM("minutes", false, "", true),
		],
	},
	{
		router: "tournament",
		procedure: "removeBlindLevel",
		kind: "mutation",
		fields: [ID("id", true, "number")],
	},
	{
		router: "tournament",
		procedure: "addBlindSet",
		kind: "mutation",
		fields: [
			NUM("tournamentBlindLevelId", true),
			NUM("limitFormatId", true, "1"),
			NUM("blind1", true, "100"),
			NUM("blind2", true, "200"),
			NUM("blind3", false, "", true),
			NUM("blind4", false, "", true),
			NUM("ante", false, "", true),
			STR("anteType", false, "", true),
		],
	},
	{
		router: "tournament",
		procedure: "updateBlindSet",
		kind: "mutation",
		fields: [
			ID("id", true, "number"),
			NUM("blind1"),
			NUM("blind2"),
			NUM("blind3", false, "", true),
			NUM("blind4", false, "", true),
			NUM("ante", false, "", true),
			STR("anteType", false, "", true),
		],
	},
	{
		router: "tournament",
		procedure: "removeBlindSet",
		kind: "mutation",
		fields: [ID("id", true, "number")],
	},

	{
		router: "tournamentChipPurchase",
		procedure: "listByTournament",
		kind: "query",
		fields: [STR("tournamentId", true)],
	},
	{
		router: "tournamentChipPurchase",
		procedure: "create",
		kind: "mutation",
		fields: [
			STR("tournamentId", true),
			STR("name", true),
			NUM("cost", true, "1000"),
			NUM("chips", true, "5000"),
		],
	},
	{
		router: "tournamentChipPurchase",
		procedure: "update",
		kind: "mutation",
		fields: [ID(), STR("name"), NUM("cost"), NUM("chips")],
	},
	{
		router: "tournamentChipPurchase",
		procedure: "delete",
		kind: "mutation",
		fields: [ID()],
	},
	{
		router: "tournamentChipPurchase",
		procedure: "reorder",
		kind: "mutation",
		fields: [STR("tournamentId", true), ARR_STR("orderedIds", true)],
	},

	{
		router: "session",
		procedure: "list",
		kind: "query",
		fields: [
			NUM("limit", false, "20"),
			STR("cursor", false, "", true),
			STR("kind", false, "", true),
			ARR_STR("storeIds"),
			ARR_STR("tagIds"),
		],
	},
	{ router: "session", procedure: "getById", kind: "query", fields: [ID()] },
	{
		router: "session",
		procedure: "create",
		kind: "mutation",
		fields: [
			JSON_F(
				"_body",
				true,
				'{\n  "type": "cash_game",\n  "sessionDate": 1700000000,\n  "buyIn": 10000,\n  "cashOut": 15000,\n  "variant": "nlh",\n  "blind1": 100,\n  "blind2": 200\n}'
			),
		],
	},
	{
		router: "session",
		procedure: "update",
		kind: "mutation",
		fields: [JSON_F("_body", true, '{\n  "id": "",\n  "memo": "Updated"\n}')],
	},
	{ router: "session", procedure: "delete", kind: "mutation", fields: [ID()] },

	{
		router: "sessionEvent",
		procedure: "list",
		kind: "query",
		fields: [STR("sessionId", true)],
	},
	{
		router: "sessionEvent",
		procedure: "create",
		kind: "mutation",
		fields: [
			STR("sessionId", true),
			STR("eventType", true, "session_pause"),
			NUM("occurredAt", true),
			JSON_F("payload", true, "{}"),
		],
	},
	{
		router: "sessionEvent",
		procedure: "update",
		kind: "mutation",
		fields: [ID(), NUM("occurredAt", false, "", true), JSON_F("payload")],
	},
	{
		router: "sessionEvent",
		procedure: "delete",
		kind: "mutation",
		fields: [ID()],
	},
	{
		router: "sessionEvent",
		procedure: "addPlayer",
		kind: "mutation",
		fields: [
			STR("sessionId", true),
			STR("playerId", true),
			BOOL("isHero", true, "false"),
			NUM("seatPosition", false, "", true),
		],
	},
	{
		router: "sessionEvent",
		procedure: "removePlayer",
		kind: "mutation",
		fields: [
			STR("sessionId", true),
			STR("playerId", true),
			BOOL("isHero", true, "false"),
		],
	},
	{
		router: "sessionEvent",
		procedure: "addTemporaryPlayer",
		kind: "mutation",
		fields: [
			STR("sessionId", true),
			STR("name", true),
			NUM("seatPosition", false, "", true),
		],
	},

	{
		router: "liveSession",
		procedure: "getById",
		kind: "query",
		fields: [ID()],
	},
	{
		router: "liveSession",
		procedure: "create",
		kind: "mutation",
		fields: [
			STR("type", true, "cash_game"),
			JSON_F(
				"_body",
				true,
				'{\n  "type": "cash_game",\n  "ruleName": "Imported",\n  "variantId": 1,\n  "blindSets": [{ "limitFormatId": 1, "blind1": 100, "blind2": 200 }]\n}'
			),
		],
	},
	{
		router: "liveSession",
		procedure: "complete",
		kind: "mutation",
		fields: [ID()],
	},
	{
		router: "liveSession",
		procedure: "reopen",
		kind: "mutation",
		fields: [ID()],
	},
	{
		router: "liveSession",
		procedure: "discard",
		kind: "mutation",
		fields: [ID()],
	},
	{
		router: "liveSession",
		procedure: "update",
		kind: "mutation",
		fields: [
			ID(),
			STR("memo", false, "", true),
			STR("sessionDate"),
			STR("storeId", false, "", true),
			STR("currencyId", false, "", true),
			ARR_STR("tagIds"),
		],
	},
	{
		router: "liveSession",
		procedure: "updateRule",
		kind: "mutation",
		fields: [
			ID(),
			JSON_F("_body", true, '{\n  "id": "",\n  "ruleName": "New rule"\n}'),
		],
	},
	{
		router: "liveSession",
		procedure: "addBlindLevel",
		kind: "mutation",
		fields: [
			STR("sessionId", true),
			NUM("levelIndex", true, "1"),
			BOOL("isBreak", true, "false"),
			NUM("minutes", false, "20", true),
		],
	},
	{
		router: "liveSession",
		procedure: "updateBlindLevel",
		kind: "mutation",
		fields: [
			ID("id", true, "number"),
			NUM("levelIndex"),
			BOOL("isBreak"),
			NUM("minutes", false, "", true),
		],
	},
	{
		router: "liveSession",
		procedure: "removeBlindLevel",
		kind: "mutation",
		fields: [ID("id", true, "number")],
	},
	{
		router: "liveSession",
		procedure: "addBlindSet",
		kind: "mutation",
		fields: [
			JSON_F(
				"_body",
				true,
				'{\n  "sessionId": "",\n  "limitFormatId": 1,\n  "blind1": 100,\n  "blind2": 200\n}'
			),
		],
	},
	{
		router: "liveSession",
		procedure: "updateBlindSet",
		kind: "mutation",
		fields: [
			ID("id", true, "number"),
			NUM("blind1"),
			NUM("blind2"),
			NUM("blind3", false, "", true),
			NUM("blind4", false, "", true),
			NUM("ante", false, "", true),
			STR("anteType", false, "", true),
		],
	},
	{
		router: "liveSession",
		procedure: "removeBlindSet",
		kind: "mutation",
		fields: [ID("id", true, "number")],
	},
	{
		router: "liveSession",
		procedure: "addChipPurchaseOption",
		kind: "mutation",
		fields: [
			STR("sessionId", true),
			STR("name", true),
			NUM("cost", true, "1000"),
			NUM("chips", true, "5000"),
		],
	},
	{
		router: "liveSession",
		procedure: "updateChipPurchaseOption",
		kind: "mutation",
		fields: [ID(), STR("name"), NUM("cost"), NUM("chips")],
	},
	{
		router: "liveSession",
		procedure: "removeChipPurchaseOption",
		kind: "mutation",
		fields: [ID()],
	},

	{ router: "limitFormat", procedure: "list", kind: "query", fields: [] },
	{
		router: "limitFormat",
		procedure: "create",
		kind: "mutation",
		fields: [
			STR("name", true),
			STR("blind1Label", true, "Small blind"),
			STR("blind2Label", true, "Big blind"),
			STR("blind3Label", false, "", true),
			STR("blind4Label", false, "", true),
		],
	},
	{
		router: "limitFormat",
		procedure: "update",
		kind: "mutation",
		fields: [
			ID("id", true, "number"),
			STR("name"),
			STR("blind1Label"),
			STR("blind2Label"),
			STR("blind3Label", false, "", true),
			STR("blind4Label", false, "", true),
		],
	},
	{
		router: "limitFormat",
		procedure: "delete",
		kind: "mutation",
		fields: [ID("id", true, "number")],
	},

	{ router: "variant", procedure: "list", kind: "query", fields: [] },
	{
		router: "variant",
		procedure: "create",
		kind: "mutation",
		fields: [STR("name", true)],
	},
	{
		router: "variant",
		procedure: "update",
		kind: "mutation",
		fields: [ID("id", true, "number"), STR("name")],
	},
	{
		router: "variant",
		procedure: "delete",
		kind: "mutation",
		fields: [ID("id", true, "number")],
	},

	{ router: "dashboardWidget", procedure: "list", kind: "query", fields: [] },
	{
		router: "dashboardWidget",
		procedure: "create",
		kind: "mutation",
		fields: [
			STR("kind", true, "session_count"),
			JSON_F("settings", true, "{}"),
		],
	},
	{
		router: "dashboardWidget",
		procedure: "update",
		kind: "mutation",
		fields: [ID(), JSON_F("settings", true, "{}")],
	},
	{
		router: "dashboardWidget",
		procedure: "updateLayouts",
		kind: "mutation",
		fields: [JSON_F("layouts", true, '[{"id":"","x":0,"y":0,"w":1,"h":1}]')],
	},
	{
		router: "dashboardWidget",
		procedure: "delete",
		kind: "mutation",
		fields: [ID()],
	},

	{ router: "updateNoteView", procedure: "list", kind: "query", fields: [] },
	{
		router: "updateNoteView",
		procedure: "getLatestViewedVersion",
		kind: "query",
		fields: [],
	},
	{
		router: "updateNoteView",
		procedure: "markViewed",
		kind: "mutation",
		fields: [STR("version", true, "1.0.0")],
	},
];

export const PROCEDURE_KEYS = PROCEDURES.map((p) =>
	p.procedure === "" ? p.router : `${p.router}.${p.procedure}`
);

export function procedureKey(meta: ProcedureMeta): string {
	return meta.procedure === ""
		? meta.router
		: `${meta.router}.${meta.procedure}`;
}

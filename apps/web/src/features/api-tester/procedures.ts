export type ProcedureKind = "query" | "mutation";

export interface ProcedureMeta {
	inputHint: string;
	kind: ProcedureKind;
	procedure: string;
	router: string;
}

export const PROCEDURES: ProcedureMeta[] = [
	{ router: "healthCheck", procedure: "", kind: "query", inputHint: "" },

	{
		router: "aiExtract",
		procedure: "extractTournamentData",
		kind: "mutation",
		inputHint: '{ "text": "" }',
	},
	{
		router: "aiExtract",
		procedure: "extractTablePlayers",
		kind: "mutation",
		inputHint: '{ "text": "" }',
	},

	{ router: "store", procedure: "list", kind: "query", inputHint: "" },
	{
		router: "store",
		procedure: "getById",
		kind: "query",
		inputHint: '{ "id": "" }',
	},
	{
		router: "store",
		procedure: "create",
		kind: "mutation",
		inputHint: '{ "name": "Test store", "memo": null }',
	},
	{
		router: "store",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": "", "name": "Renamed" }',
	},
	{
		router: "store",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},

	{ router: "currency", procedure: "list", kind: "query", inputHint: "" },
	{
		router: "currency",
		procedure: "create",
		kind: "mutation",
		inputHint: '{ "name": "JPY", "unit": "¥" }',
	},
	{
		router: "currency",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": "", "name": "JPY" }',
	},
	{
		router: "currency",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},

	{
		router: "currencyTransaction",
		procedure: "listByCurrency",
		kind: "query",
		inputHint: '{ "currencyId": "" }',
	},
	{
		router: "currencyTransaction",
		procedure: "create",
		kind: "mutation",
		inputHint:
			'{ "currencyId": "", "transactionTypeId": "", "amount": 1000, "occurredAt": 0 }',
	},
	{
		router: "currencyTransaction",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": "", "amount": 1000 }',
	},
	{
		router: "currencyTransaction",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},

	{
		router: "transactionType",
		procedure: "list",
		kind: "query",
		inputHint: "",
	},
	{
		router: "transactionType",
		procedure: "create",
		kind: "mutation",
		inputHint: '{ "name": "Deposit", "sign": 1 }',
	},
	{
		router: "transactionType",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": "", "name": "Deposit" }',
	},
	{
		router: "transactionType",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},

	{ router: "player", procedure: "list", kind: "query", inputHint: "" },
	{
		router: "player",
		procedure: "getById",
		kind: "query",
		inputHint: '{ "id": "" }',
	},
	{
		router: "player",
		procedure: "create",
		kind: "mutation",
		inputHint: '{ "name": "Alice" }',
	},
	{
		router: "player",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": "", "name": "Renamed" }',
	},
	{
		router: "player",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},

	{ router: "playerTag", procedure: "list", kind: "query", inputHint: "" },
	{
		router: "playerTag",
		procedure: "create",
		kind: "mutation",
		inputHint: '{ "name": "VIP", "color": "gray" }',
	},
	{
		router: "playerTag",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": "", "name": "VIP" }',
	},
	{
		router: "playerTag",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},

	{ router: "sessionTag", procedure: "list", kind: "query", inputHint: "" },
	{
		router: "sessionTag",
		procedure: "create",
		kind: "mutation",
		inputHint: '{ "name": "MTT" }',
	},
	{
		router: "sessionTag",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": "", "name": "MTT" }',
	},
	{
		router: "sessionTag",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},

	{
		router: "ringGame",
		procedure: "listByStore",
		kind: "query",
		inputHint: '{ "storeId": "" }',
	},
	{
		router: "ringGame",
		procedure: "getById",
		kind: "query",
		inputHint: '{ "id": "" }',
	},
	{
		router: "ringGame",
		procedure: "create",
		kind: "mutation",
		inputHint:
			'{ "storeId": "", "name": "1/2 NL", "variantId": 1, "blindSets": [{ "limitFormatId": 1, "blind1": 100, "blind2": 200 }] }',
	},
	{
		router: "ringGame",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": "", "name": "Renamed" }',
	},
	{
		router: "ringGame",
		procedure: "archive",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},
	{
		router: "ringGame",
		procedure: "restore",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},
	{
		router: "ringGame",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},
	{
		router: "ringGame",
		procedure: "listBlindSets",
		kind: "query",
		inputHint: '{ "ringGameId": "" }',
	},
	{
		router: "ringGame",
		procedure: "addBlindSet",
		kind: "mutation",
		inputHint:
			'{ "ringGameId": "", "limitFormatId": 1, "blind1": 100, "blind2": 200 }',
	},
	{
		router: "ringGame",
		procedure: "updateBlindSet",
		kind: "mutation",
		inputHint: '{ "id": 0, "blind1": 100, "blind2": 200 }',
	},
	{
		router: "ringGame",
		procedure: "removeBlindSet",
		kind: "mutation",
		inputHint: '{ "id": 0 }',
	},

	{
		router: "tournament",
		procedure: "listByStore",
		kind: "query",
		inputHint: '{ "storeId": "" }',
	},
	{
		router: "tournament",
		procedure: "getById",
		kind: "query",
		inputHint: '{ "id": "" }',
	},
	{
		router: "tournament",
		procedure: "create",
		kind: "mutation",
		inputHint: '{ "storeId": "", "name": "Sunday Major", "variantId": 1 }',
	},
	{
		router: "tournament",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": "", "name": "Renamed" }',
	},
	{
		router: "tournament",
		procedure: "archive",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},
	{
		router: "tournament",
		procedure: "restore",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},
	{
		router: "tournament",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},
	{
		router: "tournament",
		procedure: "addTag",
		kind: "mutation",
		inputHint: '{ "tournamentId": "", "tagId": "" }',
	},
	{
		router: "tournament",
		procedure: "removeTag",
		kind: "mutation",
		inputHint: '{ "tournamentId": "", "tagId": "" }',
	},
	{
		router: "tournament",
		procedure: "listBlindLevels",
		kind: "query",
		inputHint: '{ "tournamentId": "" }',
	},
	{
		router: "tournament",
		procedure: "addBlindLevel",
		kind: "mutation",
		inputHint:
			'{ "tournamentId": "", "levelIndex": 1, "isBreak": false, "minutes": 20 }',
	},
	{
		router: "tournament",
		procedure: "updateBlindLevel",
		kind: "mutation",
		inputHint: '{ "id": 0, "minutes": 20 }',
	},
	{
		router: "tournament",
		procedure: "removeBlindLevel",
		kind: "mutation",
		inputHint: '{ "id": 0 }',
	},
	{
		router: "tournament",
		procedure: "addBlindSet",
		kind: "mutation",
		inputHint:
			'{ "tournamentBlindLevelId": 0, "limitFormatId": 1, "blind1": 100, "blind2": 200 }',
	},
	{
		router: "tournament",
		procedure: "updateBlindSet",
		kind: "mutation",
		inputHint: '{ "id": 0, "blind1": 100, "blind2": 200 }',
	},
	{
		router: "tournament",
		procedure: "removeBlindSet",
		kind: "mutation",
		inputHint: '{ "id": 0 }',
	},

	{
		router: "tournamentChipPurchase",
		procedure: "listByTournament",
		kind: "query",
		inputHint: '{ "tournamentId": "" }',
	},
	{
		router: "tournamentChipPurchase",
		procedure: "create",
		kind: "mutation",
		inputHint:
			'{ "tournamentId": "", "name": "Rebuy", "cost": 1000, "chips": 5000 }',
	},
	{
		router: "tournamentChipPurchase",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": "", "cost": 1000 }',
	},
	{
		router: "tournamentChipPurchase",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},
	{
		router: "tournamentChipPurchase",
		procedure: "reorder",
		kind: "mutation",
		inputHint: '{ "tournamentId": "", "orderedIds": [""] }',
	},

	{
		router: "session",
		procedure: "list",
		kind: "query",
		inputHint: '{ "limit": 20 }',
	},
	{
		router: "session",
		procedure: "getById",
		kind: "query",
		inputHint: '{ "id": "" }',
	},
	{
		router: "session",
		procedure: "create",
		kind: "mutation",
		inputHint:
			'{ "type": "cash_game", "sessionDate": 0, "buyIn": 10000, "cashOut": 15000, "variant": "nlh", "blind1": 100, "blind2": 200 }',
	},
	{
		router: "session",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": "", "memo": "Updated" }',
	},
	{
		router: "session",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},

	{
		router: "sessionEvent",
		procedure: "list",
		kind: "query",
		inputHint: '{ "sessionId": "" }',
	},
	{
		router: "sessionEvent",
		procedure: "create",
		kind: "mutation",
		inputHint:
			'{ "sessionId": "", "eventType": "session_pause", "occurredAt": 0, "payload": {} }',
	},
	{
		router: "sessionEvent",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": "", "payload": {} }',
	},
	{
		router: "sessionEvent",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},
	{
		router: "sessionEvent",
		procedure: "addPlayer",
		kind: "mutation",
		inputHint: '{ "sessionId": "", "playerId": "", "isHero": false }',
	},
	{
		router: "sessionEvent",
		procedure: "removePlayer",
		kind: "mutation",
		inputHint: '{ "sessionId": "", "playerId": "", "isHero": false }',
	},
	{
		router: "sessionEvent",
		procedure: "addTemporaryPlayer",
		kind: "mutation",
		inputHint: '{ "sessionId": "", "name": "Temp" }',
	},

	{
		router: "liveSession",
		procedure: "getById",
		kind: "query",
		inputHint: '{ "id": "" }',
	},
	{
		router: "liveSession",
		procedure: "create",
		kind: "mutation",
		inputHint:
			'{ "type": "cash_game", "ruleName": "Imported", "variantId": 1 }',
	},
	{
		router: "liveSession",
		procedure: "complete",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},
	{
		router: "liveSession",
		procedure: "reopen",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},
	{
		router: "liveSession",
		procedure: "discard",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},
	{
		router: "liveSession",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": "", "memo": "Updated" }',
	},
	{
		router: "liveSession",
		procedure: "updateRule",
		kind: "mutation",
		inputHint: '{ "id": "", "ruleName": "New rule" }',
	},
	{
		router: "liveSession",
		procedure: "addBlindLevel",
		kind: "mutation",
		inputHint:
			'{ "sessionId": "", "levelIndex": 1, "isBreak": false, "minutes": 20 }',
	},
	{
		router: "liveSession",
		procedure: "updateBlindLevel",
		kind: "mutation",
		inputHint: '{ "id": 0, "minutes": 20 }',
	},
	{
		router: "liveSession",
		procedure: "removeBlindLevel",
		kind: "mutation",
		inputHint: '{ "id": 0 }',
	},
	{
		router: "liveSession",
		procedure: "addBlindSet",
		kind: "mutation",
		inputHint:
			'{ "sessionId": "", "limitFormatId": 1, "blind1": 100, "blind2": 200 }',
	},
	{
		router: "liveSession",
		procedure: "updateBlindSet",
		kind: "mutation",
		inputHint: '{ "id": 0, "blind1": 100, "blind2": 200 }',
	},
	{
		router: "liveSession",
		procedure: "removeBlindSet",
		kind: "mutation",
		inputHint: '{ "id": 0 }',
	},
	{
		router: "liveSession",
		procedure: "addChipPurchaseOption",
		kind: "mutation",
		inputHint:
			'{ "sessionId": "", "name": "Rebuy", "cost": 1000, "chips": 5000 }',
	},
	{
		router: "liveSession",
		procedure: "updateChipPurchaseOption",
		kind: "mutation",
		inputHint: '{ "id": "", "cost": 1000 }',
	},
	{
		router: "liveSession",
		procedure: "removeChipPurchaseOption",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},

	{ router: "limitFormat", procedure: "list", kind: "query", inputHint: "" },
	{
		router: "limitFormat",
		procedure: "create",
		kind: "mutation",
		inputHint:
			'{ "name": "MyNL", "blind1Label": "SB", "blind2Label": "BB", "blind3Label": null, "blind4Label": null }',
	},
	{
		router: "limitFormat",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": 0, "name": "MyNL" }',
	},
	{
		router: "limitFormat",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": 0 }',
	},

	{ router: "variant", procedure: "list", kind: "query", inputHint: "" },
	{
		router: "variant",
		procedure: "create",
		kind: "mutation",
		inputHint: '{ "name": "My variant" }',
	},
	{
		router: "variant",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": 0, "name": "My variant" }',
	},
	{
		router: "variant",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": 0 }',
	},

	{
		router: "dashboardWidget",
		procedure: "list",
		kind: "query",
		inputHint: "",
	},
	{
		router: "dashboardWidget",
		procedure: "create",
		kind: "mutation",
		inputHint: '{ "kind": "session_count", "settings": {} }',
	},
	{
		router: "dashboardWidget",
		procedure: "update",
		kind: "mutation",
		inputHint: '{ "id": "", "settings": {} }',
	},
	{
		router: "dashboardWidget",
		procedure: "updateLayouts",
		kind: "mutation",
		inputHint: '{ "layouts": [{ "id": "", "x": 0, "y": 0, "w": 1, "h": 1 }] }',
	},
	{
		router: "dashboardWidget",
		procedure: "delete",
		kind: "mutation",
		inputHint: '{ "id": "" }',
	},

	{ router: "updateNoteView", procedure: "list", kind: "query", inputHint: "" },
	{
		router: "updateNoteView",
		procedure: "getLatestViewedVersion",
		kind: "query",
		inputHint: "",
	},
	{
		router: "updateNoteView",
		procedure: "markViewed",
		kind: "mutation",
		inputHint: '{ "version": "1.0.0" }',
	},
];

export const PROCEDURE_KEYS = PROCEDURES.map((p) =>
	p.procedure === "" ? p.router : `${p.router}.${p.procedure}`
);

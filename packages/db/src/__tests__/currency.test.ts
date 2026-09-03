import { describe, expect, it } from "vitest";
import {
	currency,
	currencyTransaction,
	transactionType,
} from "../schema/currency";
import { fkByColumn, indexByName, indexesOf } from "./test-utils";

describe("Currency — FKs and indexes", () => {
	it("userId FK cascades so currencies die with their owner", () => {
		expect(fkByColumn(currency, "user_id")).toEqual({
			columns: ["user_id"],
			foreignColumns: ["id"],
			foreignTable: "user",
			onDelete: "cascade",
		});
	});

	it("indexes userId for per-user lookups", () => {
		expect(indexesOf(currency)).toEqual([
			{
				columns: ["user_id"],
				name: "currency_userId_idx",
				unique: false,
				where: null,
			},
		]);
	});
});

describe("TransactionType — FKs and indexes", () => {
	it("userId FK cascades so transaction types die with their owner", () => {
		expect(fkByColumn(transactionType, "user_id")).toEqual({
			columns: ["user_id"],
			foreignColumns: ["id"],
			foreignTable: "user",
			onDelete: "cascade",
		});
	});

	it("indexes userId for per-user lookups", () => {
		expect(indexesOf(transactionType)).toEqual(
			expect.arrayContaining([
				{
					columns: ["user_id"],
					name: "transactionType_userId_idx",
					unique: false,
					where: null,
				},
			])
		);
	});

	it("allows only one Session Result type per user", () => {
		const index = indexByName(
			transactionType,
			"transactionType_sessionResultPerUser_idx"
		);
		expect(index?.unique).toBe(true);
		expect(index?.columns).toEqual(["user_id"]);
		expect(index?.where).toContain(
			'"transaction_type"."name" = \'Session Result\''
		);
	});
});

describe("CurrencyTransaction — FKs and indexes", () => {
	it("currencyId FK cascades so transactions die with their currency", () => {
		expect(fkByColumn(currencyTransaction, "currency_id")).toEqual({
			columns: ["currency_id"],
			foreignColumns: ["id"],
			foreignTable: "currency",
			onDelete: "cascade",
		});
	});

	it("transactionTypeId FK has no cascade so a referenced type cannot be deleted", () => {
		expect(fkByColumn(currencyTransaction, "transaction_type_id")).toEqual({
			columns: ["transaction_type_id"],
			foreignColumns: ["id"],
			foreignTable: "transaction_type",
			onDelete: undefined,
		});
	});

	it("sessionId FK cascades so transactions die with their linked session", () => {
		expect(fkByColumn(currencyTransaction, "session_id")).toEqual({
			columns: ["session_id"],
			foreignColumns: ["id"],
			foreignTable: "game_session",
			onDelete: "cascade",
		});
	});

	it("indexes currencyId, sessionId and transactionTypeId for lookups", () => {
		expect(indexesOf(currencyTransaction)).toEqual([
			{
				columns: ["currency_id"],
				name: "currencyTransaction_currencyId_idx",
				unique: false,
				where: null,
			},
			{
				columns: ["session_id"],
				name: "currencyTransaction_sessionId_idx",
				unique: false,
				where: null,
			},
			{
				columns: ["transaction_type_id"],
				name: "currencyTransaction_transactionTypeId_idx",
				unique: false,
				where: null,
			},
		]);
	});
});

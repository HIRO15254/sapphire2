import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { passkey } from "../schema/passkey";
import { fkByColumn, indexesOf } from "./test-utils";

describe("passkey schema (better-auth passkey plugin)", () => {
	it("has every field the better-auth passkey plugin reads and writes", () => {
		expect(Object.keys(getTableColumns(passkey))).toEqual(
			expect.arrayContaining([
				"aaguid",
				"backedUp",
				"counter",
				"createdAt",
				"credentialID",
				"deviceType",
				"id",
				"name",
				"publicKey",
				"transports",
				"userId",
			])
		);
	});

	it("cascades passkeys away when the owning user is deleted", () => {
		expect(fkByColumn(passkey, "user_id")).toEqual({
			columns: ["user_id"],
			foreignColumns: ["id"],
			foreignTable: "user",
			onDelete: "cascade",
		});
	});

	it("indexes userId so listing a user's passkeys does not scan", () => {
		expect(indexesOf(passkey)).toEqual([
			{
				columns: ["user_id"],
				name: "passkey_userId_idx",
				unique: false,
				where: null,
			},
		]);
	});

	it("keeps credentialID unique so authentication resolves one account", () => {
		expect(
			getTableConfig(passkey).uniqueConstraints.map((constraint) => ({
				columns: constraint.columns.map((column) => column.name),
				name: constraint.name,
			}))
		).toEqual([
			{ columns: ["credential_id"], name: "passkey_credentialId_unique" },
		]);
	});
});

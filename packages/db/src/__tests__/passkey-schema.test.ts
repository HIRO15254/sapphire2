import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { passkey } from "../schema/passkey";

function foreignKeysOf(table: Parameters<typeof getTableConfig>[0]) {
	return getTableConfig(table).foreignKeys.map((fk) => ({
		onDelete: fk.onDelete,
		columns: fk.reference().columns.map((c) => c.name),
		foreignTable: getTableConfig(fk.reference().foreignTable).name,
		foreignColumns: fk.reference().foreignColumns.map((c) => c.name),
	}));
}

describe("passkey schema (better-auth passkey plugin)", () => {
	const columns = getTableColumns(passkey);

	it("has every field the better-auth passkey plugin reads and writes", () => {
		expect(Object.keys(columns).sort()).toEqual(
			[
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
			].sort()
		);
	});

	it("id is the primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("maps the plugin's camelCase fields onto snake_case columns", () => {
		expect(columns.publicKey.name).toBe("public_key");
		expect(columns.userId.name).toBe("user_id");
		expect(columns.credentialID.name).toBe("credential_id");
		expect(columns.deviceType.name).toBe("device_type");
		expect(columns.backedUp.name).toBe("backed_up");
		expect(columns.createdAt.name).toBe("created_at");
	});

	it("requires the fields the plugin marks required", () => {
		expect(columns.publicKey.notNull).toBe(true);
		expect(columns.userId.notNull).toBe(true);
		expect(columns.credentialID.notNull).toBe(true);
		expect(columns.counter.notNull).toBe(true);
		expect(columns.deviceType.notNull).toBe(true);
		expect(columns.backedUp.notNull).toBe(true);
	});

	it("leaves the fields the plugin marks optional nullable", () => {
		expect(columns.name.notNull).toBe(false);
		expect(columns.transports.notNull).toBe(false);
		expect(columns.aaguid.notNull).toBe(false);
	});

	it("stores counter as an integer and backedUp as a boolean", () => {
		expect(columns.counter.dataType).toBe("number");
		expect(columns.backedUp.dataType).toBe("boolean");
	});

	it("defaults createdAt so inserts without it succeed", () => {
		expect(columns.createdAt.notNull).toBe(true);
		expect(columns.createdAt.hasDefault).toBe(true);
		expect(columns.createdAt.dataType).toBe("date");
	});

	it("cascades passkeys away when the owning user is deleted", () => {
		expect(foreignKeysOf(passkey)).toEqual([
			{
				onDelete: "cascade",
				columns: ["user_id"],
				foreignTable: "user",
				foreignColumns: ["id"],
			},
		]);
	});

	it("indexes userId so listing a user's passkeys does not scan", () => {
		expect(getTableConfig(passkey).indexes.map((i) => i.config.name)).toEqual([
			"passkey_userId_idx",
		]);
	});

	it("keeps credentialID unique so authentication resolves one account", () => {
		const uniqueConstraints = getTableConfig(passkey).uniqueConstraints.map(
			(constraint) => ({
				name: constraint.name,
				columns: constraint.columns.map((c) => c.name),
			})
		);
		expect(uniqueConstraints).toEqual([
			{ name: "passkey_credentialId_unique", columns: ["credential_id"] },
		]);
	});
});

describe("passkey table registration", () => {
	it("is exported from the shared schema barrel under the plugin's model name", async () => {
		const { schema } = await import("../schema");
		expect(schema.passkey).toBe(passkey);
	});

	it("is named `passkey` — the model name better-auth resolves", () => {
		expect(getTableConfig(passkey).name).toBe("passkey");
	});
});

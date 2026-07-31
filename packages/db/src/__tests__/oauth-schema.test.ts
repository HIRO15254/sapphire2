import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import {
	oauthAccessToken,
	oauthApplication,
	oauthConsent,
} from "../schema/oauth";

function foreignKeysOf(table: Parameters<typeof getTableConfig>[0]) {
	return getTableConfig(table).foreignKeys.map((fk) => ({
		onDelete: fk.onDelete,
		columns: fk.reference().columns.map((c) => c.name),
		foreignTable: getTableConfig(fk.reference().foreignTable).name,
		foreignColumns: fk.reference().foreignColumns.map((c) => c.name),
	}));
}

function indexNamesOf(table: Parameters<typeof getTableConfig>[0]) {
	return getTableConfig(table).indexes.map((i) => i.config.name);
}

describe("oauthApplication schema (better-auth mcp plugin)", () => {
	const columns = getTableColumns(oauthApplication);

	it("has every field the better-auth mcp plugin reads and writes", () => {
		expect(Object.keys(columns).sort()).toEqual(
			[
				"clientId",
				"clientSecret",
				"createdAt",
				"disabled",
				"icon",
				"id",
				"metadata",
				"name",
				"redirectUrls",
				"type",
				"updatedAt",
				"userId",
			].sort()
		);
	});

	it("id is the primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("clientId is unique and not null", () => {
		expect(columns.clientId.notNull).toBe(true);
		expect(columns.clientId.isUnique).toBe(true);
	});

	it("name, redirectUrls and type are required", () => {
		expect(columns.name.notNull).toBe(true);
		expect(columns.redirectUrls.notNull).toBe(true);
		expect(columns.type.notNull).toBe(true);
	});

	it("icon, metadata, clientSecret and userId are optional", () => {
		expect(columns.icon.notNull).toBe(false);
		expect(columns.metadata.notNull).toBe(false);
		expect(columns.clientSecret.notNull).toBe(false);
		expect(columns.userId.notNull).toBe(false);
	});

	it("disabled defaults to false", () => {
		expect(columns.disabled.notNull).toBe(true);
		expect(columns.disabled.hasDefault).toBe(true);
		expect(columns.disabled.dataType).toBe("boolean");
	});

	it("userId FK cascades on user deletion", () => {
		expect(foreignKeysOf(oauthApplication)).toContainEqual({
			onDelete: "cascade",
			columns: ["user_id"],
			foreignTable: "user",
			foreignColumns: ["id"],
		});
	});

	it("indexes userId", () => {
		expect(indexNamesOf(oauthApplication)).toContain(
			"oauthApplication_userId_idx"
		);
	});
});

describe("oauthAccessToken schema (better-auth mcp plugin)", () => {
	const columns = getTableColumns(oauthAccessToken);

	it("has every field the better-auth mcp plugin reads and writes", () => {
		expect(Object.keys(columns).sort()).toEqual(
			[
				"accessToken",
				"accessTokenExpiresAt",
				"clientId",
				"createdAt",
				"id",
				"refreshToken",
				"refreshTokenExpiresAt",
				"scopes",
				"updatedAt",
				"userId",
			].sort()
		);
	});

	it("accessToken and refreshToken are unique and required", () => {
		expect(columns.accessToken.notNull).toBe(true);
		expect(columns.accessToken.isUnique).toBe(true);
		expect(columns.refreshToken.notNull).toBe(true);
		expect(columns.refreshToken.isUnique).toBe(true);
	});

	it("expiry timestamps are required date columns", () => {
		expect(columns.accessTokenExpiresAt.notNull).toBe(true);
		expect(columns.accessTokenExpiresAt.dataType).toBe("date");
		expect(columns.refreshTokenExpiresAt.notNull).toBe(true);
		expect(columns.refreshTokenExpiresAt.dataType).toBe("date");
	});

	it("clientId FK targets oauthApplication.clientId (not id) and cascades", () => {
		expect(foreignKeysOf(oauthAccessToken)).toContainEqual({
			onDelete: "cascade",
			columns: ["client_id"],
			foreignTable: "oauth_application",
			foreignColumns: ["client_id"],
		});
	});

	it("userId is optional and its FK cascades on user deletion", () => {
		expect(columns.userId.notNull).toBe(false);
		expect(foreignKeysOf(oauthAccessToken)).toContainEqual({
			onDelete: "cascade",
			columns: ["user_id"],
			foreignTable: "user",
			foreignColumns: ["id"],
		});
	});

	it("indexes clientId and userId", () => {
		const names = indexNamesOf(oauthAccessToken);
		expect(names).toContain("oauthAccessToken_clientId_idx");
		expect(names).toContain("oauthAccessToken_userId_idx");
	});
});

describe("oauthConsent schema (better-auth mcp plugin)", () => {
	const columns = getTableColumns(oauthConsent);

	it("has every field the better-auth mcp plugin reads and writes", () => {
		expect(Object.keys(columns).sort()).toEqual(
			[
				"clientId",
				"consentGiven",
				"createdAt",
				"id",
				"scopes",
				"updatedAt",
				"userId",
			].sort()
		);
	});

	it("clientId and userId are required, consentGiven is a required boolean", () => {
		expect(columns.clientId.notNull).toBe(true);
		expect(columns.userId.notNull).toBe(true);
		expect(columns.consentGiven.notNull).toBe(true);
		expect(columns.consentGiven.dataType).toBe("boolean");
	});

	it("clientId FK targets oauthApplication.clientId and cascades", () => {
		expect(foreignKeysOf(oauthConsent)).toContainEqual({
			onDelete: "cascade",
			columns: ["client_id"],
			foreignTable: "oauth_application",
			foreignColumns: ["client_id"],
		});
	});

	it("userId FK cascades on user deletion", () => {
		expect(foreignKeysOf(oauthConsent)).toContainEqual({
			onDelete: "cascade",
			columns: ["user_id"],
			foreignTable: "user",
			foreignColumns: ["id"],
		});
	});

	it("indexes clientId and userId", () => {
		const names = indexNamesOf(oauthConsent);
		expect(names).toContain("oauthConsent_clientId_idx");
		expect(names).toContain("oauthConsent_userId_idx");
	});
});

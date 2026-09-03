import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import {
	oauthAccessToken,
	oauthApplication,
	oauthConsent,
} from "../schema/oauth";
import { fkByColumn, indexesOf } from "./test-utils";

describe("oauthApplication schema (better-auth mcp plugin)", () => {
	it("has every field the better-auth mcp plugin reads and writes", () => {
		expect(Object.keys(getTableColumns(oauthApplication))).toEqual(
			expect.arrayContaining([
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
			])
		);
	});

	it("keeps clientId unique so a client resolves to one application", () => {
		expect(
			getTableConfig(oauthApplication)
				.columns.filter((column) => column.isUnique)
				.map((column) => column.uniqueName)
		).toEqual(["oauth_application_client_id_unique"]);
	});

	it("userId FK cascades so applications die with their owner", () => {
		expect(fkByColumn(oauthApplication, "user_id")).toEqual({
			columns: ["user_id"],
			foreignColumns: ["id"],
			foreignTable: "user",
			onDelete: "cascade",
		});
	});

	it("indexes userId for listing a user's applications", () => {
		expect(indexesOf(oauthApplication)).toEqual([
			{
				columns: ["user_id"],
				name: "oauthApplication_userId_idx",
				unique: false,
				where: null,
			},
		]);
	});
});

describe("oauthAccessToken schema (better-auth mcp plugin)", () => {
	it("has every field the better-auth mcp plugin reads and writes", () => {
		expect(Object.keys(getTableColumns(oauthAccessToken))).toEqual(
			expect.arrayContaining([
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
			])
		);
	});

	it("keeps accessToken and refreshToken unique so a token resolves to one grant", () => {
		expect(
			getTableConfig(oauthAccessToken)
				.columns.filter((column) => column.isUnique)
				.map((column) => column.uniqueName)
		).toEqual([
			"oauth_access_token_access_token_unique",
			"oauth_access_token_refresh_token_unique",
		]);
	});

	it("clientId FK targets oauth_application.client_id (not id) and cascades", () => {
		expect(fkByColumn(oauthAccessToken, "client_id")).toEqual({
			columns: ["client_id"],
			foreignColumns: ["client_id"],
			foreignTable: "oauth_application",
			onDelete: "cascade",
		});
	});

	it("userId FK cascades so tokens die with their user", () => {
		expect(fkByColumn(oauthAccessToken, "user_id")).toEqual({
			columns: ["user_id"],
			foreignColumns: ["id"],
			foreignTable: "user",
			onDelete: "cascade",
		});
	});

	it("indexes clientId and userId for token lookups", () => {
		expect(indexesOf(oauthAccessToken)).toEqual([
			{
				columns: ["client_id"],
				name: "oauthAccessToken_clientId_idx",
				unique: false,
				where: null,
			},
			{
				columns: ["user_id"],
				name: "oauthAccessToken_userId_idx",
				unique: false,
				where: null,
			},
		]);
	});
});

describe("oauthConsent schema (better-auth mcp plugin)", () => {
	it("has every field the better-auth mcp plugin reads and writes", () => {
		expect(Object.keys(getTableColumns(oauthConsent))).toEqual(
			expect.arrayContaining([
				"clientId",
				"consentGiven",
				"createdAt",
				"id",
				"scopes",
				"updatedAt",
				"userId",
			])
		);
	});

	it("clientId FK targets oauth_application.client_id (not id) and cascades", () => {
		expect(fkByColumn(oauthConsent, "client_id")).toEqual({
			columns: ["client_id"],
			foreignColumns: ["client_id"],
			foreignTable: "oauth_application",
			onDelete: "cascade",
		});
	});

	it("userId FK cascades so consents die with their user", () => {
		expect(fkByColumn(oauthConsent, "user_id")).toEqual({
			columns: ["user_id"],
			foreignColumns: ["id"],
			foreignTable: "user",
			onDelete: "cascade",
		});
	});

	it("indexes clientId and userId for consent lookups", () => {
		expect(indexesOf(oauthConsent)).toEqual([
			{
				columns: ["client_id"],
				name: "oauthConsent_clientId_idx",
				unique: false,
				where: null,
			},
			{
				columns: ["user_id"],
				name: "oauthConsent_userId_idx",
				unique: false,
				where: null,
			},
		]);
	});
});

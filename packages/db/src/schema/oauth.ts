import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

// OIDC provider tables consumed by better-auth's mcp() plugin (OAuth for the
// /mcp endpoint): dynamically registered clients, issued tokens and recorded
// consents. Field set mirrors the plugin's schema definition exactly —
// better-auth reads/writes these through its drizzle adapter.

export const oauthApplication = sqliteTable(
	"oauth_application",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		icon: text("icon"),
		metadata: text("metadata"),
		clientId: text("client_id").notNull().unique(),
		clientSecret: text("client_secret"),
		redirectUrls: text("redirect_urls").notNull(),
		type: text("type").notNull(),
		disabled: integer("disabled", { mode: "boolean" }).default(false).notNull(),
		userId: text("user_id").references(() => user.id, {
			onDelete: "cascade",
		}),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("oauthApplication_userId_idx").on(table.userId)]
);

export const oauthAccessToken = sqliteTable(
	"oauth_access_token",
	{
		id: text("id").primaryKey(),
		accessToken: text("access_token").notNull().unique(),
		refreshToken: text("refresh_token").notNull().unique(),
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp",
		}).notNull(),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", {
			mode: "timestamp",
		}).notNull(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthApplication.clientId, { onDelete: "cascade" }),
		userId: text("user_id").references(() => user.id, {
			onDelete: "cascade",
		}),
		scopes: text("scopes").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("oauthAccessToken_clientId_idx").on(table.clientId),
		index("oauthAccessToken_userId_idx").on(table.userId),
	]
);

export const oauthConsent = sqliteTable(
	"oauth_consent",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthApplication.clientId, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		scopes: text("scopes").notNull(),
		consentGiven: integer("consent_given", { mode: "boolean" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("oauthConsent_clientId_idx").on(table.clientId),
		index("oauthConsent_userId_idx").on(table.userId),
	]
);

export const oauthApplicationRelations = relations(
	oauthApplication,
	({ one, many }) => ({
		user: one(user, {
			fields: [oauthApplication.userId],
			references: [user.id],
		}),
		accessTokens: many(oauthAccessToken),
		consents: many(oauthConsent),
	})
);

export const oauthAccessTokenRelations = relations(
	oauthAccessToken,
	({ one }) => ({
		application: one(oauthApplication, {
			fields: [oauthAccessToken.clientId],
			references: [oauthApplication.clientId],
		}),
		user: one(user, {
			fields: [oauthAccessToken.userId],
			references: [user.id],
		}),
	})
);

export const oauthConsentRelations = relations(oauthConsent, ({ one }) => ({
	application: one(oauthApplication, {
		fields: [oauthConsent.clientId],
		references: [oauthApplication.clientId],
	}),
	user: one(user, {
		fields: [oauthConsent.userId],
		references: [user.id],
	}),
}));

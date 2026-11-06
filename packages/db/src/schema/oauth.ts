import { relations } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { session, user } from "./auth";

export const oauthClient = sqliteTable(
	"oauth_client",
	{
		applicationType: text("application_type"),
		backchannelLogoutSessionRequired: integer(
			"backchannel_logout_session_required",
			{ mode: "boolean" }
		),
		backchannelLogoutUri: text("backchannel_logout_uri"),
		clientCredentialsScopes: text("client_credentials_scopes", {
			mode: "json",
		}).default([]),
		clientDiscoveryId: text("client_discovery_id"),
		clientId: text("client_id").notNull().unique(),
		clientSecret: text("client_secret"),
		contacts: text("contacts", { mode: "json" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }),
		disabled: integer("disabled", { mode: "boolean" }).default(false),
		dpopBoundAccessTokens: integer("dpop_bound_access_tokens", {
			mode: "boolean",
		}).default(false),
		enableEndSession: integer("enable_end_session", { mode: "boolean" }),
		grantTypes: text("grant_types", { mode: "json" }),
		icon: text("icon"),
		id: text("id").primaryKey(),
		jwks: text("jwks"),
		jwksUri: text("jwks_uri"),
		metadata: text("metadata", { mode: "json" }),
		name: text("name"),
		policy: text("policy"),
		postLogoutRedirectUris: text("post_logout_redirect_uris", { mode: "json" }),
		redirectUris: text("redirect_uris", { mode: "json" }).notNull(),
		referenceId: text("reference_id"),
		requirePKCE: integer("require_pkce", { mode: "boolean" }),
		responseTypes: text("response_types", { mode: "json" }),
		scopes: text("scopes", { mode: "json" }),
		skipConsent: integer("skip_consent", { mode: "boolean" }),
		softwareId: text("software_id"),
		softwareStatement: text("software_statement"),
		softwareVersion: text("software_version"),
		subjectType: text("subject_type"),
		tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
		tos: text("tos"),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
		uri: text("uri"),
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("oauthClient_userId_idx").on(table.userId)]
);

export const oauthResource = sqliteTable("oauth_resource", {
	accessTokenTtl: integer("access_token_ttl"),
	allowedScopes: text("allowed_scopes", { mode: "json" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" }),
	customClaims: text("custom_claims", { mode: "json" }),
	disabled: integer("disabled", { mode: "boolean" }).default(false),
	dpopBoundAccessTokensRequired: integer("dpop_bound_access_tokens_required", {
		mode: "boolean",
	}).default(false),
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull().unique(),
	metadata: text("metadata", { mode: "json" }),
	name: text("name").notNull(),
	policyVersion: integer("policy_version").default(1),
	refreshTokenTtl: integer("refresh_token_ttl"),
	signingAlgorithm: text("signing_algorithm"),
	signingKeyId: text("signing_key_id"),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export const oauthClientResource = sqliteTable(
	"oauth_client_resource",
	{
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }),
		id: text("id").primaryKey(),
		metadata: text("metadata", { mode: "json" }),
		resourceId: text("resource_id")
			.notNull()
			.references(() => oauthResource.identifier, { onDelete: "cascade" }),
	},
	(table) => [
		uniqueIndex("oauthClientResource_clientId_resourceId_uidx").on(
			table.clientId,
			table.resourceId
		),
		index("oauthClientResource_clientId_idx").on(table.clientId),
		index("oauthClientResource_resourceId_idx").on(table.resourceId),
	]
);

export const oauthRefreshToken = sqliteTable(
	"oauth_refresh_token",
	{
		authorizationCodeId: text("authorization_code_id"),
		authTime: integer("auth_time", { mode: "timestamp_ms" }),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		confirmation: text("confirmation", { mode: "json" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
		id: text("id").primaryKey(),
		referenceId: text("reference_id"),
		requestedUserInfoClaims: text("requested_user_info_claims", {
			mode: "json",
		}),
		resources: text("resources", { mode: "json" }),
		revoked: integer("revoked", { mode: "timestamp_ms" }),
		rotatedAt: integer("rotated_at", { mode: "timestamp_ms" }),
		rotationReplayExpiresAt: integer("rotation_replay_expires_at", {
			mode: "timestamp_ms",
		}),
		rotationReplayResponse: text("rotation_replay_response"),
		scopes: text("scopes", { mode: "json" }).notNull(),
		sessionId: text("session_id").references(() => session.id, {
			onDelete: "set null",
		}),
		token: text("token").notNull().unique(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("oauthRefreshToken_clientId_idx").on(table.clientId),
		index("oauthRefreshToken_sessionId_idx").on(table.sessionId),
		index("oauthRefreshToken_userId_idx").on(table.userId),
		index("oauthRefreshToken_authorizationCodeId_idx").on(
			table.authorizationCodeId
		),
	]
);

export const oauthAccessToken = sqliteTable(
	"oauth_access_token",
	{
		authorizationCodeId: text("authorization_code_id"),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		confirmation: text("confirmation", { mode: "json" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
		id: text("id").primaryKey(),
		referenceId: text("reference_id"),
		refreshId: text("refresh_id").references(() => oauthRefreshToken.id, {
			onDelete: "cascade",
		}),
		requestedUserInfoClaims: text("requested_user_info_claims", {
			mode: "json",
		}),
		resources: text("resources", { mode: "json" }),
		revoked: integer("revoked", { mode: "timestamp_ms" }),
		scopes: text("scopes", { mode: "json" }).notNull(),
		sessionId: text("session_id").references(() => session.id, {
			onDelete: "set null",
		}),
		token: text("token").unique(),
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("oauthAccessToken_clientId_idx").on(table.clientId),
		index("oauthAccessToken_sessionId_idx").on(table.sessionId),
		index("oauthAccessToken_userId_idx").on(table.userId),
		index("oauthAccessToken_authorizationCodeId_idx").on(
			table.authorizationCodeId
		),
		index("oauthAccessToken_refreshId_idx").on(table.refreshId),
	]
);

export const oauthConsent = sqliteTable(
	"oauth_consent",
	{
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }),
		id: text("id").primaryKey(),
		referenceId: text("reference_id"),
		requestedUserInfoClaims: text("requested_user_info_claims", {
			mode: "json",
		}),
		resources: text("resources", { mode: "json" }),
		scopes: text("scopes", { mode: "json" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("oauthConsent_clientId_idx").on(table.clientId),
		index("oauthConsent_userId_idx").on(table.userId),
	]
);

export const oauthClientAssertion = sqliteTable("oauth_client_assertion", {
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	id: text("id").primaryKey(),
});

export const oauthClientRelations = relations(oauthClient, ({ one, many }) => ({
	oauthAccessTokens: many(oauthAccessToken),
	oauthClientResources: many(oauthClientResource),
	oauthConsents: many(oauthConsent),
	oauthRefreshTokens: many(oauthRefreshToken),
	user: one(user, {
		fields: [oauthClient.userId],
		references: [user.id],
	}),
}));

export const oauthResourceRelations = relations(oauthResource, ({ many }) => ({
	oauthClientResources: many(oauthClientResource),
}));

export const oauthClientResourceRelations = relations(
	oauthClientResource,
	({ one }) => ({
		oauthClient: one(oauthClient, {
			fields: [oauthClientResource.clientId],
			references: [oauthClient.clientId],
		}),
		oauthResource: one(oauthResource, {
			fields: [oauthClientResource.resourceId],
			references: [oauthResource.identifier],
		}),
	})
);

export const oauthRefreshTokenRelations = relations(
	oauthRefreshToken,
	({ one, many }) => ({
		oauthAccessTokens: many(oauthAccessToken),
		oauthClient: one(oauthClient, {
			fields: [oauthRefreshToken.clientId],
			references: [oauthClient.clientId],
		}),
		session: one(session, {
			fields: [oauthRefreshToken.sessionId],
			references: [session.id],
		}),
		user: one(user, {
			fields: [oauthRefreshToken.userId],
			references: [user.id],
		}),
	})
);

export const oauthAccessTokenRelations = relations(
	oauthAccessToken,
	({ one }) => ({
		oauthClient: one(oauthClient, {
			fields: [oauthAccessToken.clientId],
			references: [oauthClient.clientId],
		}),
		oauthRefreshToken: one(oauthRefreshToken, {
			fields: [oauthAccessToken.refreshId],
			references: [oauthRefreshToken.id],
		}),
		session: one(session, {
			fields: [oauthAccessToken.sessionId],
			references: [session.id],
		}),
		user: one(user, {
			fields: [oauthAccessToken.userId],
			references: [user.id],
		}),
	})
);

export const oauthConsentRelations = relations(oauthConsent, ({ one }) => ({
	oauthClient: one(oauthClient, {
		fields: [oauthConsent.clientId],
		references: [oauthClient.clientId],
	}),
	user: one(user, {
		fields: [oauthConsent.userId],
		references: [user.id],
	}),
}));

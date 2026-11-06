import {
	oauthAccessToken,
	oauthClient,
	oauthConsent,
	oauthRefreshToken,
} from "@sapphire2/db/schema/oauth";
import { TRPCError } from "@trpc/server";
import { and, eq, gt, inArray, isNull, max, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { selectInChunks } from "../lib/batch";

export const mcpConnectionRevokeInputSchema = z.object({
	clientId: z.string().min(1).max(255),
});

export interface McpConnection {
	approvedAt: Date | null;
	clientId: string;
	lastActiveAt: Date | null;
	name: string | null;
}

function latestFirst(left: McpConnection, right: McpConnection): number {
	const leftTime = (left.lastActiveAt ?? left.approvedAt)?.getTime() ?? 0;
	const rightTime = (right.lastActiveAt ?? right.approvedAt)?.getTime() ?? 0;
	return rightTime - leftTime;
}

export const mcpConnectionRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const now = new Date();
		const [consents, accessTokens, refreshTokens] = await ctx.db.batch([
			ctx.db
				.select({
					clientId: oauthConsent.clientId,
					approvedAt:
						sql<Date | null>`max(coalesce(${oauthConsent.updatedAt}, ${oauthConsent.createdAt}))`.mapWith(
							oauthConsent.createdAt
						),
				})
				.from(oauthConsent)
				.where(eq(oauthConsent.userId, userId))
				.groupBy(oauthConsent.clientId),
			ctx.db
				.select({
					clientId: oauthAccessToken.clientId,
					lastActiveAt: max(oauthAccessToken.createdAt),
					hasLiveToken:
						sql<number>`max(${oauthAccessToken.revoked} is null and ${oauthAccessToken.expiresAt} > ${now.getTime()})`.mapWith(
							Number
						),
				})
				.from(oauthAccessToken)
				.where(eq(oauthAccessToken.userId, userId))
				.groupBy(oauthAccessToken.clientId),
			ctx.db
				.selectDistinct({ clientId: oauthRefreshToken.clientId })
				.from(oauthRefreshToken)
				.where(
					and(
						eq(oauthRefreshToken.userId, userId),
						isNull(oauthRefreshToken.revoked),
						gt(oauthRefreshToken.expiresAt, now)
					)
				),
		]);

		const approvedAt = new Map(
			consents.map((row) => [row.clientId, row.approvedAt])
		);
		const lastActiveAt = new Map(
			accessTokens.map((row) => [row.clientId, row.lastActiveAt])
		);
		const clientIds = [
			...new Set([
				...consents.map((row) => row.clientId),
				...accessTokens
					.filter((row) => row.hasLiveToken === 1)
					.map((row) => row.clientId),
				...refreshTokens.map((row) => row.clientId),
			]),
		];
		if (clientIds.length === 0) {
			return [];
		}

		const clients = await selectInChunks(clientIds, (chunk) =>
			ctx.db
				.select({ clientId: oauthClient.clientId, name: oauthClient.name })
				.from(oauthClient)
				.where(inArray(oauthClient.clientId, chunk))
		);
		const names = new Map(clients.map((row) => [row.clientId, row.name]));
		return clientIds
			.map(
				(clientId): McpConnection => ({
					clientId,
					name: names.get(clientId) ?? null,
					approvedAt: approvedAt.get(clientId) ?? null,
					lastActiveAt: lastActiveAt.get(clientId) ?? null,
				})
			)
			.sort(latestFirst);
	}),

	revoke: protectedProcedure
		.input(mcpConnectionRevokeInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [accessTokens, refreshTokens, consents] = await ctx.db.batch([
				ctx.db
					.delete(oauthAccessToken)
					.where(
						and(
							eq(oauthAccessToken.userId, userId),
							eq(oauthAccessToken.clientId, input.clientId)
						)
					)
					.returning({ id: oauthAccessToken.id }),
				ctx.db
					.delete(oauthRefreshToken)
					.where(
						and(
							eq(oauthRefreshToken.userId, userId),
							eq(oauthRefreshToken.clientId, input.clientId)
						)
					)
					.returning({ id: oauthRefreshToken.id }),
				ctx.db
					.delete(oauthConsent)
					.where(
						and(
							eq(oauthConsent.userId, userId),
							eq(oauthConsent.clientId, input.clientId)
						)
					)
					.returning({ id: oauthConsent.id }),
			]);
			if (
				accessTokens.length === 0 &&
				refreshTokens.length === 0 &&
				consents.length === 0
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have this connection",
				});
			}
			return { clientId: input.clientId };
		}),
});

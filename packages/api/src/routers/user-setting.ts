import { asset } from "@sapphire2/db/schema/asset";
import { userSetting } from "@sapphire2/db/schema/ledger";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { activeReferenceGuard } from "../lib/active-reference-guard";
import { validateEntityOwnership } from "../lib/ownership";
import { runGuardedBatch } from "../lib/write-guard";

type Db = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

const IANA_ZONE_NAME = /^[A-Za-z][A-Za-z0-9_+\-/]*$/;

function isIanaTimeZone(value: string): boolean {
	if (!IANA_ZONE_NAME.test(value)) {
		return false;
	}
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
		return true;
	} catch {
		return false;
	}
}

async function selectSetting(db: Db, userId: string) {
	const [found] = await db
		.select({
			baseAssetId: userSetting.baseAssetId,
			timeZone: userSetting.timeZone,
		})
		.from(userSetting)
		.where(eq(userSetting.userId, userId));
	return found ?? { baseAssetId: null, timeZone: null };
}

export const userSettingUpdateInputSchema = z.object({
	baseAssetId: z.string().min(1).nullable().optional(),
	timeZone: z
		.string()
		.refine(isIanaTimeZone, "timeZone must be an IANA time zone name")
		.nullable()
		.optional(),
});

export const userSettingRouter = router({
	get: protectedProcedure.query(({ ctx }) =>
		selectSetting(ctx.db, ctx.session.user.id)
	),

	update: protectedProcedure
		.input(userSettingUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			let newBaseId: string | undefined;
			if (typeof input.baseAssetId === "string") {
				const base = await validateEntityOwnership(
					ctx.db,
					"asset",
					input.baseAssetId,
					userId
				);
				if (base.kind !== "currency") {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "The base asset must be a currency",
					});
				}
				const current = await selectSetting(ctx.db, userId);
				if (base.archivedAt !== null && current.baseAssetId !== base.id) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "An archived asset cannot be newly selected as the base",
					});
				}
				if (current.baseAssetId !== base.id) {
					newBaseId = base.id;
				}
			}
			const changes = {
				...(input.baseAssetId === undefined
					? {}
					: { baseAssetId: input.baseAssetId }),
				...(input.timeZone === undefined ? {} : { timeZone: input.timeZone }),
				updatedAt: new Date(),
			};
			await runGuardedBatch(ctx.db, [
				...(newBaseId
					? [activeReferenceGuard(ctx.db, asset, newBaseId, userId)]
					: []),
				ctx.db
					.insert(userSetting)
					.values({ userId, ...changes })
					.onConflictDoUpdate({ target: userSetting.userId, set: changes }),
			]);
			return await selectSetting(ctx.db, userId);
		}),
});

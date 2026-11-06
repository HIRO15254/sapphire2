import type { Database } from "@sapphire2/db";
import { player } from "@sapphire2/db/schema/player";
import { and, eq, sql } from "drizzle-orm";

export function selfPlayerInsert(db: Database, userId: string) {
	return db
		.insert(player)
		.values({
			id: crypto.randomUUID(),
			userId,
			name: "Hero",
			isSelf: true,
			isTemporary: false,
			updatedAt: new Date(),
		})
		.onConflictDoNothing();
}

export async function ensureSelfPlayer(db: Database, userId: string) {
	await selfPlayerInsert(db, userId);
	const [self] = await db
		.select()
		.from(player)
		.where(and(eq(player.userId, userId), sql`${player.isSelf} = 1`));
	if (!self) {
		throw new Error("Failed to ensure self player");
	}
	return self;
}

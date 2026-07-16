import type { Database } from "@sapphire2/db";
import { transactionType } from "@sapphire2/db/schema/currency";
import { and, eq } from "drizzle-orm";

export const SESSION_RESULT_TYPE_NAME = "Session Result";

export function isSessionResultTypeName(name: string): boolean {
	return name.trim().toLowerCase() === SESSION_RESULT_TYPE_NAME.toLowerCase();
}

async function findSessionResultTypeId(
	db: Database,
	userId: string
): Promise<string | undefined> {
	const [found] = await db
		.select({ id: transactionType.id })
		.from(transactionType)
		.where(
			and(
				eq(transactionType.userId, userId),
				eq(transactionType.name, SESSION_RESULT_TYPE_NAME)
			)
		);
	return found?.id;
}

export async function ensureSessionResultTypeId(
	db: Database,
	userId: string
): Promise<string> {
	const existingId = await findSessionResultTypeId(db, userId);
	if (existingId) {
		return existingId;
	}

	await db
		.insert(transactionType)
		.values({
			id: crypto.randomUUID(),
			userId,
			name: SESSION_RESULT_TYPE_NAME,
			updatedAt: new Date(),
		})
		.onConflictDoNothing();

	const ensuredId = await findSessionResultTypeId(db, userId);
	if (!ensuredId) {
		throw new Error("Failed to ensure Session Result transaction type");
	}
	return ensuredId;
}

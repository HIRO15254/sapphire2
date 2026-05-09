import { gameSession } from "@sapphire2/db/schema/session";
import { eq } from "drizzle-orm";
import { cashProjection } from "./cash";
import { chipPurchaseProjection } from "./chip-purchase";
import { currencyTransactionProjection } from "./currency-transaction";
import { lifecycleProjection } from "./lifecycle";
import { tournamentProjection } from "./tournament";
import type { DbInstance } from "./types";

export type { CurrentPlayer } from "./current-players";
export { computeCurrentPlayers } from "./current-players";

export async function recalculate(
	db: DbInstance,
	sessionId: string
): Promise<void> {
	const [session] = await db
		.select({ source: gameSession.source, kind: gameSession.kind })
		.from(gameSession)
		.where(eq(gameSession.id, sessionId));

	if (!session || session.source === "manual") {
		return;
	}

	await chipPurchaseProjection(db, sessionId);
	await lifecycleProjection(db, sessionId);

	if (session.kind === "cash_game") {
		await cashProjection(db, sessionId);
	} else if (session.kind === "tournament") {
		await tournamentProjection(db, sessionId);
	}

	await currencyTransactionProjection(db, sessionId);
}

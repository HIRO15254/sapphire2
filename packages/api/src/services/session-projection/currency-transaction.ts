import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import {
	currencyTransaction,
	transactionType,
} from "@sapphire2/db/schema/store";
import { and, eq } from "drizzle-orm";
import type { DbInstance } from "./types";

export async function getOrCreateSessionResultTypeId(
	db: DbInstance,
	userId: string
): Promise<string> {
	const [found] = await db
		.select()
		.from(transactionType)
		.where(
			and(
				eq(transactionType.userId, userId),
				eq(transactionType.name, "Session Result")
			)
		);
	if (found) {
		return found.id;
	}

	const id = crypto.randomUUID();
	await db.insert(transactionType).values({
		id,
		userId,
		name: "Session Result",
		updatedAt: new Date(),
	});
	return id;
}

async function resolveProfitLoss(
	db: DbInstance,
	sessionId: string,
	kind: string
): Promise<number | null> {
	if (kind === "cash_game") {
		const [detail] = await db
			.select({
				buyIn: sessionCashDetail.buyIn,
				cashOut: sessionCashDetail.cashOut,
			})
			.from(sessionCashDetail)
			.where(eq(sessionCashDetail.sessionId, sessionId));

		if (!detail || detail.cashOut === null || detail.buyIn === null) {
			return null;
		}
		return detail.cashOut - detail.buyIn;
	}

	if (kind === "tournament") {
		const [detail] = await db
			.select({
				buyIn: sessionTournamentDetail.buyIn,
				entryFee: sessionTournamentDetail.entryFee,
				prizeMoney: sessionTournamentDetail.prizeMoney,
				bountyPrizes: sessionTournamentDetail.bountyPrizes,
			})
			.from(sessionTournamentDetail)
			.where(eq(sessionTournamentDetail.sessionId, sessionId));

		if (!detail || detail.prizeMoney === null) {
			return null;
		}

		const income = (detail.prizeMoney ?? 0) + (detail.bountyPrizes ?? 0);
		const cost = (detail.buyIn ?? 0) + (detail.entryFee ?? 0);
		return income - cost;
	}

	return null;
}

export async function currencyTransactionProjection(
	db: DbInstance,
	sessionId: string
): Promise<void> {
	const [session] = await db
		.select()
		.from(gameSession)
		.where(eq(gameSession.id, sessionId));

	if (!session) {
		return;
	}

	const { currencyId, userId, kind, status } = session;

	if (!currencyId || status !== "completed") {
		await db
			.delete(currencyTransaction)
			.where(eq(currencyTransaction.sessionId, sessionId));
		return;
	}

	const profitLoss = await resolveProfitLoss(db, sessionId, kind);

	if (profitLoss === null) {
		await db
			.delete(currencyTransaction)
			.where(eq(currencyTransaction.sessionId, sessionId));
		return;
	}

	const effectiveDate = session.startedAt ?? session.sessionDate;

	const [existingTx] = await db
		.select()
		.from(currencyTransaction)
		.where(eq(currencyTransaction.sessionId, sessionId));

	if (existingTx) {
		await db
			.update(currencyTransaction)
			.set({ amount: profitLoss })
			.where(eq(currencyTransaction.id, existingTx.id));
	} else {
		const typeId = await getOrCreateSessionResultTypeId(db, userId);
		await db.insert(currencyTransaction).values({
			id: crypto.randomUUID(),
			currencyId,
			transactionTypeId: typeId,
			sessionId,
			amount: profitLoss,
			transactedAt: effectiveDate,
		});
	}
}

import { expect, test } from "vitest";
import type { EntryLine } from "../services/entry-reads";
import { initialPaymentLines } from "../services/stats";

test("does not pair a re-entry event's fee with the initial buy-in", () => {
	const line = (values: Partial<EntryLine>): EntryLine => ({
		assetId: "currency",
		effect: "real",
		entryId: "entry",
		eventId: null,
		id: "line",
		occurredAt: new Date(0),
		playSessionId: "day",
		priceId: "price",
		quantity: -100,
		role: "fee",
		...values,
	});
	const buyIn = line({ id: "a", role: "buy_in", eventId: "initial" });
	const reentryFee = line({ id: "b", eventId: "reentry" });
	const initialFee = line({ id: "c", priceId: null, eventId: null });
	expect(initialPaymentLines([buyIn, reentryFee, initialFee])).toEqual([
		buyIn,
		initialFee,
	]);
});

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
	const buyIn = line({ eventId: "initial", id: "a", role: "buy_in" });
	const reentryFee = line({ eventId: "reentry", id: "b" });
	const initialFee = line({ eventId: null, id: "c", priceId: null });
	expect(initialPaymentLines([buyIn, reentryFee, initialFee])).toEqual([
		buyIn,
		initialFee,
	]);
});

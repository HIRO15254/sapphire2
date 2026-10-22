import { updateNoteView } from "@sapphire2/db/schema/update-note-view";
import { expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

test("concurrent marks converge on one persisted row without sharing viewed history between users", async ({
	api,
}) => {
	const [first, second] = await Promise.all([
		api.alice.updateNoteView.markViewed({ version: "1.2.3" }),
		api.alice.updateNoteView.markViewed({ version: "1.2.3" }),
	]);
	const alice = requireCreatedRow(first);
	expect(second).toEqual(alice);
	expect(await api.db.select().from(updateNoteView)).toEqual([alice]);
	const bob = requireCreatedRow(
		await api.bob.updateNoteView.markViewed({ version: "1.2.3" })
	);
	expect(bob).toMatchObject({ userId: "bob", version: "1.2.3" });
	expect(bob.id).not.toBe(alice.id);
	expect(alice).toMatchObject({ userId: "alice", version: "1.2.3" });
	expect(await api.db.select().from(updateNoteView)).toEqual(
		expect.arrayContaining([alice, bob])
	);
	expect(await api.db.select().from(updateNoteView)).toHaveLength(2);
	expect(await api.alice.updateNoteView.list()).toEqual([alice]);
	expect(await api.bob.updateNoteView.list()).toEqual([bob]);
});

import { expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

test("normalized names conflict within an owner", async ({ api }) => {
	await api.alice.entryTag.create({ name: " Foo " });
	await expect(
		api.alice.entryTag.create({ name: "foo" })
	).rejects.toMatchObject({ code: "CONFLICT" });
});

test("foreign users cannot change or delete a tag", async ({ api }) => {
	const tag = requireCreatedRow(
		await api.alice.entryTag.create({ name: "Alice" })
	);
	await expect(
		api.bob.entryTag.update({ id: tag.id, name: "Changed" })
	).rejects.toMatchObject({ code: "FORBIDDEN" });
	await expect(api.bob.entryTag.delete({ id: tag.id })).rejects.toMatchObject({
		code: "FORBIDDEN",
	});
	expect(await api.alice.entryTag.list()).toEqual([tag]);
});

test("deleting a tag removes links without deleting entries", async ({
	api,
}) => {
	const tag = requireCreatedRow(
		await api.alice.entryTag.create({ name: "Tag" })
	);
	await api.d1
		.prepare(
			"INSERT INTO entry (id, user_id, kind, source, status, played_on, updated_at) VALUES (?, ?, 'cash', 'manual', 'settled', '2026-09-05', 0)"
		)
		.bind("entry-1", "alice")
		.run();
	await api.d1
		.prepare(
			"INSERT INTO entry_tag_link (user_id, entry_id, tag_id) VALUES (?, ?, ?)"
		)
		.bind("alice", "entry-1", tag.id)
		.run();
	await expect(api.alice.entryTag.delete({ id: tag.id })).resolves.toEqual({
		success: true,
	});
	expect(
		(await api.d1.prepare("SELECT entry_id FROM entry_tag_link").all()).results
	).toEqual([]);
	expect(
		(
			await api.d1
				.prepare("SELECT id FROM entry WHERE id = ?")
				.bind("entry-1")
				.all()
		).results
	).toEqual([{ id: "entry-1" }]);
});

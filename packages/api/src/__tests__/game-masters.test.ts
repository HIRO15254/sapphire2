import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import {
	assertLabelNamespaceAvailable,
	compareBuiltinFirst,
	RESERVED_LABELS,
} from "../routers/_game-masters";

type Rows = Record<string, unknown>[];

/** Minimal table-keyed `select({...}).from(table).where(...)` stub. */
function makeDb(rowsByTable: Map<unknown, Rows>) {
	return {
		select: () => ({
			from: (table: unknown) => ({
				where: () => Promise.resolve(rowsByTable.get(table) ?? []),
			}),
		}),
	} as never;
}

async function expectTrpcConflict(
	promise: Promise<unknown>,
	message: string
): Promise<void> {
	try {
		await promise;
	} catch (error) {
		expect(error).toBeInstanceOf(TRPCError);
		expect((error as TRPCError).code).toBe("CONFLICT");
		expect((error as TRPCError).message).toBe(message);
		return;
	}
	throw new Error("expected the call to throw CONFLICT but it resolved");
}

describe("RESERVED_LABELS", () => {
	it("contains the lowercased mix-mode key and display label", () => {
		expect(RESERVED_LABELS.has("mix")).toBe(true);
		expect(RESERVED_LABELS.has("mixed game")).toBe(true);
	});

	it("does not contain an arbitrary label", () => {
		expect(RESERVED_LABELS.has("nl hold'em")).toBe(false);
	});
});

describe("compareBuiltinFirst", () => {
	const order = new Map([
		["a", 0],
		["b", 1],
	]);
	const compare = compareBuiltinFirst(order);

	it("sorts builtin rows by the order map, ahead of custom rows", () => {
		const rows = [
			{ builtinKey: null, label: "Zeta Custom" },
			{ builtinKey: "b", label: "B" },
			{ builtinKey: "a", label: "A" },
		];
		expect([...rows].sort(compare).map((r) => r.label)).toEqual([
			"A",
			"B",
			"Zeta Custom",
		]);
	});

	it("sorts custom rows alphabetically by label", () => {
		const rows = [
			{ builtinKey: null, label: "Zeta" },
			{ builtinKey: null, label: "Alpha" },
		];
		expect([...rows].sort(compare).map((r) => r.label)).toEqual([
			"Alpha",
			"Zeta",
		]);
	});

	it("treats a builtinKey absent from the order map as a custom row", () => {
		const rows = [
			{ builtinKey: "unknown-key", label: "Unknown" },
			{ builtinKey: "a", label: "A" },
		];
		expect([...rows].sort(compare).map((r) => r.label)).toEqual([
			"A",
			"Unknown",
		]);
	});
});

describe("assertLabelNamespaceAvailable", () => {
	it("rejects the reserved key 'mix' (case-insensitive) for self='variant'", async () => {
		const db = makeDb(new Map());
		await expectTrpcConflict(
			assertLabelNamespaceAvailable(db, "u1", "MIX", { self: "variant" }),
			"This label is reserved for the mix mode"
		);
	});

	it("rejects the reserved label 'Mixed Game' (case-insensitive) for self='mix'", async () => {
		const db = makeDb(new Map());
		await expectTrpcConflict(
			assertLabelNamespaceAvailable(db, "u1", "mixed game", { self: "mix" }),
			"This label is reserved for the mix mode"
		);
	});

	it("self='variant': rejects a collision with the caller's own variant label, excluding excludeId", async () => {
		const db = makeDb(
			new Map<unknown, Rows>([
				[gameVariant, [{ id: "gv-1", label: "My Mix" }]],
				[gameMix, []],
			])
		);
		await expectTrpcConflict(
			assertLabelNamespaceAvailable(db, "u1", "my mix", { self: "variant" }),
			"You already have a game variant with this label"
		);
		// Excluding the row's own id lets an unchanged-label update through.
		await expect(
			assertLabelNamespaceAvailable(db, "u1", "my mix", {
				self: "variant",
				excludeId: "gv-1",
			})
		).resolves.toBeUndefined();
	});

	it("self='variant': rejects a cross-namespace collision with the caller's mix label", async () => {
		const db = makeDb(
			new Map<unknown, Rows>([
				[gameVariant, []],
				[gameMix, [{ id: "mix-1", label: "HORSE" }]],
			])
		);
		await expectTrpcConflict(
			assertLabelNamespaceAvailable(db, "u1", "horse", { self: "variant" }),
			"You already have a mix with this label"
		);
	});

	it("self='variant': the own-table collision message wins when both tables would collide", async () => {
		const db = makeDb(
			new Map<unknown, Rows>([
				[gameVariant, [{ id: "gv-1", label: "Dup" }]],
				[gameMix, [{ id: "mix-1", label: "Dup" }]],
			])
		);
		await expectTrpcConflict(
			assertLabelNamespaceAvailable(db, "u1", "dup", { self: "variant" }),
			"You already have a game variant with this label"
		);
	});

	it("self='mix': rejects a collision with the caller's own mix label, excluding excludeId", async () => {
		const db = makeDb(
			new Map<unknown, Rows>([
				[gameMix, [{ id: "mix-1", label: "My Mix" }]],
				[gameVariant, []],
			])
		);
		await expectTrpcConflict(
			assertLabelNamespaceAvailable(db, "u1", "my mix", { self: "mix" }),
			"You already have a mix with this label"
		);
		await expect(
			assertLabelNamespaceAvailable(db, "u1", "my mix", {
				self: "mix",
				excludeId: "mix-1",
			})
		).resolves.toBeUndefined();
	});

	it("self='mix': rejects a cross-namespace collision with the caller's variant label", async () => {
		const db = makeDb(
			new Map<unknown, Rows>([
				[gameMix, []],
				[gameVariant, [{ id: "gv-1", label: "NL Hold'em" }]],
			])
		);
		await expectTrpcConflict(
			assertLabelNamespaceAvailable(db, "u1", "nl hold'em", { self: "mix" }),
			"You already have a game variant with this label"
		);
	});

	it("self='mix': the own-table collision message wins when both tables would collide", async () => {
		const db = makeDb(
			new Map<unknown, Rows>([
				[gameMix, [{ id: "mix-1", label: "Dup" }]],
				[gameVariant, [{ id: "gv-1", label: "Dup" }]],
			])
		);
		await expectTrpcConflict(
			assertLabelNamespaceAvailable(db, "u1", "dup", { self: "mix" }),
			"You already have a mix with this label"
		);
	});

	it("resolves when no reserved word or collision applies", async () => {
		const db = makeDb(
			new Map<unknown, Rows>([
				[gameVariant, [{ id: "gv-1", label: "Other" }]],
				[gameMix, [{ id: "mix-1", label: "Another" }]],
			])
		);
		await expect(
			assertLabelNamespaceAvailable(db, "u1", "Brand New", { self: "variant" })
		).resolves.toBeUndefined();
	});
});

import {
	MIX_VARIANT,
	MIX_VARIANT_LABEL,
} from "@sapphire2/db/constants/game-variants";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { protectedProcedure } from "../index";

export type Db = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

// The mix pseudo-variant is a MODE, not a per-user row — its key and display
// label are reserved so a real game-variant/game-mix row can never collide
// with it. Single copy shared by the game-group/game-variant/game-mix
// routers (previously duplicated verbatim in each, c42).
export const RESERVED_LABELS = new Set(
	[MIX_VARIANT, MIX_VARIANT_LABEL].map((s) => s.toLowerCase())
);

/**
 * Builtin-first comparator factory: rows whose `builtinKey` is in
 * `builtinOrder` sort ahead of any user-created row (by that order), and
 * user-created rows then sort alphabetically by label. Shared by
 * game-group.ts's `compareGroups` and game-mix.ts's `compareMixes`, which
 * were byte-identical aside from the captured order map (c42).
 */
export function compareBuiltinFirst(
	builtinOrder: Map<string, number>
): (
	a: { builtinKey: string | null; label: string },
	b: { builtinKey: string | null; label: string }
) => number {
	return (a, b) => {
		const aOrder = a.builtinKey ? builtinOrder.get(a.builtinKey) : undefined;
		const bOrder = b.builtinKey ? builtinOrder.get(b.builtinKey) : undefined;
		if (aOrder !== undefined && bOrder !== undefined) {
			return aOrder - bOrder;
		}
		if (aOrder !== undefined) {
			return -1;
		}
		if (bOrder !== undefined) {
			return 1;
		}
		return a.label.localeCompare(b.label);
	};
}

/**
 * A mix's label is chosen from the same client-side select as a plain game
 * variant (both freeze into the same `variant` string once picked), so its
 * namespace spans BOTH the caller's game variants and the caller's mixes,
 * plus the reserved mix-mode strings. Shared by game-variant.ts (`self:
 * "variant"`) and game-mix.ts (`self: "mix"`), which previously duplicated
 * this check as `assertLabelAvailable` / `assertMixLabelAvailable` — mirror
 * images of each other differing only in which table is "self" (excludes the
 * row being updated) vs "other" (c42). Error messages/order are byte-
 * identical to the originals.
 */
export async function assertLabelNamespaceAvailable(
	db: Db,
	userId: string,
	label: string,
	options: { self: "variant" | "mix"; excludeId?: string }
): Promise<void> {
	const normalized = label.trim().toLowerCase();
	if (RESERVED_LABELS.has(normalized)) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "This label is reserved for the mix mode",
		});
	}

	if (options.self === "variant") {
		const existingVariants = await db
			.select({ id: gameVariant.id, label: gameVariant.label })
			.from(gameVariant)
			.where(eq(gameVariant.userId, userId));
		const collidesVariant = existingVariants.some(
			(row) =>
				row.id !== options.excludeId &&
				row.label.trim().toLowerCase() === normalized
		);
		if (collidesVariant) {
			throw new TRPCError({
				code: "CONFLICT",
				message: "You already have a game variant with this label",
			});
		}

		const existingMixes = await db
			.select({ id: gameMix.id, label: gameMix.label })
			.from(gameMix)
			.where(eq(gameMix.userId, userId));
		const collidesMix = existingMixes.some(
			(row) => row.label.trim().toLowerCase() === normalized
		);
		if (collidesMix) {
			throw new TRPCError({
				code: "CONFLICT",
				message: "You already have a mix with this label",
			});
		}
		return;
	}

	const existingMixes = await db
		.select({ id: gameMix.id, label: gameMix.label })
		.from(gameMix)
		.where(eq(gameMix.userId, userId));
	const collidesMix = existingMixes.some(
		(row) =>
			row.id !== options.excludeId &&
			row.label.trim().toLowerCase() === normalized
	);
	if (collidesMix) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "You already have a mix with this label",
		});
	}

	const existingVariants = await db
		.select({ id: gameVariant.id, label: gameVariant.label })
		.from(gameVariant)
		.where(eq(gameVariant.userId, userId));
	const collidesVariant = existingVariants.some(
		(row) => row.label.trim().toLowerCase() === normalized
	);
	if (collidesVariant) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "You already have a game variant with this label",
		});
	}
}

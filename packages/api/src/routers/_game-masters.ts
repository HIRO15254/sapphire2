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

export const RESERVED_LABELS = new Set(
	[MIX_VARIANT, MIX_VARIANT_LABEL].map((s) => s.toLowerCase())
);

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

// Shared write=read Zod schemas for mixed-game "game groups" (SA2 mix-game
// support). A group bundles the games that share one blind structure — e.g.
// an 8-Game mix is [Limit: 27td/lhe/o8, Stud: razz/stud/stud8, Big Bet:
// nlh/plo]. Stored as JSON on ring_game.mix_games / session_cash_detail
// .mix_games (mixGamesSchema) and blind_level.games / session_blind_level
// .games (levelGamesSchema). db, api, and web must all validate through
// these exact objects — never a looser inline copy (api-data-integrity.md).
import z from "zod";

// Shared by mixGamesSchema/levelGamesSchema below AND by the game-mix
// router's master-mix group-span guard (packages/api/src/routers/game-mix.ts)
// so the two limits cannot drift apart (c58) — a master mix spanning more
// groups than a session mix can ever hold would silently fail/truncate later.
export const MAX_MIX_GROUPS = 12;

export const anteTypeSchema = z.enum(["none", "all", "bb"]);

const storedVariantLabelSchema = z.string().trim().min(1).max(30);

export const mixGameGroupSchema = z.object({
	// Optional display name ("Limit", "Big Bet"); display falls back to the
	// joined variant short labels when absent.
	name: z.string().max(30).nullish(),
	// Preset keys or custom-variant labels. The slot meaning of blind1/2/3
	// follows the group's game family (stud: Small Bet / Big Bet / Bring-in).
	variants: z.array(storedVariantLabelSchema).min(1).max(30),
	blind1: z.number().int().min(0).nullish(),
	blind2: z.number().int().min(0).nullish(),
	blind3: z.number().int().min(0).nullish(),
	ante: z.number().int().min(0).nullish(),
	anteType: anteTypeSchema.nullish(),
});

export type MixGameGroup = z.infer<typeof mixGameGroupSchema>;

function hasNoDuplicateVariants(groups: { variants: string[] }[]): boolean {
	const seen = new Set<string>();
	for (const g of groups) {
		for (const variant of g.variants) {
			const key = variant.trim().toLowerCase();
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
		}
	}
	return true;
}

function totalVariantCount(groups: { variants: string[] }[]): number {
	return groups.reduce((count, g) => count + g.variants.length, 0);
}

export const mixGamesSchema = z
	.array(mixGameGroupSchema)
	.min(1)
	.max(MAX_MIX_GROUPS)
	.refine(hasNoDuplicateVariants, {
		message: "Each game may appear in only one group",
	})
	.refine((groups) => totalVariantCount(groups) >= 2, {
		message: "A mix needs at least two games",
	});

// Tournament levels reuse the same group shape minus anteType (ante handling
// is uniform inside a level); minutes/isBreak stay on the level itself.
export const levelGameGroupSchema = mixGameGroupSchema.omit({
	anteType: true,
});

export type LevelGameGroup = z.infer<typeof levelGameGroupSchema>;

export const levelGamesSchema = z
	.array(levelGameGroupSchema)
	.min(1)
	.max(MAX_MIX_GROUPS)
	.refine(hasNoDuplicateVariants, {
		message: "Each game may appear in only one group",
	});

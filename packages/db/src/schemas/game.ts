import z from "zod";

export const MAX_MIX_GROUPS = 12;

export const anteTypeSchema = z.enum(["none", "all", "bb"]);

const storedVariantLabelSchema = z.string().trim().min(1).max(30);

export const mixGameGroupSchema = z.object({
	name: z.string().max(30).nullish(),
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

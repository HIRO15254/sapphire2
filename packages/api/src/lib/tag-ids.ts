import z from "zod";

export const optionalUniqueTagIdsSchema = z
	.array(z.string())
	.refine((tagIds) => new Set(tagIds).size === tagIds.length, {
		message: "Tag IDs must be unique",
	})
	.optional();

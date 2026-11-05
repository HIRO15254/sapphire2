import z from "zod";

export const MAX_LINKED_TAGS = 100;

export const tagIdsSchema = z
	.array(z.string().min(1))
	.max(MAX_LINKED_TAGS)
	.refine((ids) => new Set(ids).size === ids.length, {
		message: "tagIds must not repeat a tag",
	});

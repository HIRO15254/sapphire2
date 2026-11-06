import { entryTag } from "@sapphire2/db/schema/entry-tag";
import {
	createTagRouter,
	type Tag,
	tagCreateInputSchema,
	tagSelection,
	tagUpdateInputSchema,
} from "./tag-router";

export const entryTagRouter = createTagRouter<
	Tag,
	typeof tagCreateInputSchema,
	typeof tagUpdateInputSchema
>({
	createInputSchema: tagCreateInputSchema,
	nameIndex: "entry_tag_name_uq",
	selection: tagSelection(entryTag),
	table: entryTag,
	updateInputSchema: tagUpdateInputSchema,
});

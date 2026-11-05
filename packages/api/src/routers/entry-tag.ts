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
	table: entryTag,
	nameIndex: "entry_tag_name_uq",
	selection: tagSelection(entryTag),
	createInputSchema: tagCreateInputSchema,
	updateInputSchema: tagUpdateInputSchema,
});

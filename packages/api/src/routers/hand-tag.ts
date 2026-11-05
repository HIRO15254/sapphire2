import { handTag } from "@sapphire2/db/schema/hand-tag";
import {
	createTagRouter,
	type Tag,
	tagCreateInputSchema,
	tagSelection,
	tagUpdateInputSchema,
} from "./tag-router";

export const handTagRouter = createTagRouter<
	Tag,
	typeof tagCreateInputSchema,
	typeof tagUpdateInputSchema
>({
	table: handTag,
	nameIndex: "hand_tag_name_uq",
	selection: tagSelection(handTag),
	createInputSchema: tagCreateInputSchema,
	updateInputSchema: tagUpdateInputSchema,
});

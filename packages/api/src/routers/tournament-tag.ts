import { tournamentTag } from "@sapphire2/db/schema/tournament-tag";
import {
	createTagRouter,
	type Tag,
	tagCreateInputSchema,
	tagSelection,
	tagUpdateInputSchema,
} from "./tag-router";

export const tournamentTagRouter = createTagRouter<
	Tag,
	typeof tagCreateInputSchema,
	typeof tagUpdateInputSchema
>({
	createInputSchema: tagCreateInputSchema,
	nameIndex: "tournament_tag_name_uq",
	selection: tagSelection(tournamentTag),
	table: tournamentTag,
	updateInputSchema: tagUpdateInputSchema,
});

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
	table: tournamentTag,
	nameIndex: "tournament_tag_name_uq",
	selection: tagSelection(tournamentTag),
	createInputSchema: tagCreateInputSchema,
	updateInputSchema: tagUpdateInputSchema,
});

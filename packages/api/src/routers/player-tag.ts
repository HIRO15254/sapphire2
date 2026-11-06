import {
	TAG_COLOR_NAMES,
	type TagColor,
} from "@sapphire2/db/constants/player-tag-colors";
import { playerTag } from "@sapphire2/db/schema/player";
import { idSchema } from "@sapphire2/db/schemas/id";
import z from "zod";
import {
	createTagRouter,
	type Tag,
	tagNameSchema,
	tagSelection,
} from "./tag-router";

const colorSchema = z.enum(TAG_COLOR_NAMES);

export interface PlayerTag extends Tag {
	color: TagColor;
}

export const playerTagCreateInputSchema = z.object({
	name: tagNameSchema,
	color: colorSchema.default("gray"),
});

export const playerTagUpdateInputSchema = z
	.object({
		id: idSchema,
		name: tagNameSchema.optional(),
		color: colorSchema.optional(),
	})
	.refine((input) => input.name !== undefined || input.color !== undefined, {
		message: "Supply name or color",
	});

export const playerTagRouter = createTagRouter<
	PlayerTag,
	typeof playerTagCreateInputSchema,
	typeof playerTagUpdateInputSchema
>({
	table: playerTag,
	nameIndex: "player_tag_name_uq",
	selection: { ...tagSelection(playerTag), color: playerTag.color },
	createInputSchema: playerTagCreateInputSchema,
	updateInputSchema: playerTagUpdateInputSchema,
	extraColumns: ["color"],
});

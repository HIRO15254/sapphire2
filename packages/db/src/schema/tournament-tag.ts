import { defineTagTables } from "./tag-tables";
import { tournament } from "./tournament";

export const { tag: tournamentTag, link: tournamentTagLink } = defineTagTables(
	"tournament",
	() => tournament
);

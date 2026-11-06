import { entry } from "./entry";
import { defineTagTables } from "./tag-tables";

export const { tag: entryTag, link: entryTagLink } = defineTagTables(
	"entry",
	() => entry
);

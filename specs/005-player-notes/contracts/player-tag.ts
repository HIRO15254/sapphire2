/**
 * PlayerTag Router Contract
 *
 * tRPC router: appRouter.playerTag
 * All procedures use protectedProcedure (auth required)
 */

// === Preset Colors ===
export type TagColor =
	| "gray"
	| "red"
	| "orange"
	| "yellow"
	| "green"
	| "blue"
	| "purple"
	| "pink";

// === Inputs ===

export interface PlayerTagCreateInput {
	color?: TagColor; // defaults to "gray"
	name: string; // min(1), max(50)
}

export interface PlayerTagUpdateInput {
	color?: TagColor;
	id: string;
	name?: string; // min(1), max(50)
}

export interface PlayerTagDeleteInput {
	id: string;
}

// === Outputs ===

export interface PlayerTagItem {
	color: string;
	createdAt: Date;
	id: string;
	name: string;
	updatedAt: Date;
	userId: string;
}

// === Procedures ===

// playerTag.list   -> query() -> PlayerTagItem[]
// playerTag.create -> mutation(PlayerTagCreateInput) -> PlayerTagItem
// playerTag.update -> mutation(PlayerTagUpdateInput) -> PlayerTagItem
// playerTag.delete -> mutation(PlayerTagDeleteInput) -> { success: true }
//   (cascade cleanup removes all playerToPlayerTag rows for the tag)

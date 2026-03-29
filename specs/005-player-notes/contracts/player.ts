/**
 * Player Router Contract
 *
 * tRPC router: appRouter.player
 * All procedures use protectedProcedure (auth required)
 */

// === Inputs ===

export interface PlayerCreateInput {
	memo?: string; // HTML content, max(50000)
	name: string; // min(1), max(100)
	tagIds?: string[]; // optional initial tag assignments
}

export interface PlayerUpdateInput {
	id: string;
	memo?: string; // HTML content, max(50000)
	name?: string; // min(1), max(100)
	tagIds?: string[]; // full replacement of tag assignments
}

export interface PlayerDeleteInput {
	id: string;
}

export interface PlayerGetByIdInput {
	id: string;
}

export interface PlayerListInput {
	search?: string; // search by name (partial match)
	tagIds?: string[]; // filter by tags (AND logic)
}

// === Outputs ===

export interface PlayerListItem {
	createdAt: Date;
	id: string;
	memo: string | null;
	name: string;
	tags: Array<{ id: string; name: string; color: string }>;
	updatedAt: Date;
}

export interface PlayerDetail {
	createdAt: Date;
	id: string;
	memo: string | null;
	name: string;
	tags: Array<{ id: string; name: string; color: string }>;
	updatedAt: Date;
}

// === Procedures ===

// player.list    -> query(PlayerListInput)  -> PlayerListItem[]
// player.getById -> query(PlayerGetByIdInput) -> PlayerDetail
// player.create  -> mutation(PlayerCreateInput) -> PlayerDetail
// player.update  -> mutation(PlayerUpdateInput) -> PlayerDetail
// player.delete  -> mutation(PlayerDeleteInput) -> { success: true }

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
	tagIds?: string[]; // initial tag assignments
}

export interface PlayerUpdateInput {
	id: string;
	memo?: string | null; // HTML content, optional null to clear
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
	search?: string; // partial match on player name
	tagIds?: string[]; // matches players that have any selected tag
}

// === Outputs ===

export interface PlayerTagSummary {
	color: string;
	id: string;
	name: string;
}

export interface PlayerListItem {
	createdAt: Date;
	id: string;
	memo: string | null;
	name: string;
	tags: PlayerTagSummary[];
	updatedAt: Date;
	userId: string;
}

export interface PlayerDetail {
	createdAt: Date;
	id: string;
	memo: string | null;
	name: string;
	tags: PlayerTagSummary[];
	updatedAt: Date;
	userId: string;
}

// === Procedures ===

// player.list    -> query(PlayerListInput | undefined) -> PlayerListItem[]
// player.getById -> query(PlayerGetByIdInput) -> PlayerDetail
// player.create  -> mutation(PlayerCreateInput) -> PlayerDetail
// player.update  -> mutation(PlayerUpdateInput) -> PlayerDetail
// player.delete  -> mutation(PlayerDeleteInput) -> { success: true }

/**
 * Player Router Contract
 *
 * tRPC router: appRouter.player
 * All procedures use protectedProcedure (auth required)
 */

// === Inputs ===

interface PlayerCreateInput {
  name: string; // min(1), max(100)
  memo?: string; // HTML content, max(50000)
  tagIds?: string[]; // optional initial tag assignments
}

interface PlayerUpdateInput {
  id: string;
  name?: string; // min(1), max(100)
  memo?: string; // HTML content, max(50000)
  tagIds?: string[]; // full replacement of tag assignments
}

interface PlayerDeleteInput {
  id: string;
}

interface PlayerGetByIdInput {
  id: string;
}

interface PlayerListInput {
  tagIds?: string[]; // filter by tags (AND logic)
  search?: string; // search by name (partial match)
}

// === Outputs ===

interface PlayerListItem {
  id: string;
  name: string;
  memo: string | null;
  tags: Array<{ id: string; name: string; color: string }>;
  createdAt: Date;
  updatedAt: Date;
}

interface PlayerDetail {
  id: string;
  name: string;
  memo: string | null;
  tags: Array<{ id: string; name: string; color: string }>;
  createdAt: Date;
  updatedAt: Date;
}

// === Procedures ===

// player.list    -> query(PlayerListInput)  -> PlayerListItem[]
// player.getById -> query(PlayerGetByIdInput) -> PlayerDetail
// player.create  -> mutation(PlayerCreateInput) -> PlayerDetail
// player.update  -> mutation(PlayerUpdateInput) -> PlayerDetail
// player.delete  -> mutation(PlayerDeleteInput) -> { success: true }

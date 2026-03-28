/**
 * PlayerTag Router Contract
 *
 * tRPC router: appRouter.playerTag
 * All procedures use protectedProcedure (auth required)
 */

// === Preset Colors ===
type TagColor =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink";

// === Inputs ===

interface PlayerTagCreateInput {
  name: string; // min(1), max(50)
  color?: TagColor; // defaults to "gray"
}

interface PlayerTagUpdateInput {
  id: string;
  name?: string; // min(1), max(50)
  color?: TagColor;
}

interface PlayerTagDeleteInput {
  id: string;
}

// === Outputs ===

interface PlayerTagItem {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

// === Procedures ===

// playerTag.list   -> query()                      -> PlayerTagItem[]
// playerTag.create -> mutation(PlayerTagCreateInput)  -> PlayerTagItem
// playerTag.update -> mutation(PlayerTagUpdateInput)  -> PlayerTagItem
// playerTag.delete -> mutation(PlayerTagDeleteInput)  -> { success: true }
//   (cascade: removes all playerToPlayerTag entries for this tag)

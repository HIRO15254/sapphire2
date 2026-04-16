import { IconPlus, IconTags, IconUsers } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PlayerCard } from "@/players/components/player-card";
import { PlayerFilters } from "@/players/components/player-filters";
import type { PlayerFormValues } from "@/players/components/player-form";
import { PlayerForm } from "@/players/components/player-form";
import { PlayerTagManager } from "@/players/components/player-tag-manager";
import type { PlayerItem } from "@/players/hooks/use-players";
import { usePlayers } from "@/players/hooks/use-players";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

export const Route = createFileRoute("/players/")({
	component: PlayersPage,
});

function PlayersPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingPlayer, setEditingPlayer] = useState<PlayerItem | null>(null);
	const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
	const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

	const {
		players,
		availableTags,
		isCreatePending,
		isUpdatePending,
		create,
		update,
		delete: deletePlayer,
		createTag,
	} = usePlayers(filterTagIds);

	const handleCreate = (values: PlayerFormValues) => {
		create(values).then(() => {
			setIsCreateOpen(false);
		});
	};

	const handleUpdate = (values: PlayerFormValues) => {
		if (!editingPlayer) {
			return;
		}
		update({ id: editingPlayer.id, ...values }).then(() => {
			setEditingPlayer(null);
		});
	};

	const handleDelete = (id: string) => {
		deletePlayer(id);
	};

	return (
		<div className="p-4 md:p-6">
			<PageHeader
				actions={
					<>
						<Button
							onClick={() => setIsTagManagerOpen(true)}
							size="sm"
							variant="outline"
						>
							<IconTags size={16} />
							Manage Tags
						</Button>
						<Button onClick={() => setIsCreateOpen(true)}>
							<IconPlus size={16} />
							New Player
						</Button>
					</>
				}
				heading="Players"
			/>

			{availableTags.length > 0 && (
				<div className="mb-4">
					<PlayerFilters
						availableTags={availableTags}
						onTagIdsChange={setFilterTagIds}
						selectedTagIds={filterTagIds}
					/>
				</div>
			)}

			{players.length === 0 ? (
				<EmptyState
					action={
						filterTagIds.length === 0 ? (
							<Button onClick={() => setIsCreateOpen(true)} variant="outline">
								<IconPlus size={16} />
								New Player
							</Button>
						) : undefined
					}
					description={
						filterTagIds.length > 0
							? "Try changing the selected tags."
							: "Create your first player to start tracking opponents."
					}
					heading={
						filterTagIds.length > 0
							? "No players match the selected filters"
							: "No players yet"
					}
					icon={<IconUsers size={48} />}
				/>
			) : (
				<div className="flex flex-col gap-2">
					{players.map((player) => (
						<PlayerCard
							key={player.id}
							onDelete={handleDelete}
							onEdit={(player) =>
								setEditingPlayer({ ...player, isTemporary: false })
							}
							player={player}
						/>
					))}
				</div>
			)}

			<ResponsiveDialog
				onOpenChange={setIsCreateOpen}
				open={isCreateOpen}
				title="New Player"
			>
				<PlayerForm
					availableTags={availableTags}
					isLoading={isCreatePending}
					onCreateTag={createTag}
					onSubmit={handleCreate}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingPlayer(null);
					}
				}}
				open={editingPlayer !== null}
				title="Edit Player"
			>
				{editingPlayer && (
					<PlayerForm
						availableTags={availableTags}
						defaultMemo={editingPlayer.memo}
						defaultTags={editingPlayer.tags}
						defaultValues={{ name: editingPlayer.name }}
						isLoading={isUpdatePending}
						onCreateTag={createTag}
						onSubmit={handleUpdate}
					/>
				)}
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={setIsTagManagerOpen}
				open={isTagManagerOpen}
				title="Manage Tags"
			>
				<PlayerTagManager />
			</ResponsiveDialog>
		</div>
	);
}

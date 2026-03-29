import { IconPlus, IconTags, IconUsers } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { PlayerCard } from "@/components/players/player-card";
import { PlayerFilters } from "@/components/players/player-filters";
import type { PlayerFormValues } from "@/components/players/player-form";
import { PlayerForm } from "@/components/players/player-form";
import { PlayerMemoEditor } from "@/components/players/player-memo-editor";
import { PlayerTagManager } from "@/components/players/player-tag-manager";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/players/")({
	component: PlayersPage,
});

interface PlayerItem {
	createdAt: string;
	id: string;
	memo: string | null;
	name: string;
	tags: Array<{ id: string; name: string; color: string }>;
	updatedAt: string;
	userId: string;
}

function PlayersPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingPlayer, setEditingPlayer] = useState<PlayerItem | null>(null);
	const [memoPlayer, setMemoPlayer] = useState<PlayerItem | null>(null);
	const [isMemoDirty, setIsMemoDirty] = useState(false);
	const [showMemoCloseWarning, setShowMemoCloseWarning] = useState(false);
	const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
	const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

	const queryClient = useQueryClient();

	const playerListOptions = trpc.player.list.queryOptions(
		filterTagIds.length > 0 ? { tagIds: filterTagIds } : undefined
	);
	const playerListKey = playerListOptions.queryKey;

	const playersQuery = useQuery(playerListOptions);
	const players = playersQuery.data ?? [];

	const tagsQuery = useQuery(trpc.playerTag.list.queryOptions());
	const availableTags = (tagsQuery.data ?? []) as Array<{
		color: string;
		id: string;
		name: string;
	}>;

	const handleCreateTag = async (name: string) => {
		const created = await trpcClient.playerTag.create.mutate({ name });
		queryClient.invalidateQueries({
			queryKey: trpc.playerTag.list.queryOptions().queryKey,
		});
		return { id: created.id, name: created.name, color: created.color };
	};

	const createMutation = useMutation({
		mutationFn: (values: PlayerFormValues) =>
			trpcClient.player.create.mutate(values),
		onMutate: async (newPlayer) => {
			await queryClient.cancelQueries({ queryKey: playerListKey });
			const previous = queryClient.getQueryData(playerListKey);
			queryClient.setQueryData(
				playerListKey,
				(old: PlayerItem[] | undefined) => {
					if (!old) {
						return old;
					}
					const newTags = newPlayer.tagIds
						? availableTags.filter((t) => newPlayer.tagIds?.includes(t.id))
						: [];
					return [
						...old,
						{
							id: `temp-${Date.now()}`,
							name: newPlayer.name,
							memo: null,
							tags: newTags,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
							userId: "",
						},
					];
				}
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(playerListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: playerListKey });
		},
		onSuccess: () => {
			setIsCreateOpen(false);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: PlayerFormValues & { id: string }) =>
			trpcClient.player.update.mutate(values),
		onMutate: async (updated) => {
			await queryClient.cancelQueries({ queryKey: playerListKey });
			const previous = queryClient.getQueryData(playerListKey);
			queryClient.setQueryData(
				playerListKey,
				(old: PlayerItem[] | undefined) => {
					if (!old) {
						return old;
					}
					return old.map((p) => {
						if (p.id !== updated.id) {
							return p;
						}
						const newTags = updated.tagIds
							? availableTags.filter((t) => updated.tagIds?.includes(t.id))
							: p.tags;
						return {
							...p,
							name: updated.name,
							tags: newTags,
						};
					});
				}
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(playerListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: playerListKey });
		},
		onSuccess: () => {
			setEditingPlayer(null);
		},
	});

	const memoMutation = useMutation({
		mutationFn: (values: { id: string; memo: string | null }) =>
			trpcClient.player.update.mutate({
				id: values.id,
				memo: values.memo,
			}),
		onMutate: async (updated) => {
			await queryClient.cancelQueries({ queryKey: playerListKey });
			const previous = queryClient.getQueryData(playerListKey);
			queryClient.setQueryData(
				playerListKey,
				(old: PlayerItem[] | undefined) => {
					if (!old) {
						return old;
					}
					return old.map((p) =>
						p.id === updated.id ? { ...p, memo: updated.memo } : p
					);
				}
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(playerListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: playerListKey });
		},
		onSuccess: () => {
			toast.success("Memo saved");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.player.delete.mutate({ id }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: playerListKey });
			const previous = queryClient.getQueryData(playerListKey);
			queryClient.setQueryData(playerListKey, (old: PlayerItem[] | undefined) =>
				old?.filter((p) => p.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(playerListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: playerListKey });
		},
	});

	const handleCreate = (values: PlayerFormValues) => {
		createMutation.mutate(values);
	};

	const handleUpdate = (values: PlayerFormValues) => {
		if (!editingPlayer) {
			return;
		}
		updateMutation.mutate({ id: editingPlayer.id, ...values });
	};

	const handleDelete = (id: string) => {
		deleteMutation.mutate(id);
	};

	const handleMemoSave = useCallback(
		(html: string) => {
			if (!memoPlayer) {
				return;
			}
			memoMutation.mutate({
				id: memoPlayer.id,
				memo: html || null,
			});
		},
		[memoPlayer, memoMutation]
	);

	const handleMemoDialogClose = useCallback(
		(open: boolean) => {
			if (!open && isMemoDirty) {
				setShowMemoCloseWarning(true);
				return;
			}
			if (!open) {
				setMemoPlayer(null);
				setIsMemoDirty(false);
				setShowMemoCloseWarning(false);
			}
		},
		[isMemoDirty]
	);

	const handleMemoForceClose = useCallback(() => {
		setMemoPlayer(null);
		setIsMemoDirty(false);
		setShowMemoCloseWarning(false);
	}, []);

	return (
		<div className="p-4 md:p-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Players</h1>
				<div className="flex gap-2">
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
				</div>
			</div>

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
				<div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
					<IconUsers size={48} />
					<p className="text-lg">
						{filterTagIds.length > 0
							? "No players match the selected filters"
							: "No players yet"}
					</p>
					{filterTagIds.length === 0 && (
						<>
							<p className="text-sm">
								Create your first player to start tracking opponents.
							</p>
							<Button onClick={() => setIsCreateOpen(true)} variant="outline">
								<IconPlus size={16} />
								New Player
							</Button>
						</>
					)}
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{players.map((player) => (
						<PlayerCard
							key={player.id}
							onDelete={handleDelete}
							onEdit={setEditingPlayer}
							onMemo={setMemoPlayer}
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
					isLoading={createMutation.isPending}
					onCreateTag={handleCreateTag}
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
						defaultTags={editingPlayer.tags}
						defaultValues={{ name: editingPlayer.name }}
						isLoading={updateMutation.isPending}
						onCreateTag={handleCreateTag}
						onSubmit={handleUpdate}
					/>
				)}
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={handleMemoDialogClose}
				open={memoPlayer !== null}
				title={memoPlayer ? `Memo: ${memoPlayer.name}` : "Memo"}
			>
				{memoPlayer && (
					<div className="flex flex-col gap-3">
						{showMemoCloseWarning && (
							<div className="flex items-center justify-between rounded-md border border-destructive bg-destructive/10 p-3">
								<span className="text-destructive text-sm">
									You have unsaved changes.
								</span>
								<div className="flex gap-2">
									<Button
										onClick={() => setShowMemoCloseWarning(false)}
										size="sm"
										variant="outline"
									>
										Keep Editing
									</Button>
									<Button
										onClick={handleMemoForceClose}
										size="sm"
										variant="destructive"
									>
										Discard
									</Button>
								</div>
							</div>
						)}
						<PlayerMemoEditor
							initialContent={memoPlayer.memo}
							isLoading={memoMutation.isPending}
							onDirtyChange={setIsMemoDirty}
							onSave={handleMemoSave}
						/>
					</div>
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

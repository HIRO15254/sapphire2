import { IconPlus, IconUsers } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PlayerCard } from "@/components/players/player-card";
import { PlayerForm } from "@/components/players/player-form";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/players/")({
	component: PlayersPage,
});

interface PlayerFormValues {
	name: string;
}

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

	const queryClient = useQueryClient();
	const playerListKey = trpc.player.list.queryOptions().queryKey;

	const playersQuery = useQuery(trpc.player.list.queryOptions());
	const players = playersQuery.data ?? [];

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
					return [
						...old,
						{
							id: `temp-${Date.now()}`,
							name: newPlayer.name,
							memo: null,
							tags: [],
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
			queryClient.setQueryData(playerListKey, (old: PlayerItem[] | undefined) =>
				old?.map((p) =>
					p.id === updated.id ? { ...p, name: updated.name } : p
				)
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

	return (
		<div className="p-4 md:p-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Players</h1>
				<Button onClick={() => setIsCreateOpen(true)}>
					<IconPlus size={16} />
					New Player
				</Button>
			</div>

			{players.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
					<IconUsers size={48} />
					<p className="text-lg">No players yet</p>
					<p className="text-sm">
						Create your first player to start tracking opponents.
					</p>
					<Button onClick={() => setIsCreateOpen(true)} variant="outline">
						<IconPlus size={16} />
						New Player
					</Button>
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{players.map((player) => (
						<PlayerCard
							key={player.id}
							onDelete={handleDelete}
							onEdit={setEditingPlayer}
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
					isLoading={createMutation.isPending}
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
						defaultValues={{ name: editingPlayer.name }}
						isLoading={updateMutation.isPending}
						onSubmit={handleUpdate}
					/>
				)}
			</ResponsiveDialog>
		</div>
	);
}

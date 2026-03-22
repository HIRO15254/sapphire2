import {
	IconArchive,
	IconArchiveOff,
	IconEdit,
	IconList,
	IconPlus,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BlindLevelEditor } from "@/components/stores/blind-level-editor";
import { TournamentForm } from "@/components/stores/tournament-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { formatCompactNumber } from "@/utils/format-number";
import { trpc, trpcClient } from "@/utils/trpc";

interface Tournament {
	addonAllowed: boolean;
	addonChips: number | null;
	addonCost: number | null;
	archivedAt: Date | string | null;
	blindLevelCount: number;
	bountyAmount: number | null;
	buyIn: number | null;
	currencyId: string | null;
	entryFee: number | null;
	id: string;
	memo: string | null;
	name: string;
	rebuyAllowed: boolean;
	rebuyChips: number | null;
	rebuyCost: number | null;
	startingStack: number | null;
	storeId: string;
	tableSize: number | null;
	tags: { id: string; name: string }[];
	variant: string;
}

interface TournamentFormValues {
	addonAllowed: boolean;
	addonChips?: number;
	addonCost?: number;
	bountyAmount?: number;
	buyIn?: number;
	currencyId?: string;
	entryFee?: number;
	memo?: string;
	name: string;
	rebuyAllowed: boolean;
	rebuyChips?: number;
	rebuyCost?: number;
	startingStack?: number;
	tableSize?: number;
	tags?: string[];
	variant: string;
}

interface TournamentTabProps {
	storeId: string;
}

interface TournamentCardProps {
	isArchived: boolean;
	onArchive: (id: string) => void;
	onDelete: (id: string) => void;
	onEdit: (tournament: Tournament) => void;
	onRestore: (id: string) => void;
	tournament: Tournament;
}

interface TournamentListProps {
	isArchived: boolean;
	isLoading: boolean;
	onAddTournament: () => void;
	onArchive: (id: string) => void;
	onDelete: (id: string) => void;
	onEdit: (tournament: Tournament) => void;
	onRestore: (id: string) => void;
	tournaments: Tournament[];
}

function formatBuyIn(t: Tournament): string {
	if (t.buyIn == null) {
		return "";
	}
	const parts = [`Buy-in: ${formatCompactNumber(t.buyIn)}`];
	if (t.entryFee != null) {
		parts.push(`+${formatCompactNumber(t.entryFee)}`);
	}
	return parts.join("");
}

function TournamentCard({
	tournament,
	isArchived,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
}: TournamentCardProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [blindEditorOpen, setBlindEditorOpen] = useState(false);
	const buyInInfo = formatBuyIn(tournament);
	const startingStackInfo =
		tournament.startingStack != null
			? `Stack: ${formatCompactNumber(tournament.startingStack)}`
			: null;

	return (
		<div className="rounded-lg border bg-card">
			<div className="flex items-start justify-between gap-2 p-3">
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium">{tournament.name}</p>
					<div className="mt-0.5 flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
						{buyInInfo && <span>{buyInInfo}</span>}
						{startingStackInfo && <span>{startingStackInfo}</span>}
						{tournament.tableSize != null && (
							<span>{tournament.tableSize}-max</span>
						)}
						{tournament.blindLevelCount > 0 && (
							<span>{tournament.blindLevelCount} levels</span>
						)}
					</div>
					{tournament.memo && (
						<p className="mt-1 line-clamp-1 text-muted-foreground text-xs">
							{tournament.memo}
						</p>
					)}
					{tournament.tags.length > 0 && (
						<div className="mt-1 flex flex-wrap gap-1">
							{tournament.tags.map((tag) => (
								<Badge key={tag.id} variant="outline">
									{tag.name}
								</Badge>
							))}
						</div>
					)}
					<Button
						className="mt-2 gap-1.5 text-xs"
						onClick={() => setBlindEditorOpen(true)}
						size="sm"
						variant="outline"
					>
						<IconList size={13} />
						Edit Structure
					</Button>
				</div>

				<div className="flex shrink-0 items-center gap-1">
					{confirmingDelete ? (
						<>
							<span className="text-destructive text-xs">Delete?</span>
							<Button
								aria-label="Confirm delete"
								className="text-destructive hover:text-destructive"
								onClick={() => {
									onDelete(tournament.id);
									setConfirmingDelete(false);
								}}
								size="sm"
								variant="ghost"
							>
								<IconTrash size={14} />
							</Button>
							<Button
								aria-label="Cancel delete"
								onClick={() => setConfirmingDelete(false)}
								size="sm"
								variant="ghost"
							>
								<IconX size={14} />
							</Button>
						</>
					) : (
						<>
							<Button
								aria-label="Edit tournament"
								onClick={() => onEdit(tournament)}
								size="sm"
								variant="ghost"
							>
								<IconEdit size={14} />
							</Button>
							{isArchived ? (
								<Button
									aria-label="Restore tournament"
									onClick={() => onRestore(tournament.id)}
									size="sm"
									variant="ghost"
								>
									<IconArchiveOff size={14} />
								</Button>
							) : (
								<Button
									aria-label="Archive tournament"
									onClick={() => onArchive(tournament.id)}
									size="sm"
									variant="ghost"
								>
									<IconArchive size={14} />
								</Button>
							)}
							<Button
								aria-label="Delete tournament"
								onClick={() => setConfirmingDelete(true)}
								size="sm"
								variant="ghost"
							>
								<IconTrash size={14} />
							</Button>
						</>
					)}
				</div>
			</div>

			<BlindLevelEditor
				onOpenChange={setBlindEditorOpen}
				open={blindEditorOpen}
				tournamentId={tournament.id}
				variant={tournament.variant}
			/>
		</div>
	);
}

function TournamentList({
	tournaments,
	isLoading,
	isArchived,
	onAddTournament,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
}: TournamentListProps) {
	if (isLoading) {
		return (
			<p className="py-8 text-center text-muted-foreground text-sm">
				Loading...
			</p>
		);
	}

	if (tournaments.length === 0) {
		return (
			<div className="py-8 text-center text-muted-foreground">
				<p className="text-sm">
					{isArchived ? "No archived tournaments." : "No tournaments yet."}
				</p>
				{!isArchived && (
					<Button
						className="mt-3"
						onClick={onAddTournament}
						size="sm"
						variant="outline"
					>
						<IconPlus size={14} />
						Add Tournament
					</Button>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{tournaments.map((t) => (
				<TournamentCard
					isArchived={isArchived}
					key={t.id}
					onArchive={onArchive}
					onDelete={onDelete}
					onEdit={onEdit}
					onRestore={onRestore}
					tournament={t}
				/>
			))}
		</div>
	);
}

export function TournamentTab({ storeId }: TournamentTabProps) {
	const [showArchived, setShowArchived] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingTournament, setEditingTournament] = useState<Tournament | null>(
		null
	);

	const queryClient = useQueryClient();

	const tournamentsQueryOptions = trpc.tournament.listByStore.queryOptions({
		storeId,
		includeArchived: showArchived,
	});

	const tournamentsQuery = useQuery(tournamentsQueryOptions);
	const tournaments = (tournamentsQuery.data ?? []) as Tournament[];

	const syncTags = async (
		tournamentId: string,
		newTags: string[],
		existingTags: { id: string; name: string }[]
	) => {
		const existingNames = existingTags.map((t) => t.name);
		const toAdd = newTags.filter((t) => !existingNames.includes(t));
		const toRemove = existingTags.filter((t) => !newTags.includes(t.name));
		await Promise.all([
			...toAdd.map((name) =>
				trpcClient.tournament.addTag.mutate({ tournamentId, name })
			),
			...toRemove.map((tag) =>
				trpcClient.tournament.removeTag.mutate({ id: tag.id })
			),
		]);
	};

	const createMutation = useMutation({
		mutationFn: async (values: TournamentFormValues) => {
			const { tags, ...rest } = values;
			const created = await trpcClient.tournament.create.mutate({
				storeId,
				...rest,
			});
			if (tags && tags.length > 0) {
				await syncTags(created.id, tags, []);
			}
			return created;
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: tournamentsQueryOptions.queryKey,
			});
		},
		onSuccess: () => {
			setIsCreateOpen(false);
		},
	});

	const updateMutation = useMutation({
		mutationFn: async (
			values: TournamentFormValues & {
				id: string;
				existingTags: { id: string; name: string }[];
			}
		) => {
			const { tags, existingTags, ...rest } = values;
			const updated = await trpcClient.tournament.update.mutate(rest);
			if (tags !== undefined) {
				await syncTags(values.id, tags, existingTags);
			}
			return updated;
		},
		onMutate: async (updated) => {
			await queryClient.cancelQueries({
				queryKey: tournamentsQueryOptions.queryKey,
			});
			const previous = queryClient.getQueryData(
				tournamentsQueryOptions.queryKey
			);
			// Exclude tags/existingTags from optimistic update since they have different shape
			const {
				tags: _tags,
				existingTags: _existingTags,
				...cacheUpdate
			} = updated;
			queryClient.setQueryData(tournamentsQueryOptions.queryKey, (old) =>
				old?.map((t) => (t.id === updated.id ? { ...t, ...cacheUpdate } : t))
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(
					tournamentsQueryOptions.queryKey,
					context.previous
				);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: tournamentsQueryOptions.queryKey,
			});
		},
		onSuccess: () => {
			setEditingTournament(null);
		},
	});

	const archiveMutation = useMutation({
		mutationFn: (id: string) => trpcClient.tournament.archive.mutate({ id }),
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: tournamentsQueryOptions.queryKey,
			});
		},
	});

	const restoreMutation = useMutation({
		mutationFn: (id: string) => trpcClient.tournament.restore.mutate({ id }),
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: tournamentsQueryOptions.queryKey,
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.tournament.delete.mutate({ id }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({
				queryKey: tournamentsQueryOptions.queryKey,
			});
			const previous = queryClient.getQueryData(
				tournamentsQueryOptions.queryKey
			);
			queryClient.setQueryData(tournamentsQueryOptions.queryKey, (old) =>
				old?.filter((t) => t.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(
					tournamentsQueryOptions.queryKey,
					context.previous
				);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: tournamentsQueryOptions.queryKey,
			});
		},
	});

	const handleCreate = (values: TournamentFormValues) => {
		createMutation.mutate(values);
	};

	const handleUpdate = (values: TournamentFormValues) => {
		if (!editingTournament) {
			return;
		}
		updateMutation.mutate({
			id: editingTournament.id,
			existingTags: editingTournament.tags,
			...values,
		});
	};

	const handleArchive = (id: string) => {
		archiveMutation.mutate(id);
	};

	const handleRestore = (id: string) => {
		restoreMutation.mutate(id);
	};

	const handleDelete = (id: string) => {
		deleteMutation.mutate(id);
	};

	return (
		<div className="py-4">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex gap-2">
					<Button
						onClick={() => setShowArchived(false)}
						size="sm"
						variant={showArchived ? "ghost" : "secondary"}
					>
						Active
					</Button>
					<Button
						onClick={() => setShowArchived(true)}
						size="sm"
						variant={showArchived ? "secondary" : "ghost"}
					>
						Archived
					</Button>
				</div>
				{!showArchived && (
					<Button onClick={() => setIsCreateOpen(true)} size="sm">
						<IconPlus size={14} />
						Add Tournament
					</Button>
				)}
			</div>

			<TournamentList
				isArchived={showArchived}
				isLoading={tournamentsQuery.isLoading}
				onAddTournament={() => setIsCreateOpen(true)}
				onArchive={handleArchive}
				onDelete={handleDelete}
				onEdit={setEditingTournament}
				onRestore={handleRestore}
				tournaments={tournaments}
			/>

			<ResponsiveDialog
				onOpenChange={setIsCreateOpen}
				open={isCreateOpen}
				title="Add Tournament"
			>
				<TournamentForm
					isLoading={createMutation.isPending}
					onSubmit={handleCreate}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingTournament(null);
					}
				}}
				open={editingTournament !== null}
				title="Edit Tournament"
			>
				{editingTournament && (
					<TournamentForm
						defaultValues={{
							name: editingTournament.name,
							variant: editingTournament.variant,
							buyIn: editingTournament.buyIn ?? undefined,
							entryFee: editingTournament.entryFee ?? undefined,
							startingStack: editingTournament.startingStack ?? undefined,
							rebuyAllowed: editingTournament.rebuyAllowed,
							rebuyCost: editingTournament.rebuyCost ?? undefined,
							rebuyChips: editingTournament.rebuyChips ?? undefined,
							addonAllowed: editingTournament.addonAllowed,
							addonCost: editingTournament.addonCost ?? undefined,
							addonChips: editingTournament.addonChips ?? undefined,
							bountyAmount: editingTournament.bountyAmount ?? undefined,
							tableSize: editingTournament.tableSize ?? undefined,
							currencyId: editingTournament.currencyId ?? undefined,
							memo: editingTournament.memo ?? undefined,
							tags: editingTournament.tags.map((t) => t.name),
						}}
						isLoading={updateMutation.isPending}
						onSubmit={handleUpdate}
					/>
				)}
			</ResponsiveDialog>
		</div>
	);
}

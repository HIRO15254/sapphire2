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
import { useEffect, useState } from "react";
import {
	ExpandableItem,
	ExpandableItemList,
} from "@/components/management/expandable-item-list";
import { ManagementSectionHeader } from "@/components/management/management-section-header";
import { ManagementSectionState } from "@/components/management/management-section-state";
import { BlindLevelEditor } from "@/components/stores/blind-level-editor";
import { TournamentForm } from "@/components/stores/tournament-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
	createGroupFormatter,
	formatCompactNumber,
} from "@/utils/format-number";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { getTableSizeClassName } from "@/utils/table-size-colors";
import { trpc, trpcClient } from "@/utils/trpc";

interface ChipPurchase {
	chips: number;
	cost: number;
	id: string;
	name: string;
	sortOrder: number;
}

interface Tournament {
	archivedAt: string | null;
	blindLevelCount: number;
	bountyAmount: number | null;
	buyIn: number | null;
	chipPurchases: ChipPurchase[];
	createdAt: string;
	currencyId: string | null;
	entryFee: number | null;
	id: string;
	memo: string | null;
	name: string;
	startingStack: number | null;
	storeId: string;
	tableSize: number | null;
	tags: { id: string; name: string }[];
	updatedAt: string;
	variant: string;
}

interface ChipPurchaseFormItem {
	chips: number;
	cost: number;
	name: string;
}

interface TournamentFormValues {
	bountyAmount?: number;
	buyIn?: number;
	chipPurchases: ChipPurchaseFormItem[];
	currencyId?: string;
	entryFee?: number;
	memo?: string;
	name: string;
	startingStack?: number;
	tableSize?: number;
	tags?: string[];
	variant: string;
}

function buildOptimisticTournament(
	storeId: string,
	values: TournamentFormValues,
	id: string,
	existing?: Tournament
): Tournament {
	return {
		archivedAt: existing?.archivedAt ?? null,
		blindLevelCount: existing?.blindLevelCount ?? 0,
		bountyAmount: values.bountyAmount ?? null,
		buyIn: values.buyIn ?? null,
		chipPurchases:
			values.chipPurchases?.map((chipPurchase, index) => ({
				chips: chipPurchase.chips,
				cost: chipPurchase.cost,
				id: `${id}-chip-${String(index)}`,
				name: chipPurchase.name,
				sortOrder: index,
			})) ?? [],
		currencyId: values.currencyId ?? null,
		entryFee: values.entryFee ?? null,
		id,
		memo: values.memo ?? null,
		name: values.name,
		startingStack: values.startingStack ?? null,
		storeId,
		tableSize: values.tableSize ?? null,
		createdAt: existing?.createdAt ?? new Date().toISOString(),
		tags:
			values.tags?.map((tagName, index) => {
				const existingTag = existing?.tags.find((tag) => tag.name === tagName);
				return {
					id: existingTag?.id ?? `${id}-tag-${String(index)}`,
					name: tagName,
				};
			}) ??
			existing?.tags ??
			[],
		updatedAt: new Date().toISOString(),
		variant: values.variant,
	};
}

interface TournamentTabProps {
	expandedGameId: string | null;
	onToggleGame: (id: string | null) => void;
	storeId: string;
}

interface TournamentActionHandlers {
	onArchive: (id: string) => void;
	onDelete: (id: string) => void;
	onEdit: (tournament: Tournament) => void;
	onRestore: (id: string) => void;
}

interface TournamentListProps extends TournamentActionHandlers {
	expandedGameId: string | null;
	isArchived: boolean;
	onToggleGame: (id: string | null) => void;
	tournaments: Tournament[];
}

function TournamentList({
	tournaments,
	expandedGameId,
	isArchived,
	onToggleGame,
	...handlers
}: TournamentListProps) {
	if (tournaments.length === 0) {
		return null;
	}

	return (
		<ExpandableItemList
			onValueChange={onToggleGame}
			value={
				tournaments.some((tournament) => tournament.id === expandedGameId)
					? expandedGameId
					: null
			}
		>
			{tournaments.map((t) => (
				<TournamentRow
					expanded={expandedGameId === t.id}
					isArchived={isArchived}
					key={t.id}
					tournament={t}
					{...handlers}
				/>
			))}
		</ExpandableItemList>
	);
}

interface ArchivedTournamentSectionProps extends TournamentActionHandlers {
	expandedGameId: string | null;
	isLoading: boolean;
	onToggleGame: (id: string | null) => void;
	tournaments: Tournament[];
}

function ArchivedTournamentSection({
	tournaments,
	expandedGameId,
	isLoading,
	onToggleGame,
	...handlers
}: ArchivedTournamentSectionProps) {
	if (isLoading) {
		return <ManagementSectionState>Loading archived...</ManagementSectionState>;
	}

	if (tournaments.length === 0) {
		return (
			<ManagementSectionState>No archived tournaments.</ManagementSectionState>
		);
	}

	return (
		<div className="mt-1 border-t border-dashed pt-1">
			<TournamentList
				expandedGameId={expandedGameId}
				isArchived
				onToggleGame={onToggleGame}
				tournaments={tournaments}
				{...handlers}
			/>
		</div>
	);
}

interface TournamentContentProps extends TournamentActionHandlers {
	activeTournaments: Tournament[];
	archivedLoading: boolean;
	archivedTournaments: Tournament[];
	expandedGameId: string | null;
	isLoading: boolean;
	onToggleGame: (id: string | null) => void;
	showArchived: boolean;
}

function TournamentContent({
	activeTournaments,
	archivedLoading,
	archivedTournaments,
	expandedGameId,
	isLoading,
	onToggleGame,
	showArchived,
	...handlers
}: TournamentContentProps) {
	if (isLoading) {
		return (
			<ManagementSectionState className="py-2 text-xs">
				Loading...
			</ManagementSectionState>
		);
	}

	return (
		<>
			{activeTournaments.length === 0 && !showArchived && (
				<ManagementSectionState>No tournaments yet.</ManagementSectionState>
			)}
			<TournamentList
				expandedGameId={expandedGameId}
				isArchived={false}
				onToggleGame={onToggleGame}
				tournaments={activeTournaments}
				{...handlers}
			/>
			{showArchived && (
				<ArchivedTournamentSection
					expandedGameId={expandedGameId}
					isLoading={archivedLoading}
					onToggleGame={onToggleGame}
					tournaments={archivedTournaments}
					{...handlers}
				/>
			)}
		</>
	);
}

interface BlindLevelRow {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	id: string;
	isBreak: boolean;
	level: number;
	minutes: number | null;
	tournamentId: string;
}

function formatBuyInShort(t: Tournament): string {
	if (t.buyIn == null) {
		return "";
	}
	const fmt = createGroupFormatter([t.buyIn, t.entryFee]);
	if (t.entryFee != null) {
		return `${fmt(t.buyIn)}+${fmt(t.entryFee)}`;
	}
	return fmt(t.buyIn);
}

interface TournamentRowProps {
	expanded: boolean;
	isArchived: boolean;
	onArchive: (id: string) => void;
	onDelete: (id: string) => void;
	onEdit: (tournament: Tournament) => void;
	onRestore: (id: string) => void;
	tournament: Tournament;
}

function TournamentRow({
	tournament,
	expanded,
	isArchived,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
}: TournamentRowProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [blindEditorOpen, setBlindEditorOpen] = useState(false);
	const buyInStr = formatBuyInShort(tournament);

	useEffect(() => {
		if (!expanded) {
			setConfirmingDelete(false);
		}
	}, [expanded]);

	return (
		<>
			<ExpandableItem
				contentClassName="pl-2 pb-2"
				summary={
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-1">
							<span className="truncate font-medium text-xs">
								{tournament.name}
							</span>
							<Badge className="px-1 py-0 text-[10px]" variant="secondary">
								{tournament.variant.toUpperCase()}
							</Badge>
							{tournament.tableSize != null && (
								<Badge
									className={`px-1 py-0 text-[10px] ${getTableSizeClassName(tournament.tableSize)}`}
								>
									{tournament.tableSize}-max
								</Badge>
							)}
							{tournament.tags.map((tag) => (
								<Badge
									className="px-1 py-0 text-[10px]"
									key={tag.id}
									variant="outline"
								>
									{tag.name}
								</Badge>
							))}
							{buyInStr && (
								<span className="text-[11px] text-muted-foreground">
									{buyInStr}
								</span>
							)}
						</div>
					</div>
				}
				value={tournament.id}
			>
				<TournamentDetail
					confirmingDelete={confirmingDelete}
					isArchived={isArchived}
					onArchive={onArchive}
					onBlindEdit={() => setBlindEditorOpen(true)}
					onDelete={onDelete}
					onEdit={onEdit}
					onRestore={onRestore}
					setConfirmingDelete={setConfirmingDelete}
					tournament={tournament}
				/>
			</ExpandableItem>
			<BlindLevelEditor
				onOpenChange={setBlindEditorOpen}
				open={blindEditorOpen}
				tournamentId={tournament.id}
				variant={tournament.variant}
			/>
		</>
	);
}

interface TournamentDetailProps {
	confirmingDelete: boolean;
	isArchived: boolean;
	onArchive: (id: string) => void;
	onBlindEdit: () => void;
	onDelete: (id: string) => void;
	onEdit: (tournament: Tournament) => void;
	onRestore: (id: string) => void;
	setConfirmingDelete: (v: boolean) => void;
	tournament: Tournament;
}

function TournamentDetail({
	tournament,
	isArchived,
	confirmingDelete,
	setConfirmingDelete,
	onArchive,
	onBlindEdit,
	onDelete,
	onEdit,
	onRestore,
}: TournamentDetailProps) {
	const fmt = createGroupFormatter([tournament.bountyAmount]);

	const details: string[] = [];
	if (tournament.startingStack != null) {
		details.push(`Stack: ${formatCompactNumber(tournament.startingStack)}`);
	}
	for (const cp of tournament.chipPurchases) {
		details.push(`${cp.name}: ${cp.cost}`);
	}
	if (tournament.bountyAmount != null) {
		details.push(`Bounty: ${fmt(tournament.bountyAmount)}`);
	}

	return (
		<div className="pb-2 pl-2">
			{details.length > 0 && (
				<p className="text-[11px] text-muted-foreground">
					{details.join(" / ")}
				</p>
			)}

			{tournament.memo && (
				<p className="whitespace-pre-wrap text-[11px] text-muted-foreground">
					{tournament.memo}
				</p>
			)}

			{tournament.blindLevelCount > 0 && (
				<div className="mt-1">
					<BlindStructureSummary tournamentId={tournament.id} />
					<Button
						className="mt-1 gap-1 text-[10px]"
						onClick={onBlindEdit}
						size="xs"
						variant="outline"
					>
						<IconList size={12} />
						Edit Structure
					</Button>
				</div>
			)}

			<TournamentActions
				confirmingDelete={confirmingDelete}
				isArchived={isArchived}
				onArchive={onArchive}
				onDelete={onDelete}
				onEdit={onEdit}
				onRestore={onRestore}
				setConfirmingDelete={setConfirmingDelete}
				tournament={tournament}
			/>
		</div>
	);
}

interface TournamentActionsProps {
	confirmingDelete: boolean;
	isArchived: boolean;
	onArchive: (id: string) => void;
	onDelete: (id: string) => void;
	onEdit: (tournament: Tournament) => void;
	onRestore: (id: string) => void;
	setConfirmingDelete: (v: boolean) => void;
	tournament: Tournament;
}

function TournamentActions({
	tournament,
	isArchived,
	confirmingDelete,
	setConfirmingDelete,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
}: TournamentActionsProps) {
	if (confirmingDelete) {
		return (
			<div className="mt-1 flex items-center justify-end gap-1">
				<span className="text-[10px] text-destructive">Delete?</span>
				<Button
					aria-label="Confirm delete"
					className="text-destructive hover:text-destructive"
					onClick={() => {
						onDelete(tournament.id);
						setConfirmingDelete(false);
					}}
					size="icon-xs"
					variant="ghost"
				>
					<IconTrash size={12} />
				</Button>
				<Button
					aria-label="Cancel delete"
					onClick={() => setConfirmingDelete(false)}
					size="icon-xs"
					variant="ghost"
				>
					<IconX size={12} />
				</Button>
			</div>
		);
	}

	return (
		<div className="mt-1 flex items-center justify-end gap-1">
			<Button
				aria-label="Edit tournament"
				onClick={() => onEdit(tournament)}
				size="icon-xs"
				variant="ghost"
			>
				<IconEdit size={12} />
			</Button>
			{isArchived ? (
				<Button
					aria-label="Restore tournament"
					onClick={() => onRestore(tournament.id)}
					size="icon-xs"
					variant="ghost"
				>
					<IconArchiveOff size={12} />
				</Button>
			) : (
				<Button
					aria-label="Archive tournament"
					onClick={() => onArchive(tournament.id)}
					size="icon-xs"
					variant="ghost"
				>
					<IconArchive size={12} />
				</Button>
			)}
			<Button
				aria-label="Delete tournament"
				onClick={() => setConfirmingDelete(true)}
				size="icon-xs"
				variant="ghost"
			>
				<IconTrash size={12} />
			</Button>
		</div>
	);
}

function BlindStructureSummary({ tournamentId }: { tournamentId: string }) {
	const levelsQuery = useQuery(
		trpc.blindLevel.listByTournament.queryOptions({ tournamentId })
	);
	const levels = (levelsQuery.data ?? []) as BlindLevelRow[];

	if (levelsQuery.isLoading) {
		return (
			<p className="py-1 text-center text-muted-foreground text-xs">
				Loading levels...
			</p>
		);
	}

	if (levels.length === 0) {
		return (
			<p className="py-1 text-center text-muted-foreground text-xs">
				No blind levels yet.
			</p>
		);
	}

	return (
		<div className="w-full overflow-x-auto">
			<table className="w-full table-fixed border-collapse text-[10px]">
				<thead>
					<tr>
						<th className="w-6 pb-0.5 text-center font-medium text-muted-foreground">
							#
						</th>
						<th className="pb-0.5 text-center font-medium text-muted-foreground">
							SB
						</th>
						<th className="pb-0.5 text-center font-medium text-muted-foreground">
							BB
						</th>
						<th className="pb-0.5 text-center font-medium text-muted-foreground">
							Ante
						</th>
						<th className="w-8 pb-0.5 text-center font-medium text-muted-foreground">
							Min
						</th>
					</tr>
				</thead>
				<tbody>
					{levels.map((row) => {
						if (row.isBreak) {
							return (
								<tr className="bg-muted/30" key={row.id}>
									<td className="py-0.5 text-center text-muted-foreground">
										{row.level}
									</td>
									<td
										className="py-0.5 text-center text-muted-foreground"
										colSpan={3}
									>
										Break
									</td>
									<td className="py-0.5 text-center text-muted-foreground">
										{row.minutes ?? "—"}
									</td>
								</tr>
							);
						}
						const fmt = createGroupFormatter([
							row.blind1,
							row.blind2,
							row.ante,
						]);
						return (
							<tr key={row.id}>
								<td className="py-0.5 text-center text-muted-foreground">
									{row.level}
								</td>
								<td className="py-0.5 text-center">
									{row.blind1 != null ? fmt(row.blind1) : "—"}
								</td>
								<td className="py-0.5 text-center">
									{row.blind2 != null ? fmt(row.blind2) : "—"}
								</td>
								<td className="py-0.5 text-center">
									{row.ante != null ? fmt(row.ante) : "—"}
								</td>
								<td className="py-0.5 text-center text-muted-foreground">
									{row.minutes ?? "—"}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

export function TournamentTab({
	storeId,
	expandedGameId,
	onToggleGame,
}: TournamentTabProps) {
	const [showArchived, setShowArchived] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingTournament, setEditingTournament] = useState<Tournament | null>(
		null
	);

	const queryClient = useQueryClient();

	const activeQueryOptions = trpc.tournament.listByStore.queryOptions({
		storeId,
		includeArchived: false,
	});
	const archivedQueryOptions = trpc.tournament.listByStore.queryOptions({
		storeId,
		includeArchived: true,
	});

	const activeQuery = useQuery(activeQueryOptions);
	const activeTournaments = (activeQuery.data ?? []) as Tournament[];

	const archivedQuery = useQuery({
		...archivedQueryOptions,
		enabled: showArchived,
	});
	const archivedTournaments = (archivedQuery.data ?? []) as Tournament[];

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

	const invalidateBoth = () => {
		invalidateTargets(queryClient, [
			{ queryKey: activeQueryOptions.queryKey },
			{ queryKey: archivedQueryOptions.queryKey },
		]);
	};

	const syncChipPurchases = async (
		tournamentId: string,
		chipPurchases: ChipPurchaseFormItem[],
		existingIds: string[]
	) => {
		await Promise.all(
			existingIds.map((id) =>
				trpcClient.tournamentChipPurchase.delete.mutate({ id })
			)
		);
		await Promise.all(
			chipPurchases.map((cp) =>
				trpcClient.tournamentChipPurchase.create.mutate({
					tournamentId,
					name: cp.name,
					cost: cp.cost,
					chips: cp.chips,
				})
			)
		);
	};

	const createMutation = useMutation({
		mutationFn: async (values: TournamentFormValues) => {
			const { tags, chipPurchases, ...rest } = values;
			const created = await trpcClient.tournament.create.mutate({
				storeId,
				...rest,
			});
			if (tags && tags.length > 0) {
				await syncTags(created.id, tags, []);
			}
			if (chipPurchases.length > 0) {
				await syncChipPurchases(created.id, chipPurchases, []);
			}
			return created;
		},
		onMutate: async (values) => {
			await cancelTargets(queryClient, [
				{ queryKey: activeQueryOptions.queryKey },
				{ queryKey: archivedQueryOptions.queryKey },
			]);
			const previousActive = snapshotQuery(
				queryClient,
				activeQueryOptions.queryKey
			);
			const previousArchived = snapshotQuery(
				queryClient,
				archivedQueryOptions.queryKey
			);
			queryClient.setQueryData<Tournament[]>(
				activeQueryOptions.queryKey,
				(old) => [
					...(old ?? []),
					buildOptimisticTournament(
						storeId,
						values,
						`temp-tournament-${Date.now()}`
					),
				]
			);
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousActive,
				context?.previousArchived,
			]);
		},
		onSettled: invalidateBoth,
		onSuccess: () => {
			setIsCreateOpen(false);
		},
	});

	const updateMutation = useMutation({
		mutationFn: async (
			values: TournamentFormValues & {
				existingChipPurchaseIds: string[];
				existingTags: { id: string; name: string }[];
				id: string;
			}
		) => {
			const {
				tags,
				existingTags,
				chipPurchases,
				existingChipPurchaseIds,
				...rest
			} = values;
			const updated = await trpcClient.tournament.update.mutate(rest);
			if (tags !== undefined) {
				await syncTags(values.id, tags, existingTags);
			}
			await syncChipPurchases(
				values.id,
				chipPurchases,
				existingChipPurchaseIds
			);
			return updated;
		},
		onMutate: async (values) => {
			await cancelTargets(queryClient, [
				{ queryKey: activeQueryOptions.queryKey },
				{ queryKey: archivedQueryOptions.queryKey },
			]);
			const previousActive = snapshotQuery(
				queryClient,
				activeQueryOptions.queryKey
			);
			const previousArchived = snapshotQuery(
				queryClient,
				archivedQueryOptions.queryKey
			);
			const applyUpdate = (old: Tournament[] | undefined) =>
				old?.map((tournament) =>
					tournament.id === values.id
						? buildOptimisticTournament(storeId, values, values.id, tournament)
						: tournament
				) ?? [];
			queryClient.setQueryData(activeQueryOptions.queryKey, applyUpdate);
			queryClient.setQueryData(archivedQueryOptions.queryKey, applyUpdate);
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousActive,
				context?.previousArchived,
			]);
		},
		onSettled: invalidateBoth,
		onSuccess: () => {
			setEditingTournament(null);
		},
	});

	const archiveMutation = useMutation({
		mutationFn: (id: string) => trpcClient.tournament.archive.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [
				{ queryKey: activeQueryOptions.queryKey },
				{ queryKey: archivedQueryOptions.queryKey },
			]);
			const previousActive = snapshotQuery(
				queryClient,
				activeQueryOptions.queryKey
			);
			const previousArchived = snapshotQuery(
				queryClient,
				archivedQueryOptions.queryKey
			);
			const archivedTournament = (
				previousActive.data as Tournament[] | undefined
			)?.find((tournament) => tournament.id === id);
			queryClient.setQueryData<Tournament[]>(
				activeQueryOptions.queryKey,
				(old) => old?.filter((tournament) => tournament.id !== id) ?? []
			);
			if (archivedTournament) {
				queryClient.setQueryData<Tournament[]>(
					archivedQueryOptions.queryKey,
					(old) => [
						...(old ?? []),
						{ ...archivedTournament, archivedAt: new Date().toISOString() },
					]
				);
			}
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousActive,
				context?.previousArchived,
			]);
		},
		onSettled: invalidateBoth,
	});

	const restoreMutation = useMutation({
		mutationFn: (id: string) => trpcClient.tournament.restore.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [
				{ queryKey: activeQueryOptions.queryKey },
				{ queryKey: archivedQueryOptions.queryKey },
			]);
			const previousActive = snapshotQuery(
				queryClient,
				activeQueryOptions.queryKey
			);
			const previousArchived = snapshotQuery(
				queryClient,
				archivedQueryOptions.queryKey
			);
			const restoredTournament = (
				previousArchived.data as Tournament[] | undefined
			)?.find((tournament) => tournament.id === id);
			queryClient.setQueryData<Tournament[]>(
				archivedQueryOptions.queryKey,
				(old) => old?.filter((tournament) => tournament.id !== id) ?? []
			);
			if (restoredTournament) {
				queryClient.setQueryData<Tournament[]>(
					activeQueryOptions.queryKey,
					(old) => [...(old ?? []), { ...restoredTournament, archivedAt: null }]
				);
			}
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousActive,
				context?.previousArchived,
			]);
		},
		onSettled: invalidateBoth,
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.tournament.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [
				{ queryKey: activeQueryOptions.queryKey },
				{ queryKey: archivedQueryOptions.queryKey },
			]);
			const previousActive = snapshotQuery(
				queryClient,
				activeQueryOptions.queryKey
			);
			const previousArchived = snapshotQuery(
				queryClient,
				archivedQueryOptions.queryKey
			);
			queryClient.setQueryData<Tournament[]>(
				activeQueryOptions.queryKey,
				(old) => old?.filter((tournament) => tournament.id !== id) ?? []
			);
			queryClient.setQueryData<Tournament[]>(
				archivedQueryOptions.queryKey,
				(old) => old?.filter((tournament) => tournament.id !== id) ?? []
			);
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousActive,
				context?.previousArchived,
			]);
		},
		onSettled: invalidateBoth,
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
			existingChipPurchaseIds: editingTournament.chipPurchases.map(
				(cp) => cp.id
			),
			...values,
		});
	};

	return (
		<div>
			<ManagementSectionHeader
				action={
					<Button
						onClick={() => setIsCreateOpen(true)}
						size="icon-xs"
						variant="ghost"
					>
						<IconPlus size={12} />
					</Button>
				}
				controls={
					<Button
						aria-label={
							showArchived
								? "Hide archived tournaments"
								: "Show archived tournaments"
						}
						onClick={() => setShowArchived((prev) => !prev)}
						size="icon-xs"
						variant="ghost"
					>
						{showArchived ? (
							<IconArchiveOff className="text-muted-foreground" size={12} />
						) : (
							<IconArchive className="text-muted-foreground" size={12} />
						)}
					</Button>
				}
				heading="Tournaments"
			/>

			<TournamentContent
				activeTournaments={activeTournaments}
				archivedLoading={archivedQuery.isLoading}
				archivedTournaments={archivedTournaments}
				expandedGameId={expandedGameId}
				isLoading={activeQuery.isLoading}
				onArchive={(id) => archiveMutation.mutate(id)}
				onDelete={(id) => deleteMutation.mutate(id)}
				onEdit={setEditingTournament}
				onRestore={(id) => restoreMutation.mutate(id)}
				onToggleGame={onToggleGame}
				showArchived={showArchived}
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
							chipPurchases: editingTournament.chipPurchases.map((cp) => ({
								uid: cp.id,
								name: cp.name,
								cost: cp.cost,
								chips: cp.chips,
							})),
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

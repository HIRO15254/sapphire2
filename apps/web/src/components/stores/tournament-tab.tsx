import {
	IconArchive,
	IconArchiveOff,
	IconChevronDown,
	IconChevronUp,
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
import {
	createGroupFormatter,
	formatCompactNumber,
} from "@/utils/format-number";
import { getTableSizeClassName } from "@/utils/table-size-colors";
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

interface TournamentActionHandlers {
	onArchive: (id: string) => void;
	onDelete: (id: string) => void;
	onEdit: (tournament: Tournament) => void;
	onRestore: (id: string) => void;
	onToggleExpand: (id: string) => void;
	onView: (tournament: Tournament) => void;
}

interface TournamentListProps extends TournamentActionHandlers {
	expandedId: string | null;
	isArchived: boolean;
	tournaments: Tournament[];
}

function TournamentList({
	tournaments,
	expandedId,
	isArchived,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
	onToggleExpand,
	onView,
}: TournamentListProps) {
	if (tournaments.length === 0) {
		return null;
	}

	return (
		<div className="divide-y">
			{tournaments.map((t) => (
				<TournamentRow
					expandedId={expandedId}
					isArchived={isArchived}
					key={t.id}
					onArchive={onArchive}
					onDelete={onDelete}
					onEdit={onEdit}
					onRestore={onRestore}
					onToggleExpand={onToggleExpand}
					onView={onView}
					tournament={t}
				/>
			))}
		</div>
	);
}

interface ArchivedTournamentSectionProps extends TournamentActionHandlers {
	expandedId: string | null;
	isLoading: boolean;
	tournaments: Tournament[];
}

function ArchivedTournamentSection({
	tournaments,
	expandedId,
	isLoading,
	...handlers
}: ArchivedTournamentSectionProps) {
	if (isLoading) {
		return (
			<p className="py-1 text-center text-[11px] text-muted-foreground">
				Loading archived...
			</p>
		);
	}

	if (tournaments.length === 0) {
		return (
			<p className="py-1 text-center text-[11px] text-muted-foreground">
				No archived tournaments.
			</p>
		);
	}

	return (
		<div className="mt-1 border-t border-dashed pt-1">
			<TournamentList
				expandedId={expandedId}
				isArchived
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
	expandedId: string | null;
	isLoading: boolean;
	showArchived: boolean;
}

function TournamentContent({
	activeTournaments,
	archivedLoading,
	archivedTournaments,
	expandedId,
	isLoading,
	showArchived,
	...handlers
}: TournamentContentProps) {
	if (isLoading) {
		return (
			<p className="py-2 text-center text-muted-foreground text-xs">
				Loading...
			</p>
		);
	}

	return (
		<>
			{activeTournaments.length === 0 && !showArchived && (
				<p className="py-1 text-center text-[11px] text-muted-foreground">
					No tournaments yet.
				</p>
			)}
			<TournamentList
				expandedId={expandedId}
				isArchived={false}
				tournaments={activeTournaments}
				{...handlers}
			/>
			{showArchived && (
				<ArchivedTournamentSection
					expandedId={expandedId}
					isLoading={archivedLoading}
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
	expandedId: string | null;
	isArchived: boolean;
	onArchive: (id: string) => void;
	onDelete: (id: string) => void;
	onEdit: (tournament: Tournament) => void;
	onRestore: (id: string) => void;
	onToggleExpand: (id: string) => void;
	onView: (tournament: Tournament) => void;
	tournament: Tournament;
}

function TournamentRow({
	tournament,
	expandedId,
	isArchived,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
	onToggleExpand,
	onView,
}: TournamentRowProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [blindEditorOpen, setBlindEditorOpen] = useState(false);
	const buyInStr = formatBuyInShort(tournament);
	const isExpanded = expandedId === tournament.id;

	return (
		<div>
			<div className="flex items-center gap-1.5 py-1">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-1">
						<button
							className="truncate font-medium text-xs hover:underline"
							onClick={() => onView(tournament)}
							type="button"
						>
							{tournament.name}
						</button>
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

				<div className="flex shrink-0 items-center">
					{confirmingDelete ? (
						<>
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
						</>
					) : (
						<>
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
							{tournament.blindLevelCount > 0 && (
								<Button
									aria-label={
										isExpanded ? "Collapse details" : "Expand details"
									}
									onClick={() => onToggleExpand(tournament.id)}
									size="icon-xs"
									variant="ghost"
								>
									{isExpanded ? (
										<IconChevronUp size={12} />
									) : (
										<IconChevronDown size={12} />
									)}
								</Button>
							)}
						</>
					)}
				</div>
			</div>

			{isExpanded && (
				<div className="pb-2 pl-2">
					<BlindStructureSummary tournamentId={tournament.id} />
					<Button
						className="mt-1 gap-1 text-[10px]"
						onClick={() => setBlindEditorOpen(true)}
						size="xs"
						variant="outline"
					>
						<IconList size={12} />
						Edit Structure
					</Button>
				</div>
			)}

			<BlindLevelEditor
				onOpenChange={setBlindEditorOpen}
				open={blindEditorOpen}
				tournamentId={tournament.id}
				variant={tournament.variant}
			/>
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

function TournamentDetail({ tournament }: { tournament: Tournament }) {
	const buyInStr = formatBuyInShort(tournament);
	const fmt = createGroupFormatter([
		tournament.rebuyCost,
		tournament.rebuyChips,
		tournament.addonCost,
		tournament.addonChips,
		tournament.bountyAmount,
	]);

	return (
		<div className="space-y-3 text-sm">
			<div className="flex flex-wrap gap-1.5">
				<Badge variant="secondary">{tournament.variant.toUpperCase()}</Badge>
				{tournament.tableSize != null && (
					<Badge className={getTableSizeClassName(tournament.tableSize)}>
						{tournament.tableSize}-max
					</Badge>
				)}
				{tournament.tags.map((tag) => (
					<Badge key={tag.id} variant="outline">
						{tag.name}
					</Badge>
				))}
			</div>

			{buyInStr && (
				<div>
					<p className="text-muted-foreground text-xs">Buy-in</p>
					<p>{buyInStr}</p>
				</div>
			)}

			{tournament.startingStack != null && (
				<div>
					<p className="text-muted-foreground text-xs">Starting Stack</p>
					<p>{formatCompactNumber(tournament.startingStack)}</p>
				</div>
			)}

			{tournament.rebuyAllowed && (
				<div>
					<p className="text-muted-foreground text-xs">Rebuy</p>
					<p>
						{tournament.rebuyCost != null
							? `${fmt(tournament.rebuyCost)} → ${tournament.rebuyChips != null ? fmt(tournament.rebuyChips) : "—"} chips`
							: "Allowed"}
					</p>
				</div>
			)}

			{tournament.addonAllowed && (
				<div>
					<p className="text-muted-foreground text-xs">Add-on</p>
					<p>
						{tournament.addonCost != null
							? `${fmt(tournament.addonCost)} → ${tournament.addonChips != null ? fmt(tournament.addonChips) : "—"} chips`
							: "Allowed"}
					</p>
				</div>
			)}

			{tournament.bountyAmount != null && (
				<div>
					<p className="text-muted-foreground text-xs">Bounty</p>
					<p>{fmt(tournament.bountyAmount)}</p>
				</div>
			)}

			{tournament.blindLevelCount > 0 && (
				<div>
					<p className="mb-1 text-muted-foreground text-xs">
						Blind Structure ({tournament.blindLevelCount} levels)
					</p>
					<BlindStructureSummary tournamentId={tournament.id} />
				</div>
			)}

			{tournament.memo && (
				<div>
					<p className="text-muted-foreground text-xs">Memo</p>
					<p className="whitespace-pre-wrap">{tournament.memo}</p>
				</div>
			)}
		</div>
	);
}

export function TournamentTab({ storeId }: TournamentTabProps) {
	const [showArchived, setShowArchived] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingTournament, setEditingTournament] = useState<Tournament | null>(
		null
	);
	const [viewingTournament, setViewingTournament] = useState<Tournament | null>(
		null
	);
	const [expandedId, setExpandedId] = useState<string | null>(null);

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
		queryClient.invalidateQueries({ queryKey: activeQueryOptions.queryKey });
		queryClient.invalidateQueries({
			queryKey: archivedQueryOptions.queryKey,
		});
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
		onSettled: invalidateBoth,
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
		onSettled: invalidateBoth,
		onSuccess: () => {
			setEditingTournament(null);
		},
	});

	const archiveMutation = useMutation({
		mutationFn: (id: string) => trpcClient.tournament.archive.mutate({ id }),
		onSettled: invalidateBoth,
	});

	const restoreMutation = useMutation({
		mutationFn: (id: string) => trpcClient.tournament.restore.mutate({ id }),
		onSettled: invalidateBoth,
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.tournament.delete.mutate({ id }),
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
			...values,
		});
	};

	const handleToggleExpand = (id: string) => {
		setExpandedId((prev) => (prev === id ? null : id));
	};

	return (
		<div>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1">
					<span className="font-medium text-muted-foreground text-xs">
						Tournaments
					</span>
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
				</div>
				<Button
					onClick={() => setIsCreateOpen(true)}
					size="icon-xs"
					variant="ghost"
				>
					<IconPlus size={12} />
				</Button>
			</div>

			<TournamentContent
				activeTournaments={activeTournaments}
				archivedLoading={archivedQuery.isLoading}
				archivedTournaments={archivedTournaments}
				expandedId={expandedId}
				isLoading={activeQuery.isLoading}
				onArchive={(id) => archiveMutation.mutate(id)}
				onDelete={(id) => deleteMutation.mutate(id)}
				onEdit={setEditingTournament}
				onRestore={(id) => restoreMutation.mutate(id)}
				onToggleExpand={handleToggleExpand}
				onView={setViewingTournament}
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

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setViewingTournament(null);
					}
				}}
				open={viewingTournament !== null}
				title={viewingTournament?.name ?? "Tournament"}
			>
				{viewingTournament && (
					<TournamentDetail tournament={viewingTournament} />
				)}
			</ResponsiveDialog>
		</div>
	);
}

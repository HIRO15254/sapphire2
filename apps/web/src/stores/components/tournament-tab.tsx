import type { ExtractedTournamentData } from "@sapphire2/api/routers/ai-extract";
import {
	IconArchive,
	IconArchiveOff,
	IconEdit,
	IconPlus,
	IconSparkles,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
	ExpandableItem,
	ExpandableItemList,
} from "@/shared/components/management/expandable-item-list";
import { ManagementSectionHeader } from "@/shared/components/management/management-section-header";
import { ManagementSectionState } from "@/shared/components/management/management-section-state";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import { AiExtractInput } from "@/stores/components/ai-extract-input";
import { LocalBlindStructureContent } from "@/stores/components/blind-level-editor";
import { TournamentForm } from "@/stores/components/tournament-form";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";
import type {
	Tournament,
	TournamentFormValues,
} from "@/stores/hooks/use-tournaments";
import { useTournaments } from "@/stores/hooks/use-tournaments";
import {
	createGroupFormatter,
	formatCompactNumber,
} from "@/utils/format-number";
import { getTableSizeClassName } from "@/utils/table-size-colors";
import { trpc, trpcClient } from "@/utils/trpc";

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
	currencies: { id: string; name: string; unit?: string | null }[];
	expandedGameId: string | null;
	isArchived: boolean;
	onToggleGame: (id: string | null) => void;
	tournaments: Tournament[];
}

function TournamentList({
	tournaments,
	currencies,
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
					currencies={currencies}
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
	currencies: { id: string; name: string; unit?: string | null }[];
	expandedGameId: string | null;
	isLoading: boolean;
	onToggleGame: (id: string | null) => void;
	tournaments: Tournament[];
}

function ArchivedTournamentSection({
	tournaments,
	currencies,
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
				currencies={currencies}
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
	currencies: { id: string; name: string; unit?: string | null }[];
	expandedGameId: string | null;
	isLoading: boolean;
	onToggleGame: (id: string | null) => void;
	showArchived: boolean;
}

function TournamentContent({
	activeTournaments,
	archivedLoading,
	archivedTournaments,
	currencies,
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
				currencies={currencies}
				expandedGameId={expandedGameId}
				isArchived={false}
				onToggleGame={onToggleGame}
				tournaments={activeTournaments}
				{...handlers}
			/>
			{showArchived && (
				<ArchivedTournamentSection
					currencies={currencies}
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

function formatBuyInShort(
	t: Tournament,
	currencyUnit: string | null | undefined
): string {
	if (t.buyIn == null) {
		return "";
	}
	const fmt = createGroupFormatter([t.buyIn, t.entryFee]);
	const unitStr = currencyUnit ? ` ${currencyUnit}` : "";
	if (t.entryFee != null) {
		return `${fmt(t.buyIn)}+${fmt(t.entryFee)}${unitStr}`;
	}
	return `${fmt(t.buyIn)}${unitStr}`;
}

interface TournamentRowProps {
	currencies: { id: string; name: string; unit?: string | null }[];
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
	currencies,
	expanded,
	isArchived,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
}: TournamentRowProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const currency = currencies.find((c) => c.id === tournament.currencyId);
	const buyInStr = formatBuyInShort(tournament, currency?.unit);

	useEffect(() => {
		if (!expanded) {
			setConfirmingDelete(false);
		}
	}, [expanded]);

	return (
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
				onDelete={onDelete}
				onEdit={onEdit}
				onRestore={onRestore}
				setConfirmingDelete={setConfirmingDelete}
				tournament={tournament}
			/>
		</ExpandableItem>
	);
}

interface TournamentDetailProps {
	confirmingDelete: boolean;
	isArchived: boolean;
	onArchive: (id: string) => void;
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
					type="button"
					variant="ghost"
				>
					<IconTrash size={12} />
				</Button>
				<Button
					aria-label="Cancel delete"
					onClick={() => setConfirmingDelete(false)}
					size="icon-xs"
					type="button"
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
				type="button"
				variant="ghost"
			>
				<IconEdit size={12} />
			</Button>
			{isArchived ? (
				<Button
					aria-label="Restore tournament"
					onClick={() => onRestore(tournament.id)}
					size="icon-xs"
					type="button"
					variant="ghost"
				>
					<IconArchiveOff size={12} />
				</Button>
			) : (
				<Button
					aria-label="Archive tournament"
					onClick={() => onArchive(tournament.id)}
					size="icon-xs"
					type="button"
					variant="ghost"
				>
					<IconArchive size={12} />
				</Button>
			)}
			<Button
				aria-label="Delete tournament"
				onClick={() => setConfirmingDelete(true)}
				size="icon-xs"
				type="button"
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
									{row.blind1 == null ? "—" : fmt(row.blind1)}
								</td>
								<td className="py-0.5 text-center">
									{row.blind2 == null ? "—" : fmt(row.blind2)}
								</td>
								<td className="py-0.5 text-center">
									{row.ante == null ? "—" : fmt(row.ante)}
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

// ---- Shared modal content (used by both create and edit dialogs) ----

type PartialFormValues = Omit<
	TournamentFormValues,
	"tags" | "chipPurchases"
> & {
	chipPurchases?: Array<{ name: string; cost: number; chips: number }>;
	tags?: string[];
};

interface TournamentModalContentProps {
	initialBlindLevels: BlindLevelRow[];
	initialFormValues?: PartialFormValues;
	isLoading: boolean;
	onSave: (
		values: TournamentFormValues,
		levels: BlindLevelRow[]
	) => void | Promise<void>;
}

function TournamentModalContent({
	initialBlindLevels,
	initialFormValues,
	isLoading,
	onSave,
}: TournamentModalContentProps) {
	const [localBlindLevels, setLocalBlindLevels] =
		useState<BlindLevelRow[]>(initialBlindLevels);

	return (
		<Tabs defaultValue="details">
			<TabsList className="w-full">
				<TabsTrigger value="details">Details</TabsTrigger>
				<TabsTrigger value="structure">Structure</TabsTrigger>
			</TabsList>
			<TabsContent value="details">
				<TournamentForm
					defaultValues={initialFormValues}
					isLoading={isLoading}
					onSubmit={(values) => onSave(values, localBlindLevels)}
				/>
			</TabsContent>
			<TabsContent value="structure">
				<LocalBlindStructureContent
					onChange={setLocalBlindLevels}
					value={localBlindLevels}
					variant={initialFormValues?.variant ?? "nlh"}
				/>
			</TabsContent>
		</Tabs>
	);
}

// ---- Main tab component ----

export function TournamentTab({
	storeId,
	expandedGameId,
	onToggleGame,
}: TournamentTabProps) {
	const queryClient = useQueryClient();
	const [showArchived, setShowArchived] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingTournament, setEditingTournament] = useState<Tournament | null>(
		null
	);

	// AI state (shared — only one modal is open at a time)
	const [aiSheetOpen, setAiSheetOpen] = useState(false);
	const [aiInitialFormValues, setAiInitialFormValues] = useState<
		PartialFormValues | undefined
	>();
	const [aiInitialLevels, setAiInitialLevels] = useState<BlindLevelRow[]>([]);

	// Keys to force-remount TournamentModalContent when AI data arrives
	const [createKey, setCreateKey] = useState(0);
	const [editKey, setEditKey] = useState(0);

	// Loading states for the combined mutations
	const [isCreateLoading, setIsCreateLoading] = useState(false);
	const [isUpdateLoading, setIsUpdateLoading] = useState(false);

	const {
		activeTournaments,
		archivedTournaments,
		currencies,
		activeLoading,
		archivedLoading,
		archive,
		restore,
		delete: deleteTournament,
	} = useTournaments({ storeId, showArchived });

	// Fetch blind levels for the tournament being edited
	const editBlindLevelsQuery = useQuery({
		...trpc.blindLevel.listByTournament.queryOptions({
			tournamentId: editingTournament?.id ?? "",
		}),
		enabled: editingTournament !== null,
	});

	const resetAiState = () => {
		setAiInitialFormValues(undefined);
		setAiInitialLevels([]);
	};

	const toBlindLevelRows = (data: ExtractedTournamentData): BlindLevelRow[] =>
		(data.blindLevels ?? []).map((l, i) => ({
			id: crypto.randomUUID(),
			tournamentId: "",
			level: i + 1,
			isBreak: l.isBreak,
			blind1: l.blind1 ?? null,
			blind2: l.blind2 ?? null,
			blind3: l.blind3 ?? null,
			ante: l.ante ?? null,
			minutes: l.minutes ?? null,
		}));

	const mergeAiIntoEditFormValues = (
		data: ExtractedTournamentData,
		base: PartialFormValues | undefined
	): PartialFormValues => ({
		...base,
		// Use || so that empty strings fall back to the existing value
		name: data.name || base?.name || "",
		variant: base?.variant ?? "nlh",
		...(data.buyIn !== undefined && { buyIn: data.buyIn }),
		...(data.entryFee !== undefined && { entryFee: data.entryFee }),
		...(data.startingStack !== undefined && {
			startingStack: data.startingStack,
		}),
		...(data.tableSize !== undefined && { tableSize: data.tableSize }),
		// Only override chip purchases if AI actually extracted some entries
		...(data.chipPurchases?.length && { chipPurchases: data.chipPurchases }),
	});

	const handleAiExtracted = (data: ExtractedTournamentData) => {
		const extractedLevels = toBlindLevelRows(data);
		if (isCreateOpen) {
			setAiInitialFormValues({
				name: data.name ?? "",
				buyIn: data.buyIn,
				entryFee: data.entryFee,
				startingStack: data.startingStack,
				tableSize: data.tableSize,
				chipPurchases: data.chipPurchases ?? [],
				variant: "nlh",
			});
			setAiInitialLevels(extractedLevels);
			setCreateKey((k) => k + 1);
		} else {
			setAiInitialFormValues(mergeAiIntoEditFormValues(data, editFormValues));
			setAiInitialLevels(
				extractedLevels.length > 0
					? extractedLevels
					: ((editBlindLevelsQuery.data ?? []) as BlindLevelRow[])
			);
			setEditKey((k) => k + 1);
		}
		setAiSheetOpen(false);
	};

	const invalidateTournamentLists = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: trpc.tournament.listByStore.queryOptions({
					storeId,
					includeArchived: false,
				}).queryKey,
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.tournament.listByStore.queryOptions({
					storeId,
					includeArchived: true,
				}).queryKey,
			}),
		]);
	};

	const handleCreate = async (
		values: TournamentFormValues,
		levels: BlindLevelRow[]
	) => {
		setIsCreateLoading(true);
		try {
			await trpcClient.tournament.createWithLevels.mutate({
				storeId,
				name: values.name,
				variant: values.variant,
				buyIn: values.buyIn,
				entryFee: values.entryFee,
				startingStack: values.startingStack,
				bountyAmount: values.bountyAmount,
				tableSize: values.tableSize,
				currencyId: values.currencyId,
				memo: values.memo,
				tags: values.tags,
				chipPurchases: values.chipPurchases,
				blindLevels: levels.map((l) => ({
					isBreak: l.isBreak,
					blind1: l.blind1,
					blind2: l.blind2,
					blind3: l.blind3,
					ante: l.ante,
					minutes: l.minutes,
				})),
			});
			await invalidateTournamentLists();
			setIsCreateOpen(false);
			resetAiState();
			setCreateKey(0);
		} finally {
			setIsCreateLoading(false);
		}
	};

	const handleUpdate = async (
		values: TournamentFormValues,
		levels: BlindLevelRow[]
	) => {
		if (!editingTournament) {
			return;
		}
		setIsUpdateLoading(true);
		try {
			await trpcClient.tournament.updateWithLevels.mutate({
				id: editingTournament.id,
				name: values.name,
				variant: values.variant,
				buyIn: values.buyIn ?? null,
				entryFee: values.entryFee ?? null,
				startingStack: values.startingStack ?? null,
				bountyAmount: values.bountyAmount ?? null,
				tableSize: values.tableSize ?? null,
				currencyId: values.currencyId ?? null,
				memo: values.memo ?? null,
				tags: values.tags,
				chipPurchases: values.chipPurchases,
				blindLevels: levels.map((l) => ({
					isBreak: l.isBreak,
					blind1: l.blind1,
					blind2: l.blind2,
					blind3: l.blind3,
					ante: l.ante,
					minutes: l.minutes,
				})),
			});
			await Promise.all([
				invalidateTournamentLists(),
				queryClient.invalidateQueries({
					queryKey: trpc.blindLevel.listByTournament.queryOptions({
						tournamentId: editingTournament.id,
					}).queryKey,
				}),
			]);
			setEditingTournament(null);
			resetAiState();
			setEditKey(0);
		} finally {
			setIsUpdateLoading(false);
		}
	};

	const aiButton = (
		<Button
			onClick={() => setAiSheetOpen(true)}
			size="xs"
			type="button"
			variant="outline"
		>
			<IconSparkles size={12} />
			AI自動入力
			<Badge className="px-1 py-0 text-[10px]" variant="secondary">
				beta
			</Badge>
		</Button>
	);

	// Edit modal initial values: AI overrides when editKey > 0
	const editFormValues: PartialFormValues | undefined = editingTournament
		? {
				name: editingTournament.name,
				variant: editingTournament.variant,
				buyIn: editingTournament.buyIn ?? undefined,
				entryFee: editingTournament.entryFee ?? undefined,
				startingStack: editingTournament.startingStack ?? undefined,
				chipPurchases: editingTournament.chipPurchases.map((cp) => ({
					name: cp.name,
					cost: cp.cost,
					chips: cp.chips,
				})),
				bountyAmount: editingTournament.bountyAmount ?? undefined,
				tableSize: editingTournament.tableSize ?? undefined,
				currencyId: editingTournament.currencyId ?? undefined,
				memo: editingTournament.memo ?? undefined,
				tags: editingTournament.tags.map((t) => t.name),
			}
		: undefined;

	const editInitialFormValues =
		editKey > 0 ? aiInitialFormValues : editFormValues;
	const editInitialLevels =
		editKey > 0
			? aiInitialLevels
			: ((editBlindLevelsQuery.data ?? []) as BlindLevelRow[]);

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
				archivedLoading={archivedLoading}
				archivedTournaments={archivedTournaments}
				currencies={currencies}
				expandedGameId={expandedGameId}
				isLoading={activeLoading}
				onArchive={archive}
				onDelete={deleteTournament}
				onEdit={setEditingTournament}
				onRestore={restore}
				onToggleGame={onToggleGame}
				showArchived={showArchived}
			/>

			{/* Shared AI extract sheet */}
			<ResponsiveDialog
				onOpenChange={setAiSheetOpen}
				open={aiSheetOpen}
				title="AI自動入力"
			>
				<AiExtractInput onExtracted={handleAiExtracted} />
			</ResponsiveDialog>

			{/* Create Tournament modal */}
			<ResponsiveDialog
				fullHeight
				headerAction={aiButton}
				onOpenChange={(open) => {
					setIsCreateOpen(open);
					if (!open) {
						resetAiState();
						setCreateKey(0);
					}
				}}
				open={isCreateOpen}
				title="Add Tournament"
			>
				<TournamentModalContent
					initialBlindLevels={createKey > 0 ? aiInitialLevels : []}
					initialFormValues={createKey > 0 ? aiInitialFormValues : undefined}
					isLoading={isCreateLoading}
					key={createKey}
					onSave={handleCreate}
				/>
			</ResponsiveDialog>

			{/* Edit Tournament modal */}
			<ResponsiveDialog
				fullHeight
				headerAction={aiButton}
				onOpenChange={(open) => {
					if (!open) {
						setEditingTournament(null);
						resetAiState();
						setEditKey(0);
					}
				}}
				open={editingTournament !== null}
				title="Edit Tournament"
			>
				{editingTournament &&
					(editBlindLevelsQuery.isLoading && editKey === 0 ? (
						<p className="py-8 text-center text-muted-foreground text-sm">
							Loading...
						</p>
					) : (
						<TournamentModalContent
							initialBlindLevels={editInitialLevels}
							initialFormValues={editInitialFormValues}
							isLoading={isUpdateLoading}
							key={`${editingTournament.id}-${editKey}`}
							onSave={handleUpdate}
						/>
					))}
			</ResponsiveDialog>
		</div>
	);
}

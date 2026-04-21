import {
	IconArchive,
	IconArchiveOff,
	IconEdit,
	IconPlus,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import {
	ExpandableItem,
	ExpandableItemList,
} from "@/shared/components/management/expandable-item-list";
import { ManagementSectionHeader } from "@/shared/components/management/management-section-header";
import { ManagementSectionState } from "@/shared/components/management/management-section-state";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { TournamentEditDialog } from "@/stores/components/tournament-edit-dialog";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";
import {
	useBlindStructureSummary,
	useTournamentTab,
} from "@/stores/hooks/use-tournament-tab";
import type { Tournament } from "@/stores/hooks/use-tournaments";
import {
	createGroupFormatter,
	formatCompactNumber,
} from "@/utils/format-number";
import { getTableSizeClassName } from "@/utils/table-size-colors";

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
	const { levels, isLoading } = useBlindStructureSummary(tournamentId);

	if (isLoading) {
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
					{levels.map((row: BlindLevelRow) => {
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

// ---- Main tab component ----

export function TournamentTab({
	storeId,
	expandedGameId,
	onToggleGame,
}: TournamentTabProps) {
	const {
		activeTournaments,
		archivedTournaments,
		currencies,
		activeLoading,
		archivedLoading,
		archive,
		restore,
		deleteTournament,
		showArchived,
		setShowArchived,
		isCreateOpen,
		setIsCreateOpen,
		editingTournament,
		setEditingTournament,
		isCreateLoading,
		isUpdateLoading,
		editBlindLevelsLoading,
		editInitialFormValues,
		editInitialLevels,
		handleCreate,
		handleUpdate,
	} = useTournamentTab({ storeId });

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

			<TournamentEditDialog
				aiMode="create"
				initialBlindLevels={[]}
				isLoading={isCreateLoading}
				onOpenChange={setIsCreateOpen}
				onSave={handleCreate}
				open={isCreateOpen}
				title="Add Tournament"
			/>

			<TournamentEditDialog
				aiMode="edit"
				initialBlindLevels={editInitialLevels}
				initialFormValues={editInitialFormValues}
				isInitializing={editBlindLevelsLoading}
				isLoading={isUpdateLoading}
				onOpenChange={(open) => {
					if (!open) {
						setEditingTournament(null);
					}
				}}
				onSave={handleUpdate}
				open={editingTournament !== null}
				resetKey={editingTournament?.id}
				title="Edit Tournament"
			/>
		</div>
	);
}

import {
	IconArchive,
	IconArchiveOff,
	IconDotsVertical,
	IconPlus,
} from "@tabler/icons-react";
import { DeleteGameDialog } from "@/features/stores/components/delete-game-dialog";
import { GameActionsDrawer } from "@/features/stores/components/game-actions-drawer";
import { TournamentFormSheet } from "@/features/stores/components/tournament-form-sheet";
import type { Tournament } from "@/features/stores/hooks/use-tournaments";
import { formatTournamentBuyIn } from "@/features/stores/utils/game-format";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { getTableSizeClassName } from "@/utils/table-size-colors";
import { useTournamentTab } from "./use-tournament-tab";

const CREATE_FORM_ID = "tournament-create-form";
const EDIT_FORM_ID = "tournament-edit-form";

interface CurrencyOption {
	id: string;
	name: string;
	unit?: string | null;
}

interface TournamentRowProps {
	currencies: CurrencyOption[];
	onOpenActions: (tournament: Tournament) => void;
	tournament: Tournament;
}

function TournamentRow({
	tournament,
	currencies,
	onOpenActions,
}: TournamentRowProps) {
	const currency = currencies.find((c) => c.id === tournament.currencyId);
	const buyIn = formatTournamentBuyIn(tournament, currency?.unit);
	const isArchived = tournament.archivedAt != null;
	const meta = [
		buyIn,
		tournament.blindLevelCount > 0
			? `${tournament.blindLevelCount} levels`
			: "",
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground",
				isArchived && "opacity-60"
			)}
		>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="truncate font-medium text-sm">
						{tournament.name}
					</span>
					<Badge variant="secondary">{tournament.variant.toUpperCase()}</Badge>
					{tournament.tableSize == null ? null : (
						<Badge className={getTableSizeClassName(tournament.tableSize)}>
							{tournament.tableSize}-max
						</Badge>
					)}
					{tournament.tags.map((tag) => (
						<Badge key={tag.id} variant="outline">
							{tag.name}
						</Badge>
					))}
					{isArchived ? <Badge variant="outline">Archived</Badge> : null}
				</div>
				{meta ? (
					<p className="mt-0.5 truncate text-muted-foreground text-xs">
						{meta}
					</p>
				) : null}
			</div>
			<Button
				aria-label={`Actions for ${tournament.name}`}
				onClick={() => onOpenActions(tournament)}
				size="icon-sm"
				variant="ghost"
			>
				<IconDotsVertical className="size-4" />
			</Button>
		</div>
	);
}

function TournamentListSkeleton() {
	return (
		<div aria-hidden className="flex flex-col gap-2">
			{Array.from({ length: 3 }, (_, i) => i).map((i) => (
				<div
					className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
					key={i}
				>
					<div className="min-w-0 flex-1 space-y-1.5">
						<Skeleton className="h-4 w-1/3" />
						<Skeleton className="h-3 w-1/2" />
					</div>
					<Skeleton className="size-8 shrink-0 rounded-md" />
				</div>
			))}
		</div>
	);
}

interface TournamentListProps {
	currencies: CurrencyOption[];
	onOpenActions: (tournament: Tournament) => void;
	tournaments: Tournament[];
}

function TournamentList({
	tournaments,
	currencies,
	onOpenActions,
}: TournamentListProps) {
	return (
		<div className="flex flex-col gap-2">
			{tournaments.map((tournament) => (
				<TournamentRow
					currencies={currencies}
					key={tournament.id}
					onOpenActions={onOpenActions}
					tournament={tournament}
				/>
			))}
		</div>
	);
}

interface ArchivedTournamentsProps {
	currencies: CurrencyOption[];
	isLoading: boolean;
	onOpenActions: (tournament: Tournament) => void;
	tournaments: Tournament[];
}

function ArchivedTournaments({
	tournaments,
	currencies,
	isLoading,
	onOpenActions,
}: ArchivedTournamentsProps) {
	if (isLoading) {
		return <TournamentListSkeleton />;
	}
	if (tournaments.length === 0) {
		return (
			<p className="py-2 text-center text-muted-foreground text-xs">
				No archived tournaments.
			</p>
		);
	}
	return (
		<TournamentList
			currencies={currencies}
			onOpenActions={onOpenActions}
			tournaments={tournaments}
		/>
	);
}

interface TournamentContentProps {
	activeLoading: boolean;
	activeTournaments: Tournament[];
	archivedLoading: boolean;
	archivedTournaments: Tournament[];
	currencies: CurrencyOption[];
	onOpenActions: (tournament: Tournament) => void;
	showArchived: boolean;
}

function TournamentContent({
	activeLoading,
	activeTournaments,
	archivedLoading,
	archivedTournaments,
	currencies,
	onOpenActions,
	showArchived,
}: TournamentContentProps) {
	if (activeLoading) {
		return <TournamentListSkeleton />;
	}
	return (
		<>
			{activeTournaments.length === 0 && !showArchived ? (
				<p className="py-6 text-center text-muted-foreground text-sm">
					No tournaments yet.
				</p>
			) : null}
			{activeTournaments.length > 0 ? (
				<TournamentList
					currencies={currencies}
					onOpenActions={onOpenActions}
					tournaments={activeTournaments}
				/>
			) : null}
			{showArchived ? (
				<div className="mt-1 flex flex-col gap-2 border-border border-t border-dashed pt-3">
					<p className="t-meta uppercase tracking-wide">Archived</p>
					<ArchivedTournaments
						currencies={currencies}
						isLoading={archivedLoading}
						onOpenActions={onOpenActions}
						tournaments={archivedTournaments}
					/>
				</div>
			) : null}
		</>
	);
}

export function TournamentTab({ storeId }: { storeId: string }) {
	const {
		activeTournaments,
		archivedTournaments,
		currencies,
		activeLoading,
		archivedLoading,
		showArchived,
		toggleArchived,
		isCreateOpen,
		setIsCreateOpen,
		editingTournament,
		setEditingTournament,
		actionsTarget,
		pendingDelete,
		isCreateLoading,
		isUpdateLoading,
		editBlindLevelsLoading,
		editInitialFormValues,
		editInitialLevels,
		handleCreate,
		handleUpdate,
		openActions,
		closeActions,
		openEditFromActions,
		openDeleteFromActions,
		handleArchiveFromActions,
		handleRestoreFromActions,
		cancelDelete,
		handleConfirmDelete,
	} = useTournamentTab({ storeId });

	return (
		<div className="flex flex-col gap-3">
			<Button
				className="w-full"
				onClick={() => setIsCreateOpen(true)}
				size="lg"
			>
				<IconPlus className="size-5" />
				Add tournament
			</Button>

			<TournamentContent
				activeLoading={activeLoading}
				activeTournaments={activeTournaments}
				archivedLoading={archivedLoading}
				archivedTournaments={archivedTournaments}
				currencies={currencies}
				onOpenActions={openActions}
				showArchived={showArchived}
			/>

			<Button
				className="self-center text-muted-foreground"
				onClick={toggleArchived}
				size="sm"
				variant="ghost"
			>
				{showArchived ? (
					<IconArchiveOff className="size-4" />
				) : (
					<IconArchive className="size-4" />
				)}
				{showArchived ? "Hide archived" : "Show archived"}
			</Button>

			<TournamentFormSheet
				aiMode="create"
				formId={CREATE_FORM_ID}
				initialBlindLevels={[]}
				isLoading={isCreateLoading}
				onOpenChange={setIsCreateOpen}
				onSave={handleCreate}
				open={isCreateOpen}
				title="Add tournament"
			/>

			<TournamentFormSheet
				aiMode="edit"
				formId={EDIT_FORM_ID}
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
				title="Edit tournament"
			/>

			<GameActionsDrawer
				isArchived={actionsTarget?.archivedAt != null}
				label="tournament"
				onArchive={handleArchiveFromActions}
				onDelete={openDeleteFromActions}
				onEdit={openEditFromActions}
				onOpenChange={(open) => {
					if (!open) {
						closeActions();
					}
				}}
				onRestore={handleRestoreFromActions}
				open={actionsTarget !== null}
			/>

			<DeleteGameDialog
				label="tournament"
				name={pendingDelete?.name ?? ""}
				onConfirm={handleConfirmDelete}
				onOpenChange={(open) => {
					if (!open) {
						cancelDelete();
					}
				}}
				open={pendingDelete !== null}
			/>
		</div>
	);
}

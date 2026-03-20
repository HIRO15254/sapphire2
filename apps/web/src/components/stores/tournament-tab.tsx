import {
	IconArchive,
	IconArchiveOff,
	IconChevronDown,
	IconChevronUp,
	IconEdit,
	IconPlus,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BlindLevelEditor } from "@/components/stores/blind-level-editor";
import { TournamentForm } from "@/components/stores/tournament-form";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
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
	const parts = [`Buy-in: ${t.buyIn}`];
	if (t.entryFee != null) {
		parts.push(`+${t.entryFee}`);
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
	const [expanded, setExpanded] = useState(false);
	const buyInInfo = formatBuyIn(tournament);

	return (
		<div className="rounded-lg border bg-card">
			<div className="flex items-start justify-between gap-2 p-3">
				<button
					className="min-w-0 flex-1 text-left"
					onClick={() => setExpanded((v) => !v)}
					type="button"
				>
					<div className="flex items-center gap-1.5">
						<p className="truncate font-medium">{tournament.name}</p>
						{expanded ? (
							<IconChevronUp
								className="shrink-0 text-muted-foreground"
								size={14}
							/>
						) : (
							<IconChevronDown
								className="shrink-0 text-muted-foreground"
								size={14}
							/>
						)}
					</div>
					<div className="mt-0.5 flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
						{buyInInfo && <span>{buyInInfo}</span>}
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
				</button>

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

			{expanded && (
				<div className="border-t px-3 pb-3">
					<BlindLevelEditor
						tournamentId={tournament.id}
						variant={tournament.variant}
					/>
				</div>
			)}
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
	const [isSubmitting, setIsSubmitting] = useState(false);

	const tournamentsQuery = useQuery(
		trpc.tournament.listByStore.queryOptions({
			storeId,
			includeArchived: showArchived,
		})
	);
	const tournaments = tournamentsQuery.data ?? [];

	const handleCreate = async (values: TournamentFormValues) => {
		setIsSubmitting(true);
		try {
			await trpcClient.tournament.create.mutate({ storeId, ...values });
			await tournamentsQuery.refetch();
			setIsCreateOpen(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleUpdate = async (values: TournamentFormValues) => {
		if (!editingTournament) {
			return;
		}
		setIsSubmitting(true);
		try {
			await trpcClient.tournament.update.mutate({
				id: editingTournament.id,
				...values,
			});
			await tournamentsQuery.refetch();
			setEditingTournament(null);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleArchive = async (id: string) => {
		await trpcClient.tournament.archive.mutate({ id });
		await tournamentsQuery.refetch();
	};

	const handleRestore = async (id: string) => {
		await trpcClient.tournament.restore.mutate({ id });
		await tournamentsQuery.refetch();
	};

	const handleDelete = async (id: string) => {
		await trpcClient.tournament.delete.mutate({ id });
		await tournamentsQuery.refetch();
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
				<TournamentForm isLoading={isSubmitting} onSubmit={handleCreate} />
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
						}}
						isLoading={isSubmitting}
						onSubmit={handleUpdate}
					/>
				)}
			</ResponsiveDialog>
		</div>
	);
}

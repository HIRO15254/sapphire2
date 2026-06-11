import {
	IconArchive,
	IconArchiveOff,
	IconDotsVertical,
	IconPlus,
} from "@tabler/icons-react";
import { DeleteGameDialog } from "@/features/rooms/components/delete-game-dialog";
import { GameActionsDrawer } from "@/features/rooms/components/game-actions-drawer";
import { RingGameForm } from "@/features/rooms/components/ring-game-form";
import type { RingGame } from "@/features/rooms/hooks/use-ring-games";
import { formatRingGameBlinds } from "@/features/rooms/utils/game-format";
import { cn } from "@/lib/utils";
import { FormSheet } from "@/shared/components/form-sheet";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { createGroupFormatter } from "@/utils/format-number";
import { getTableSizeClassName } from "@/utils/table-size-colors";
import { useRingGameTab } from "./use-ring-game-tab";

const CREATE_FORM_ID = "ring-game-create-form";
const EDIT_FORM_ID = "ring-game-edit-form";

interface CurrencyOption {
	id: string;
	name: string;
	unit?: string | null;
}

function formatBuyInLine(
	game: RingGame,
	currencyUnit: string | null | undefined
): string {
	if (game.minBuyIn == null && game.maxBuyIn == null) {
		return "";
	}
	const fmt = createGroupFormatter([game.minBuyIn, game.maxBuyIn]);
	const min = game.minBuyIn == null ? "—" : fmt(game.minBuyIn);
	const max = game.maxBuyIn == null ? "—" : fmt(game.maxBuyIn);
	const unit = currencyUnit ? ` ${currencyUnit}` : "";
	return `Buy-in ${min}–${max}${unit}`;
}

interface RingGameRowProps {
	currencies: CurrencyOption[];
	game: RingGame;
	onOpenActions: (game: RingGame) => void;
}

function RingGameRow({ game, currencies, onOpenActions }: RingGameRowProps) {
	const currency = currencies.find((c) => c.id === game.currencyId);
	const blindLine = formatRingGameBlinds(game, currency?.unit);
	const buyInLine = formatBuyInLine(game, currency?.unit);
	const meta = [blindLine, buyInLine].filter(Boolean).join(" · ");
	const isArchived = game.archivedAt != null;

	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground",
				isArchived && "opacity-60"
			)}
		>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="truncate font-medium text-sm">{game.name}</span>
					<Badge variant="secondary">{game.variant.toUpperCase()}</Badge>
					{game.tableSize == null ? null : (
						<Badge className={getTableSizeClassName(game.tableSize)}>
							{game.tableSize}-max
						</Badge>
					)}
					{isArchived ? <Badge variant="outline">Archived</Badge> : null}
				</div>
				{meta ? (
					<p className="mt-0.5 truncate text-muted-foreground text-xs">
						{meta}
					</p>
				) : null}
			</div>
			<Button
				aria-label={`Actions for ${game.name}`}
				onClick={() => onOpenActions(game)}
				size="icon-sm"
				variant="ghost"
			>
				<IconDotsVertical className="size-4" />
			</Button>
		</div>
	);
}

function RingGameListSkeleton() {
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

interface RingGameListProps {
	currencies: CurrencyOption[];
	games: RingGame[];
	onOpenActions: (game: RingGame) => void;
}

function RingGameList({ games, currencies, onOpenActions }: RingGameListProps) {
	return (
		<div className="flex flex-col gap-2">
			{games.map((game) => (
				<RingGameRow
					currencies={currencies}
					game={game}
					key={game.id}
					onOpenActions={onOpenActions}
				/>
			))}
		</div>
	);
}

interface ArchivedRingGamesProps {
	currencies: CurrencyOption[];
	games: RingGame[];
	isLoading: boolean;
	onOpenActions: (game: RingGame) => void;
}

function ArchivedRingGames({
	games,
	currencies,
	isLoading,
	onOpenActions,
}: ArchivedRingGamesProps) {
	if (isLoading) {
		return <RingGameListSkeleton />;
	}
	if (games.length === 0) {
		return (
			<p className="py-2 text-center text-muted-foreground text-xs">
				No archived cash games.
			</p>
		);
	}
	return (
		<RingGameList
			currencies={currencies}
			games={games}
			onOpenActions={onOpenActions}
		/>
	);
}

interface RingGameContentProps {
	activeGames: RingGame[];
	activeLoading: boolean;
	archivedGames: RingGame[];
	archivedLoading: boolean;
	currencies: CurrencyOption[];
	onOpenActions: (game: RingGame) => void;
	showArchived: boolean;
}

function RingGameContent({
	activeGames,
	activeLoading,
	archivedGames,
	archivedLoading,
	currencies,
	onOpenActions,
	showArchived,
}: RingGameContentProps) {
	if (activeLoading) {
		return <RingGameListSkeleton />;
	}
	return (
		<>
			{activeGames.length === 0 && !showArchived ? (
				<p className="py-6 text-center text-muted-foreground text-sm">
					No cash games yet.
				</p>
			) : null}
			{activeGames.length > 0 ? (
				<RingGameList
					currencies={currencies}
					games={activeGames}
					onOpenActions={onOpenActions}
				/>
			) : null}
			{showArchived ? (
				<div className="mt-1 flex flex-col gap-2 border-border border-t border-dashed pt-3">
					<p className="t-meta uppercase tracking-wide">Archived</p>
					<ArchivedRingGames
						currencies={currencies}
						games={archivedGames}
						isLoading={archivedLoading}
						onOpenActions={onOpenActions}
					/>
				</div>
			) : null}
		</>
	);
}

export function RingGameTab({ roomId }: { roomId: string }) {
	const {
		showArchived,
		toggleArchived,
		isCreateOpen,
		setIsCreateOpen,
		editingGame,
		setEditingGame,
		actionsTarget,
		pendingDelete,
		activeGames,
		archivedGames,
		currencies,
		activeLoading,
		archivedLoading,
		isCreatePending,
		isUpdatePending,
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
	} = useRingGameTab({ roomId });

	return (
		<div className="flex flex-col gap-3">
			<Button
				className="w-full"
				onClick={() => setIsCreateOpen(true)}
				size="lg"
			>
				<IconPlus className="size-5" />
				Add cash game
			</Button>

			<RingGameContent
				activeGames={activeGames}
				activeLoading={activeLoading}
				archivedGames={archivedGames}
				archivedLoading={archivedLoading}
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

			<FormSheet
				formId={CREATE_FORM_ID}
				isLoading={isCreatePending}
				onOpenChange={setIsCreateOpen}
				open={isCreateOpen}
				title="Add cash game"
			>
				<RingGameForm formId={CREATE_FORM_ID} onSubmit={handleCreate} />
			</FormSheet>

			<FormSheet
				formId={EDIT_FORM_ID}
				isLoading={isUpdatePending}
				onOpenChange={(open) => {
					if (!open) {
						setEditingGame(null);
					}
				}}
				open={editingGame !== null}
				title="Edit cash game"
			>
				{editingGame ? (
					<RingGameForm
						defaultValues={{
							name: editingGame.name,
							variant: editingGame.variant,
							blind1: editingGame.blind1 ?? undefined,
							blind2: editingGame.blind2 ?? undefined,
							blind3: editingGame.blind3 ?? undefined,
							ante: editingGame.ante ?? undefined,
							anteType: (editingGame.anteType ?? undefined) as
								| "all"
								| "bb"
								| "none"
								| undefined,
							minBuyIn: editingGame.minBuyIn ?? undefined,
							maxBuyIn: editingGame.maxBuyIn ?? undefined,
							tableSize: editingGame.tableSize ?? undefined,
							currencyId: editingGame.currencyId ?? undefined,
							memo: editingGame.memo ?? undefined,
						}}
						formId={EDIT_FORM_ID}
						onSubmit={handleUpdate}
					/>
				) : null}
			</FormSheet>

			<GameActionsDrawer
				isArchived={actionsTarget?.archivedAt != null}
				label="cash game"
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
				label="cash game"
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

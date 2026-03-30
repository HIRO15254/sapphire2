import {
	IconArchive,
	IconArchiveOff,
	IconEdit,
	IconPlus,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RingGameForm } from "@/components/stores/ring-game-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { createGroupFormatter } from "@/utils/format-number";
import { getTableSizeClassName } from "@/utils/table-size-colors";
import { trpc, trpcClient } from "@/utils/trpc";

interface RingGame {
	ante: number | null;
	anteType?: string | null;
	archivedAt: Date | string | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	currencyId: string | null;
	id: string;
	maxBuyIn: number | null;
	memo: string | null;
	minBuyIn: number | null;
	name: string;
	storeId: string | null;
	tableSize: number | null;
	variant: string;
}

interface RingGameFormValues {
	ante?: number;
	anteType?: "all" | "bb" | "none";
	blind1?: number;
	blind2?: number;
	blind3?: number;
	currencyId?: string;
	maxBuyIn?: number;
	memo?: string;
	minBuyIn?: number;
	name: string;
	tableSize?: number;
	variant: string;
}

interface RingGameTabProps {
	storeId: string;
}

interface GameActionHandlers {
	onArchive: (id: string) => void;
	onDelete: (id: string) => void;
	onEdit: (game: RingGame) => void;
	onRestore: (id: string) => void;
	onView: (game: RingGame) => void;
}

interface RingGameListProps extends GameActionHandlers {
	currencies: { id: string; name: string; unit?: string | null }[];
	games: RingGame[];
	isArchived: boolean;
}

function RingGameList({
	games,
	currencies,
	isArchived,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
	onView,
}: RingGameListProps) {
	if (games.length === 0) {
		return null;
	}

	return (
		<div className="divide-y">
			{games.map((game) => (
				<RingGameRow
					currencies={currencies}
					game={game}
					isArchived={isArchived}
					key={game.id}
					onArchive={onArchive}
					onDelete={onDelete}
					onEdit={onEdit}
					onRestore={onRestore}
					onView={onView}
				/>
			))}
		</div>
	);
}

interface ArchivedRingGameSectionProps extends GameActionHandlers {
	currencies: { id: string; name: string; unit?: string | null }[];
	games: RingGame[];
	isLoading: boolean;
}

function ArchivedRingGameSection({
	games,
	currencies,
	isLoading,
	...handlers
}: ArchivedRingGameSectionProps) {
	if (isLoading) {
		return (
			<p className="py-1 text-center text-[11px] text-muted-foreground">
				Loading archived...
			</p>
		);
	}

	if (games.length === 0) {
		return (
			<p className="py-1 text-center text-[11px] text-muted-foreground">
				No archived cash games.
			</p>
		);
	}

	return (
		<div className="mt-1 border-t border-dashed pt-1">
			<RingGameList
				currencies={currencies}
				games={games}
				isArchived
				{...handlers}
			/>
		</div>
	);
}

interface RingGameContentProps extends GameActionHandlers {
	activeGames: RingGame[];
	archivedGames: RingGame[];
	archivedLoading: boolean;
	currencies: { id: string; name: string; unit?: string | null }[];
	isLoading: boolean;
	showArchived: boolean;
}

function RingGameContent({
	activeGames,
	archivedGames,
	archivedLoading,
	currencies,
	isLoading,
	showArchived,
	...handlers
}: RingGameContentProps) {
	if (isLoading) {
		return (
			<p className="py-2 text-center text-muted-foreground text-xs">
				Loading...
			</p>
		);
	}

	return (
		<>
			{activeGames.length === 0 && !showArchived && (
				<p className="py-1 text-center text-[11px] text-muted-foreground">
					No cash games yet.
				</p>
			)}
			<RingGameList
				currencies={currencies}
				games={activeGames}
				isArchived={false}
				{...handlers}
			/>
			{showArchived && (
				<ArchivedRingGameSection
					currencies={currencies}
					games={archivedGames}
					isLoading={archivedLoading}
					{...handlers}
				/>
			)}
		</>
	);
}

const VARIANT_LABELS: Record<string, string> = {
	nlh: "NLH",
};

function formatBlindsLine(
	game: RingGame,
	currencyUnit: string | null | undefined
): string {
	const fmt = createGroupFormatter([
		game.blind1,
		game.blind2,
		game.blind3,
		game.ante,
	]);

	const parts: string[] = [];
	if (game.blind1 != null) {
		parts.push(fmt(game.blind1));
	}
	if (game.blind2 != null) {
		parts.push(fmt(game.blind2));
	} else if (parts.length > 0) {
		parts.push("—");
	}
	if (game.blind3 != null) {
		parts.push(fmt(game.blind3));
	}

	const blindStr = parts.length > 0 ? parts.join("/") : "";

	let anteStr = "";
	if (game.ante != null && game.anteType !== "none" && game.anteType != null) {
		if (game.anteType === "bb") {
			anteStr = `(BBA:${fmt(game.ante)})`;
		} else if (game.anteType === "all") {
			anteStr = `(Ante:${fmt(game.ante)})`;
		}
	}

	const unitStr = currencyUnit ?? "";

	const segments = [blindStr, anteStr, unitStr].filter(Boolean);
	return segments.join(" ");
}

interface RingGameRowProps {
	currencies: { id: string; name: string; unit?: string | null }[];
	game: RingGame;
	isArchived: boolean;
	onArchive: (id: string) => void;
	onDelete: (id: string) => void;
	onEdit: (game: RingGame) => void;
	onRestore: (id: string) => void;
	onView: (game: RingGame) => void;
}

function RingGameRow({
	game,
	currencies,
	isArchived,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
	onView,
}: RingGameRowProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const currency = currencies.find((c) => c.id === game.currencyId);
	const blindLine = formatBlindsLine(game, currency?.unit);
	const variantLabel =
		VARIANT_LABELS[game.variant] ?? game.variant.toUpperCase();

	return (
		<div className="flex items-center gap-1.5 py-1">
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-1">
					<button
						className="truncate font-medium text-xs hover:underline"
						onClick={() => onView(game)}
						type="button"
					>
						{game.name}
					</button>
					<Badge className="px-1 py-0 text-[10px]" variant="secondary">
						{variantLabel}
					</Badge>
					{game.tableSize != null && (
						<Badge
							className={`px-1 py-0 text-[10px] ${getTableSizeClassName(game.tableSize)}`}
						>
							{game.tableSize}-max
						</Badge>
					)}
					{blindLine && (
						<span className="text-[11px] text-muted-foreground">
							{blindLine}
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
								onDelete(game.id);
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
							aria-label="Edit cash game"
							onClick={() => onEdit(game)}
							size="icon-xs"
							variant="ghost"
						>
							<IconEdit size={12} />
						</Button>
						{isArchived ? (
							<Button
								aria-label="Restore cash game"
								onClick={() => onRestore(game.id)}
								size="icon-xs"
								variant="ghost"
							>
								<IconArchiveOff size={12} />
							</Button>
						) : (
							<Button
								aria-label="Archive cash game"
								onClick={() => onArchive(game.id)}
								size="icon-xs"
								variant="ghost"
							>
								<IconArchive size={12} />
							</Button>
						)}
						<Button
							aria-label="Delete cash game"
							onClick={() => setConfirmingDelete(true)}
							size="icon-xs"
							variant="ghost"
						>
							<IconTrash size={12} />
						</Button>
					</>
				)}
			</div>
		</div>
	);
}

interface RingGameDetailProps {
	currencies: { id: string; name: string; unit?: string | null }[];
	game: RingGame;
}

function RingGameDetail({ game, currencies }: RingGameDetailProps) {
	const currency = currencies.find((c) => c.id === game.currencyId);
	const blindLine = formatBlindsLine(game, currency?.unit);
	const variantLabel =
		VARIANT_LABELS[game.variant] ?? game.variant.toUpperCase();
	const fmt = createGroupFormatter([game.minBuyIn, game.maxBuyIn]);

	return (
		<div className="space-y-3 text-sm">
			<div className="flex flex-wrap gap-1.5">
				<Badge variant="secondary">{variantLabel}</Badge>
				{game.tableSize != null && (
					<Badge className={getTableSizeClassName(game.tableSize)}>
						{game.tableSize}-max
					</Badge>
				)}
				{currency && <Badge variant="outline">{currency.name}</Badge>}
			</div>

			{blindLine && (
				<div>
					<p className="text-muted-foreground text-xs">Blinds</p>
					<p>{blindLine}</p>
				</div>
			)}

			{(game.minBuyIn != null || game.maxBuyIn != null) && (
				<div>
					<p className="text-muted-foreground text-xs">Buy-in</p>
					<p>
						{game.minBuyIn != null ? fmt(game.minBuyIn) : "—"}
						{" - "}
						{game.maxBuyIn != null ? fmt(game.maxBuyIn) : "—"}
					</p>
				</div>
			)}

			{game.memo && (
				<div>
					<p className="text-muted-foreground text-xs">Memo</p>
					<p className="whitespace-pre-wrap">{game.memo}</p>
				</div>
			)}
		</div>
	);
}

export function RingGameTab({ storeId }: RingGameTabProps) {
	const [showArchived, setShowArchived] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingGame, setEditingGame] = useState<RingGame | null>(null);
	const [viewingGame, setViewingGame] = useState<RingGame | null>(null);

	const queryClient = useQueryClient();

	const activeQueryOptions = trpc.ringGame.listByStore.queryOptions({
		storeId,
		includeArchived: false,
	});
	const archivedQueryOptions = trpc.ringGame.listByStore.queryOptions({
		storeId,
		includeArchived: true,
	});

	const activeQuery = useQuery(activeQueryOptions);
	const activeGames = activeQuery.data ?? [];

	const archivedQuery = useQuery({
		...archivedQueryOptions,
		enabled: showArchived,
	});
	const archivedGames = archivedQuery.data ?? [];

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	const createMutation = useMutation({
		mutationFn: (values: RingGameFormValues) =>
			trpcClient.ringGame.create.mutate({ storeId, ...values }),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: activeQueryOptions.queryKey });
		},
		onSuccess: () => {
			setIsCreateOpen(false);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: RingGameFormValues & { id: string }) =>
			trpcClient.ringGame.update.mutate(values),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: activeQueryOptions.queryKey });
			queryClient.invalidateQueries({
				queryKey: archivedQueryOptions.queryKey,
			});
		},
		onSuccess: () => {
			setEditingGame(null);
		},
	});

	const archiveMutation = useMutation({
		mutationFn: (id: string) => trpcClient.ringGame.archive.mutate({ id }),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: activeQueryOptions.queryKey });
			queryClient.invalidateQueries({
				queryKey: archivedQueryOptions.queryKey,
			});
		},
	});

	const restoreMutation = useMutation({
		mutationFn: (id: string) => trpcClient.ringGame.restore.mutate({ id }),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: activeQueryOptions.queryKey });
			queryClient.invalidateQueries({
				queryKey: archivedQueryOptions.queryKey,
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.ringGame.delete.mutate({ id }),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: activeQueryOptions.queryKey });
			queryClient.invalidateQueries({
				queryKey: archivedQueryOptions.queryKey,
			});
		},
	});

	const handleCreate = (values: RingGameFormValues) => {
		createMutation.mutate(values);
	};

	const handleUpdate = (values: RingGameFormValues) => {
		if (!editingGame) {
			return;
		}
		updateMutation.mutate({ id: editingGame.id, ...values });
	};

	return (
		<div>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1">
					<span className="font-medium text-muted-foreground text-xs">
						Cash Games
					</span>
					<Button
						aria-label={
							showArchived ? "Hide archived games" : "Show archived games"
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

			<RingGameContent
				activeGames={activeGames}
				archivedGames={archivedGames}
				archivedLoading={archivedQuery.isLoading}
				currencies={currencies}
				isLoading={activeQuery.isLoading}
				onArchive={(id) => archiveMutation.mutate(id)}
				onDelete={(id) => deleteMutation.mutate(id)}
				onEdit={setEditingGame}
				onRestore={(id) => restoreMutation.mutate(id)}
				onView={setViewingGame}
				showArchived={showArchived}
			/>

			<ResponsiveDialog
				onOpenChange={setIsCreateOpen}
				open={isCreateOpen}
				title="Add Cash Game"
			>
				<RingGameForm
					isLoading={createMutation.isPending}
					onSubmit={handleCreate}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingGame(null);
					}
				}}
				open={editingGame !== null}
				title="Edit Cash Game"
			>
				{editingGame && (
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
						isLoading={updateMutation.isPending}
						onSubmit={handleUpdate}
					/>
				)}
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setViewingGame(null);
					}
				}}
				open={viewingGame !== null}
				title={viewingGame?.name ?? "Cash Game"}
			>
				{viewingGame && (
					<RingGameDetail currencies={currencies} game={viewingGame} />
				)}
			</ResponsiveDialog>
		</div>
	);
}

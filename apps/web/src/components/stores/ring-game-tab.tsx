import {
	IconArchive,
	IconArchiveOff,
	IconEdit,
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
import { RingGameForm } from "@/components/stores/ring-game-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { createGroupFormatter } from "@/utils/format-number";
import { getTableSizeClassName } from "@/utils/table-size-colors";
import { trpc, trpcClient } from "@/utils/trpc";

interface RingGame {
	ante: number | null;
	anteType: string | null;
	archivedAt: string | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	createdAt: string;
	currencyId: string | null;
	id: string;
	maxBuyIn: number | null;
	memo: string | null;
	minBuyIn: number | null;
	name: string;
	storeId: string | null;
	tableSize: number | null;
	updatedAt: string;
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

function buildOptimisticRingGame(
	storeId: string,
	values: RingGameFormValues,
	id: string
): RingGame {
	return {
		ante: values.ante ?? null,
		anteType: values.anteType ?? "none",
		archivedAt: null,
		blind1: values.blind1 ?? null,
		blind2: values.blind2 ?? null,
		blind3: values.blind3 ?? null,
		currencyId: values.currencyId ?? null,
		id,
		maxBuyIn: values.maxBuyIn ?? null,
		memo: values.memo ?? null,
		minBuyIn: values.minBuyIn ?? null,
		name: values.name,
		storeId,
		tableSize: values.tableSize ?? null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		variant: values.variant,
	};
}

interface RingGameTabProps {
	expandedGameId: string | null;
	onToggleGame: (id: string | null) => void;
	storeId: string;
}

interface GameActionHandlers {
	onArchive: (id: string) => void;
	onDelete: (id: string) => void;
	onEdit: (game: RingGame) => void;
	onRestore: (id: string) => void;
}

interface RingGameListProps extends GameActionHandlers {
	currencies: { id: string; name: string; unit?: string | null }[];
	expandedGameId: string | null;
	games: RingGame[];
	isArchived: boolean;
	onToggleGame: (id: string | null) => void;
}

function RingGameList({
	games,
	currencies,
	expandedGameId,
	isArchived,
	onToggleGame,
	...handlers
}: RingGameListProps) {
	if (games.length === 0) {
		return null;
	}

	return (
		<ExpandableItemList
			onValueChange={onToggleGame}
			value={
				games.some((game) => game.id === expandedGameId) ? expandedGameId : null
			}
		>
			{games.map((game) => (
				<RingGameRow
					currencies={currencies}
					expanded={expandedGameId === game.id}
					game={game}
					isArchived={isArchived}
					key={game.id}
					{...handlers}
				/>
			))}
		</ExpandableItemList>
	);
}

interface ArchivedRingGameSectionProps extends GameActionHandlers {
	currencies: { id: string; name: string; unit?: string | null }[];
	expandedGameId: string | null;
	games: RingGame[];
	isLoading: boolean;
	onToggleGame: (id: string | null) => void;
}

function ArchivedRingGameSection({
	games,
	currencies,
	expandedGameId,
	isLoading,
	onToggleGame,
	...handlers
}: ArchivedRingGameSectionProps) {
	if (isLoading) {
		return <ManagementSectionState>Loading archived...</ManagementSectionState>;
	}

	if (games.length === 0) {
		return (
			<ManagementSectionState>No archived cash games.</ManagementSectionState>
		);
	}

	return (
		<div className="mt-1 border-t border-dashed pt-1">
			<RingGameList
				currencies={currencies}
				expandedGameId={expandedGameId}
				games={games}
				isArchived
				onToggleGame={onToggleGame}
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
	expandedGameId: string | null;
	isLoading: boolean;
	onToggleGame: (id: string | null) => void;
	showArchived: boolean;
}

function RingGameContent({
	activeGames,
	archivedGames,
	archivedLoading,
	currencies,
	expandedGameId,
	isLoading,
	onToggleGame,
	showArchived,
	...handlers
}: RingGameContentProps) {
	if (isLoading) {
		return (
			<ManagementSectionState className="py-2 text-xs">
				Loading...
			</ManagementSectionState>
		);
	}

	return (
		<>
			{activeGames.length === 0 && !showArchived && (
				<ManagementSectionState>No cash games yet.</ManagementSectionState>
			)}
			<RingGameList
				currencies={currencies}
				expandedGameId={expandedGameId}
				games={activeGames}
				isArchived={false}
				onToggleGame={onToggleGame}
				{...handlers}
			/>
			{showArchived && (
				<ArchivedRingGameSection
					currencies={currencies}
					expandedGameId={expandedGameId}
					games={archivedGames}
					isLoading={archivedLoading}
					onToggleGame={onToggleGame}
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
	expanded: boolean;
	game: RingGame;
	isArchived: boolean;
	onArchive: (id: string) => void;
	onDelete: (id: string) => void;
	onEdit: (game: RingGame) => void;
	onRestore: (id: string) => void;
}

function RingGameRow({
	game,
	currencies,
	expanded,
	isArchived,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
}: RingGameRowProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const currency = currencies.find((c) => c.id === game.currencyId);
	const blindLine = formatBlindsLine(game, currency?.unit);
	const variantLabel =
		VARIANT_LABELS[game.variant] ?? game.variant.toUpperCase();
	const fmt = createGroupFormatter([game.minBuyIn, game.maxBuyIn]);

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
						<span className="truncate font-medium text-xs">{game.name}</span>
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
			}
			value={game.id}
		>
			{(game.minBuyIn != null || game.maxBuyIn != null) && (
				<p className="text-[11px] text-muted-foreground">
					Buy-in: {game.minBuyIn != null ? fmt(game.minBuyIn) : "—"} -{" "}
					{game.maxBuyIn != null ? fmt(game.maxBuyIn) : "—"}
					{currency?.unit ? ` ${currency.unit}` : ""}
				</p>
			)}
			{game.memo && (
				<p className="whitespace-pre-wrap text-[11px] text-muted-foreground">
					{game.memo}
				</p>
			)}

			<RingGameActions
				confirmingDelete={confirmingDelete}
				game={game}
				isArchived={isArchived}
				onArchive={onArchive}
				onDelete={onDelete}
				onEdit={onEdit}
				onRestore={onRestore}
				setConfirmingDelete={setConfirmingDelete}
			/>
		</ExpandableItem>
	);
}

interface RingGameActionsProps {
	confirmingDelete: boolean;
	game: RingGame;
	isArchived: boolean;
	onArchive: (id: string) => void;
	onDelete: (id: string) => void;
	onEdit: (game: RingGame) => void;
	onRestore: (id: string) => void;
	setConfirmingDelete: (v: boolean) => void;
}

function RingGameActions({
	game,
	isArchived,
	confirmingDelete,
	setConfirmingDelete,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
}: RingGameActionsProps) {
	if (confirmingDelete) {
		return (
			<div className="mt-1 flex items-center justify-end gap-1">
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
			</div>
		);
	}

	return (
		<div className="mt-1 flex items-center justify-end gap-1">
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
		</div>
	);
}

export function RingGameTab({
	storeId,
	expandedGameId,
	onToggleGame,
}: RingGameTabProps) {
	const [showArchived, setShowArchived] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingGame, setEditingGame] = useState<RingGame | null>(null);

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

	const invalidateBoth = () => {
		queryClient.invalidateQueries({ queryKey: activeQueryOptions.queryKey });
		queryClient.invalidateQueries({
			queryKey: archivedQueryOptions.queryKey,
		});
	};

	const createMutation = useMutation({
		mutationFn: (values: RingGameFormValues) =>
			trpcClient.ringGame.create.mutate({ storeId, ...values }),
		onMutate: async (values) => {
			await Promise.all([
				queryClient.cancelQueries({ queryKey: activeQueryOptions.queryKey }),
				queryClient.cancelQueries({ queryKey: archivedQueryOptions.queryKey }),
			]);
			const previousActive = queryClient.getQueryData(
				activeQueryOptions.queryKey
			);
			const previousArchived = queryClient.getQueryData(
				archivedQueryOptions.queryKey
			);
			queryClient.setQueryData<RingGame[]>(
				activeQueryOptions.queryKey,
				(old) => [
					...(old ?? []),
					buildOptimisticRingGame(
						storeId,
						values,
						`temp-ring-game-${Date.now()}`
					),
				]
			);
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			if (context?.previousActive) {
				queryClient.setQueryData(
					activeQueryOptions.queryKey,
					context.previousActive
				);
			}
			if (context?.previousArchived) {
				queryClient.setQueryData(
					archivedQueryOptions.queryKey,
					context.previousArchived
				);
			}
		},
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
		onMutate: async (values) => {
			await Promise.all([
				queryClient.cancelQueries({ queryKey: activeQueryOptions.queryKey }),
				queryClient.cancelQueries({ queryKey: archivedQueryOptions.queryKey }),
			]);
			const previousActive = queryClient.getQueryData(
				activeQueryOptions.queryKey
			);
			const previousArchived = queryClient.getQueryData(
				archivedQueryOptions.queryKey
			);
			const applyUpdate = (games: RingGame[] | undefined) =>
				games?.map((game) =>
					game.id === values.id
						? {
								...game,
								...buildOptimisticRingGame(storeId, values, values.id),
							}
						: game
				) ?? [];
			queryClient.setQueryData(activeQueryOptions.queryKey, applyUpdate);
			queryClient.setQueryData(archivedQueryOptions.queryKey, applyUpdate);
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			if (context?.previousActive) {
				queryClient.setQueryData(
					activeQueryOptions.queryKey,
					context.previousActive
				);
			}
			if (context?.previousArchived) {
				queryClient.setQueryData(
					archivedQueryOptions.queryKey,
					context.previousArchived
				);
			}
		},
		onSettled: invalidateBoth,
		onSuccess: () => {
			setEditingGame(null);
		},
	});

	const archiveMutation = useMutation({
		mutationFn: (id: string) => trpcClient.ringGame.archive.mutate({ id }),
		onMutate: async (id) => {
			await Promise.all([
				queryClient.cancelQueries({ queryKey: activeQueryOptions.queryKey }),
				queryClient.cancelQueries({ queryKey: archivedQueryOptions.queryKey }),
			]);
			const previousActive = queryClient.getQueryData(
				activeQueryOptions.queryKey
			);
			const previousArchived = queryClient.getQueryData(
				archivedQueryOptions.queryKey
			);
			const now = new Date().toISOString();
			const archivedGame = (previousActive as RingGame[] | undefined)?.find(
				(game) => game.id === id
			);
			queryClient.setQueryData<RingGame[]>(
				activeQueryOptions.queryKey,
				(old) => old?.filter((game) => game.id !== id) ?? []
			);
			if (archivedGame) {
				queryClient.setQueryData<RingGame[]>(
					archivedQueryOptions.queryKey,
					(old) => [...(old ?? []), { ...archivedGame, archivedAt: now }]
				);
			}
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			if (context?.previousActive) {
				queryClient.setQueryData(
					activeQueryOptions.queryKey,
					context.previousActive
				);
			}
			if (context?.previousArchived) {
				queryClient.setQueryData(
					archivedQueryOptions.queryKey,
					context.previousArchived
				);
			}
		},
		onSettled: invalidateBoth,
	});

	const restoreMutation = useMutation({
		mutationFn: (id: string) => trpcClient.ringGame.restore.mutate({ id }),
		onMutate: async (id) => {
			await Promise.all([
				queryClient.cancelQueries({ queryKey: activeQueryOptions.queryKey }),
				queryClient.cancelQueries({ queryKey: archivedQueryOptions.queryKey }),
			]);
			const previousActive = queryClient.getQueryData(
				activeQueryOptions.queryKey
			);
			const previousArchived = queryClient.getQueryData(
				archivedQueryOptions.queryKey
			);
			const restoredGame = (previousArchived as RingGame[] | undefined)?.find(
				(game) => game.id === id
			);
			queryClient.setQueryData<RingGame[]>(
				archivedQueryOptions.queryKey,
				(old) => old?.filter((game) => game.id !== id) ?? []
			);
			if (restoredGame) {
				queryClient.setQueryData<RingGame[]>(
					activeQueryOptions.queryKey,
					(old) => [...(old ?? []), { ...restoredGame, archivedAt: null }]
				);
			}
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			if (context?.previousActive) {
				queryClient.setQueryData(
					activeQueryOptions.queryKey,
					context.previousActive
				);
			}
			if (context?.previousArchived) {
				queryClient.setQueryData(
					archivedQueryOptions.queryKey,
					context.previousArchived
				);
			}
		},
		onSettled: invalidateBoth,
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.ringGame.delete.mutate({ id }),
		onMutate: async (id) => {
			await Promise.all([
				queryClient.cancelQueries({ queryKey: activeQueryOptions.queryKey }),
				queryClient.cancelQueries({ queryKey: archivedQueryOptions.queryKey }),
			]);
			const previousActive = queryClient.getQueryData(
				activeQueryOptions.queryKey
			);
			const previousArchived = queryClient.getQueryData(
				archivedQueryOptions.queryKey
			);
			queryClient.setQueryData<RingGame[]>(
				activeQueryOptions.queryKey,
				(old) => old?.filter((game) => game.id !== id) ?? []
			);
			queryClient.setQueryData<RingGame[]>(
				archivedQueryOptions.queryKey,
				(old) => old?.filter((game) => game.id !== id) ?? []
			);
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			if (context?.previousActive) {
				queryClient.setQueryData(
					activeQueryOptions.queryKey,
					context.previousActive
				);
			}
			if (context?.previousArchived) {
				queryClient.setQueryData(
					archivedQueryOptions.queryKey,
					context.previousArchived
				);
			}
		},
		onSettled: invalidateBoth,
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
				}
				heading="Cash Games"
			/>

			<RingGameContent
				activeGames={activeGames}
				archivedGames={archivedGames}
				archivedLoading={archivedQuery.isLoading}
				currencies={currencies}
				expandedGameId={expandedGameId}
				isLoading={activeQuery.isLoading}
				onArchive={(id) => archiveMutation.mutate(id)}
				onDelete={(id) => deleteMutation.mutate(id)}
				onEdit={setEditingGame}
				onRestore={(id) => restoreMutation.mutate(id)}
				onToggleGame={onToggleGame}
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
		</div>
	);
}

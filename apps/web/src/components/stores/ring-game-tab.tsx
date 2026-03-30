import {
	IconArchive,
	IconArchiveOff,
	IconEdit,
	IconEye,
	IconEyeOff,
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

interface RingGameListProps {
	currencies: { id: string; name: string; unit?: string | null }[];
	games: RingGame[];
	isArchived: boolean;
	isLoading: boolean;
	onArchive: (id: string) => void;
	onDelete: (id: string) => void;
	onEdit: (game: RingGame) => void;
	onRestore: (id: string) => void;
}

function RingGameList({
	games,
	currencies,
	isLoading,
	isArchived,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
}: RingGameListProps) {
	if (isLoading) {
		return (
			<p className="py-2 text-center text-muted-foreground text-xs">
				Loading...
			</p>
		);
	}

	if (games.length === 0) {
		return (
			<p className="py-1 text-center text-[11px] text-muted-foreground">
				{isArchived ? "No archived cash games." : "No cash games yet."}
			</p>
		);
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
				/>
			))}
		</div>
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
}

function RingGameRow({
	game,
	currencies,
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

	return (
		<div className="flex items-center gap-1.5 py-1">
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

export function RingGameTab({ storeId }: RingGameTabProps) {
	const [showArchived, setShowArchived] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingGame, setEditingGame] = useState<RingGame | null>(null);

	const queryClient = useQueryClient();

	const gamesQueryOptions = trpc.ringGame.listByStore.queryOptions({
		storeId,
		includeArchived: showArchived,
	});

	const gamesQuery = useQuery(gamesQueryOptions);
	const games = gamesQuery.data ?? [];

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	const createMutation = useMutation({
		mutationFn: (values: RingGameFormValues) =>
			trpcClient.ringGame.create.mutate({ storeId, ...values }),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: gamesQueryOptions.queryKey });
		},
		onSuccess: () => {
			setIsCreateOpen(false);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: RingGameFormValues & { id: string }) =>
			trpcClient.ringGame.update.mutate(values),
		onMutate: async (updated) => {
			await queryClient.cancelQueries({
				queryKey: gamesQueryOptions.queryKey,
			});
			const previous = queryClient.getQueryData(gamesQueryOptions.queryKey);
			queryClient.setQueryData(gamesQueryOptions.queryKey, (old) =>
				old?.map((g) => (g.id === updated.id ? { ...g, ...updated } : g))
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(gamesQueryOptions.queryKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: gamesQueryOptions.queryKey });
		},
		onSuccess: () => {
			setEditingGame(null);
		},
	});

	const archiveMutation = useMutation({
		mutationFn: (id: string) => trpcClient.ringGame.archive.mutate({ id }),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: gamesQueryOptions.queryKey });
		},
	});

	const restoreMutation = useMutation({
		mutationFn: (id: string) => trpcClient.ringGame.restore.mutate({ id }),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: gamesQueryOptions.queryKey });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.ringGame.delete.mutate({ id }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({
				queryKey: gamesQueryOptions.queryKey,
			});
			const previous = queryClient.getQueryData(gamesQueryOptions.queryKey);
			queryClient.setQueryData(gamesQueryOptions.queryKey, (old) =>
				old?.filter((g) => g.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(gamesQueryOptions.queryKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: gamesQueryOptions.queryKey });
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
		<div>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1">
					<span className="font-medium text-muted-foreground text-xs">
						Cash Games
					</span>
					<Button
						aria-label={showArchived ? "Show active" : "Show archived"}
						onClick={() => setShowArchived((prev) => !prev)}
						size="icon-xs"
						variant="ghost"
					>
						{showArchived ? (
							<IconEyeOff className="text-muted-foreground" size={12} />
						) : (
							<IconEye className="text-muted-foreground" size={12} />
						)}
					</Button>
				</div>
				{!showArchived && (
					<Button
						onClick={() => setIsCreateOpen(true)}
						size="icon-xs"
						variant="ghost"
					>
						<IconPlus size={12} />
					</Button>
				)}
			</div>

			<RingGameList
				currencies={currencies}
				games={games}
				isArchived={showArchived}
				isLoading={gamesQuery.isLoading}
				onArchive={handleArchive}
				onDelete={handleDelete}
				onEdit={setEditingGame}
				onRestore={handleRestore}
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

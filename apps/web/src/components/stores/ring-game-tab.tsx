import {
	IconArchive,
	IconArchiveOff,
	IconEdit,
	IconPlus,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RingGameForm } from "@/components/stores/ring-game-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
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
	storeId: string;
	tableSize: number | null;
	variant: string;
}

interface RingGameFormValues {
	ante?: number;
	anteType?: "all" | "bb";
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

interface RingGameCardProps {
	currencies: { id: string; name: string; unit?: string | null }[];
	game: RingGame;
	isArchived: boolean;
	onArchive: (id: string) => void;
	onDelete: (id: string) => void;
	onEdit: (game: RingGame) => void;
	onRestore: (id: string) => void;
}

const VARIANT_LABELS: Record<string, string> = {
	nlh: "NLH",
};

function formatBlindsLine(
	game: RingGame,
	currencyUnit: string | null | undefined
): string {
	const parts: string[] = [];
	if (game.blind1 != null) {
		parts.push(String(game.blind1));
	}
	if (game.blind2 != null) {
		parts.push(String(game.blind2));
	} else if (parts.length > 0) {
		parts.push("—");
	}
	if (game.blind3 != null) {
		parts.push(String(game.blind3));
	}

	const blindStr = parts.length > 0 ? parts.join("/") : "";

	let anteStr = "";
	if (game.ante != null) {
		if (game.anteType === "bb") {
			anteStr = `(BB Ante: ${game.ante})`;
		} else if (game.anteType === "all") {
			anteStr = `(Ante: ${game.ante} All)`;
		} else {
			anteStr = `(Ante: ${game.ante})`;
		}
	}

	const unitStr = currencyUnit ?? "";

	const segments = [blindStr, anteStr, unitStr].filter(Boolean);
	return segments.join(" ");
}

function RingGameCard({
	game,
	currencies,
	isArchived,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
}: RingGameCardProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const currency = currencies.find((c) => c.id === game.currencyId);
	const blindLine = formatBlindsLine(game, currency?.unit);
	const variantLabel =
		VARIANT_LABELS[game.variant] ?? game.variant.toUpperCase();

	return (
		<div className="rounded-lg border bg-card p-3">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium">{game.name}</p>
					<div className="mt-1 flex flex-wrap items-center gap-1.5">
						<Badge variant="secondary">{variantLabel}</Badge>
						{game.tableSize != null && (
							<Badge variant="outline">{game.tableSize}-max</Badge>
						)}
					</div>
					{blindLine && (
						<p className="mt-1 text-muted-foreground text-sm">{blindLine}</p>
					)}
					{game.memo && (
						<p className="mt-1 line-clamp-1 text-muted-foreground text-xs">
							{game.memo}
						</p>
					)}
				</div>

				<div className="flex shrink-0 items-center gap-1">
					{confirmingDelete ? (
						<>
							<span className="text-destructive text-xs">Delete?</span>
							<Button
								aria-label="Confirm delete"
								className="text-destructive hover:text-destructive"
								onClick={() => {
									onDelete(game.id);
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
								aria-label="Edit ring game"
								onClick={() => onEdit(game)}
								size="sm"
								variant="ghost"
							>
								<IconEdit size={14} />
							</Button>
							{isArchived ? (
								<Button
									aria-label="Restore ring game"
									onClick={() => onRestore(game.id)}
									size="sm"
									variant="ghost"
								>
									<IconArchiveOff size={14} />
								</Button>
							) : (
								<Button
									aria-label="Archive ring game"
									onClick={() => onArchive(game.id)}
									size="sm"
									variant="ghost"
								>
									<IconArchive size={14} />
								</Button>
							)}
							<Button
								aria-label="Delete ring game"
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
		</div>
	);
}

interface RingGameListProps {
	currencies: { id: string; name: string; unit?: string | null }[];
	games: RingGame[];
	isArchived: boolean;
	isLoading: boolean;
	onAddGame: () => void;
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
	onAddGame,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
}: RingGameListProps) {
	if (isLoading) {
		return (
			<p className="py-8 text-center text-muted-foreground text-sm">
				Loading...
			</p>
		);
	}

	if (games.length === 0) {
		return (
			<div className="py-8 text-center text-muted-foreground">
				<p className="text-sm">
					{isArchived ? "No archived ring games." : "No ring games yet."}
				</p>
				{!isArchived && (
					<Button
						className="mt-3"
						onClick={onAddGame}
						size="sm"
						variant="outline"
					>
						<IconPlus size={14} />
						Add Game
					</Button>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{games.map((game) => (
				<RingGameCard
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

export function RingGameTab({ storeId }: RingGameTabProps) {
	const [showArchived, setShowArchived] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingGame, setEditingGame] = useState<RingGame | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const gamesQuery = useQuery(
		trpc.ringGame.listByStore.queryOptions({
			storeId,
			includeArchived: showArchived,
		})
	);
	const games = gamesQuery.data ?? [];

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	const handleCreate = async (values: RingGameFormValues) => {
		setIsSubmitting(true);
		try {
			await trpcClient.ringGame.create.mutate({ storeId, ...values });
			await gamesQuery.refetch();
			setIsCreateOpen(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleUpdate = async (values: RingGameFormValues) => {
		if (!editingGame) {
			return;
		}
		setIsSubmitting(true);
		try {
			await trpcClient.ringGame.update.mutate({
				id: editingGame.id,
				...values,
			});
			await gamesQuery.refetch();
			setEditingGame(null);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleArchive = async (id: string) => {
		await trpcClient.ringGame.archive.mutate({ id });
		await gamesQuery.refetch();
	};

	const handleRestore = async (id: string) => {
		await trpcClient.ringGame.restore.mutate({ id });
		await gamesQuery.refetch();
	};

	const handleDelete = async (id: string) => {
		await trpcClient.ringGame.delete.mutate({ id });
		await gamesQuery.refetch();
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
						Add Game
					</Button>
				)}
			</div>

			<RingGameList
				currencies={currencies}
				games={games}
				isArchived={showArchived}
				isLoading={gamesQuery.isLoading}
				onAddGame={() => setIsCreateOpen(true)}
				onArchive={handleArchive}
				onDelete={handleDelete}
				onEdit={setEditingGame}
				onRestore={handleRestore}
			/>

			<ResponsiveDialog
				onOpenChange={setIsCreateOpen}
				open={isCreateOpen}
				title="Add Ring Game"
			>
				<RingGameForm isLoading={isSubmitting} onSubmit={handleCreate} />
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingGame(null);
					}
				}}
				open={editingGame !== null}
				title="Edit Ring Game"
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
								| undefined,
							minBuyIn: editingGame.minBuyIn ?? undefined,
							maxBuyIn: editingGame.maxBuyIn ?? undefined,
							tableSize: editingGame.tableSize ?? undefined,
							currencyId: editingGame.currencyId ?? undefined,
							memo: editingGame.memo ?? undefined,
						}}
						isLoading={isSubmitting}
						onSubmit={handleUpdate}
					/>
				)}
			</ResponsiveDialog>
		</div>
	);
}

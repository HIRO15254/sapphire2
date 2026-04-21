import { IconEdit } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useActiveSession } from "@/live-sessions/hooks/use-active-session";
import { useCashGameSession } from "@/live-sessions/hooks/use-cash-game-session";
import { useTournamentSession } from "@/live-sessions/hooks/use-tournament-session";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { RingGameForm } from "@/stores/components/ring-game-form";
import { TournamentModalContent } from "@/stores/components/tournament-modal-content";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";
import type {
	RingGame,
	RingGameFormValues,
} from "@/stores/hooks/use-ring-games";
import { useRingGames } from "@/stores/hooks/use-ring-games";
import type { TournamentFormValues } from "@/stores/hooks/use-tournaments";
import { useTournaments } from "@/stores/hooks/use-tournaments";
import { createGroupFormatter } from "@/utils/format-number";
import { getTableSizeClassName } from "@/utils/table-size-colors";
import { trpc, trpcClient } from "@/utils/trpc";

const VARIANT_LABELS: Record<string, string> = {
	nlh: "NLH",
};

function variantLabel(variant: string): string {
	return VARIANT_LABELS[variant] ?? variant.toUpperCase();
}

function GameSceneShell({
	children,
	title,
	action,
}: {
	children: React.ReactNode;
	title: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="flex h-full flex-col gap-3 overflow-y-auto pb-6">
			<div className="flex items-center justify-between gap-2">
				<h1 className="font-semibold text-lg">{title}</h1>
				{action}
			</div>
			{children}
		</div>
	);
}

function DetailRow({
	label,
	value,
}: {
	label: string;
	value: React.ReactNode;
}) {
	return (
		<div className="flex items-baseline justify-between gap-4 py-1">
			<span className="text-muted-foreground text-xs">{label}</span>
			<span className="text-right font-medium text-sm">{value}</span>
		</div>
	);
}

function formatBlindParts(game: RingGame): string {
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
	return parts.join("/");
}

function formatAnteSuffix(game: RingGame): string {
	if (game.ante == null || game.anteType == null || game.anteType === "none") {
		return "";
	}
	const fmt = createGroupFormatter([game.ante]);
	if (game.anteType === "bb") {
		return `(BBA:${fmt(game.ante)})`;
	}
	if (game.anteType === "all") {
		return `(Ante:${fmt(game.ante)})`;
	}
	return "";
}

function RingGameDetailsCard({
	game,
	currencyUnit,
	currencyName,
}: {
	game: RingGame;
	currencyUnit: string | null | undefined;
	currencyName: string | null | undefined;
}) {
	const blindsStr = formatBlindParts(game);
	const anteStr = formatAnteSuffix(game);
	const fmt = createGroupFormatter([game.minBuyIn, game.maxBuyIn]);
	const buyInStr = (() => {
		if (game.minBuyIn == null && game.maxBuyIn == null) {
			return "—";
		}
		const min = game.minBuyIn == null ? "—" : fmt(game.minBuyIn);
		const max = game.maxBuyIn == null ? "—" : fmt(game.maxBuyIn);
		return `${min} - ${max}${currencyUnit ? ` ${currencyUnit}` : ""}`;
	})();

	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle className="flex flex-wrap items-center gap-1.5">
					<span className="truncate">{game.name}</span>
					<Badge className="px-1 py-0 text-[10px]" variant="secondary">
						{variantLabel(game.variant)}
					</Badge>
					{game.tableSize == null ? null : (
						<Badge
							className={`px-1 py-0 text-[10px] ${getTableSizeClassName(game.tableSize)}`}
						>
							{game.tableSize}-max
						</Badge>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent className="divide-y">
				<DetailRow
					label="Blinds"
					value={
						blindsStr
							? `${blindsStr}${anteStr ? ` ${anteStr}` : ""}${currencyUnit ? ` ${currencyUnit}` : ""}`
							: "—"
					}
				/>
				<DetailRow label="Buy-in" value={buyInStr} />
				<DetailRow
					label="Table"
					value={game.tableSize == null ? "—" : `${game.tableSize}-max`}
				/>
				<DetailRow label="Currency" value={currencyName ?? "—"} />
				{game.memo ? (
					<div className="py-2">
						<p className="text-muted-foreground text-xs">Memo</p>
						<p className="whitespace-pre-wrap text-sm">{game.memo}</p>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

function CashGameDetails({ sessionId }: { sessionId: string }) {
	const queryClient = useQueryClient();
	const [isEditOpen, setIsEditOpen] = useState(false);
	const { session, ringGames } = useCashGameSession(sessionId);
	const storeId = session?.storeId ?? "";
	const { update, isUpdatePending, currencies } = useRingGames({
		storeId,
		showArchived: false,
	});

	if (!session) {
		return (
			<GameSceneShell title="Cash Game">
				<EmptyState
					className="border-none bg-transparent"
					description="Loading session..."
					heading="Loading"
				/>
			</GameSceneShell>
		);
	}

	const ringGame = session.ringGameId
		? ringGames.find((candidate) => candidate.id === session.ringGameId)
		: undefined;

	if (!(session.ringGameId && ringGame)) {
		return (
			<GameSceneShell title="Cash Game">
				<EmptyState
					description="このセッションにはキャッシュゲームが紐付いていません。"
					heading="Game not linked"
				/>
			</GameSceneShell>
		);
	}

	const currency = currencies.find((c) => c.id === ringGame.currencyId);

	const handleUpdate = async (values: RingGameFormValues) => {
		await update({ id: ringGame.id, ...values });
		await queryClient.invalidateQueries({
			queryKey: trpc.liveCashGameSession.getById.queryOptions({ id: sessionId })
				.queryKey,
		});
		setIsEditOpen(false);
	};

	return (
		<GameSceneShell
			action={
				<Button
					onClick={() => setIsEditOpen(true)}
					size="sm"
					type="button"
					variant="outline"
				>
					<IconEdit size={14} />
					Edit
				</Button>
			}
			title="Cash Game"
		>
			<RingGameDetailsCard
				currencyName={currency?.name}
				currencyUnit={currency?.unit}
				game={ringGame}
			/>

			<ResponsiveDialog
				onOpenChange={setIsEditOpen}
				open={isEditOpen}
				title="Edit Cash Game"
			>
				<RingGameForm
					defaultValues={{
						name: ringGame.name,
						variant: ringGame.variant,
						blind1: ringGame.blind1 ?? undefined,
						blind2: ringGame.blind2 ?? undefined,
						blind3: ringGame.blind3 ?? undefined,
						ante: ringGame.ante ?? undefined,
						anteType: (ringGame.anteType ?? undefined) as
							| "all"
							| "bb"
							| "none"
							| undefined,
						minBuyIn: ringGame.minBuyIn ?? undefined,
						maxBuyIn: ringGame.maxBuyIn ?? undefined,
						tableSize: ringGame.tableSize ?? undefined,
						currencyId: ringGame.currencyId ?? undefined,
						memo: ringGame.memo ?? undefined,
					}}
					isLoading={isUpdatePending}
					onSubmit={handleUpdate}
				/>
			</ResponsiveDialog>
		</GameSceneShell>
	);
}

function TournamentStructureTable({ levels }: { levels: BlindLevelRow[] }) {
	if (levels.length === 0) {
		return (
			<p className="py-4 text-center text-muted-foreground text-xs">
				No blind levels yet.
			</p>
		);
	}

	return (
		<div className="w-full overflow-x-auto">
			<table className="w-full table-fixed border-collapse text-[11px]">
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

type TournamentDetail = NonNullable<
	ReturnType<typeof useTournamentDetail>["tournament"]
>;

interface ChipPurchaseRow {
	chips: number;
	cost: number;
	id: string;
	name: string;
}

function useTournamentDetail(tournamentId: string) {
	const tournamentQuery = useQuery({
		...trpc.tournament.getById.queryOptions({ id: tournamentId }),
		enabled: !!tournamentId,
	});
	const chipPurchasesQuery = useQuery({
		...trpc.tournamentChipPurchase.listByTournament.queryOptions({
			tournamentId,
		}),
		enabled: !!tournamentId,
	});
	const levelsQuery = useQuery({
		...trpc.blindLevel.listByTournament.queryOptions({ tournamentId }),
		enabled: !!tournamentId,
	});
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());

	return {
		tournament: tournamentQuery.data,
		isTournamentLoading: tournamentQuery.isLoading,
		chipPurchases: (chipPurchasesQuery.data ?? []) as ChipPurchaseRow[],
		levels: (levelsQuery.data ?? []) as BlindLevelRow[],
		isLevelsLoading: levelsQuery.isLoading,
		currencies: currenciesQuery.data ?? [],
	};
}

function TournamentInfoCard({
	tournament,
	currencyName,
}: {
	tournament: TournamentDetail;
	currencyName: string | null | undefined;
}) {
	const fmt = createGroupFormatter([
		tournament.buyIn,
		tournament.entryFee,
		tournament.bountyAmount,
		tournament.startingStack,
	]);

	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle className="flex flex-wrap items-center gap-1.5">
					<span className="truncate">{tournament.name}</span>
					<Badge className="px-1 py-0 text-[10px]" variant="secondary">
						{variantLabel(tournament.variant)}
					</Badge>
					{tournament.tableSize == null ? null : (
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
				</CardTitle>
			</CardHeader>
			<CardContent className="divide-y">
				<DetailRow
					label="Buy-in"
					value={tournament.buyIn == null ? "—" : fmt(tournament.buyIn)}
				/>
				<DetailRow
					label="Entry Fee"
					value={tournament.entryFee == null ? "—" : fmt(tournament.entryFee)}
				/>
				<DetailRow
					label="Starting Stack"
					value={
						tournament.startingStack == null
							? "—"
							: fmt(tournament.startingStack)
					}
				/>
				<DetailRow
					label="Bounty"
					value={
						tournament.bountyAmount == null ? "—" : fmt(tournament.bountyAmount)
					}
				/>
				<DetailRow label="Currency" value={currencyName ?? "—"} />
				{tournament.memo ? (
					<div className="py-2">
						<p className="text-muted-foreground text-xs">Memo</p>
						<p className="whitespace-pre-wrap text-sm">{tournament.memo}</p>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

function ChipPurchasesCard({
	chipPurchases,
}: {
	chipPurchases: ChipPurchaseRow[];
}) {
	if (chipPurchases.length === 0) {
		return null;
	}
	const fmt = createGroupFormatter(
		chipPurchases.flatMap((cp) => [cp.cost, cp.chips])
	);
	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>Chip Purchases</CardTitle>
			</CardHeader>
			<CardContent className="divide-y">
				{chipPurchases.map((cp) => (
					<DetailRow
						key={cp.id}
						label={cp.name}
						value={`${fmt(cp.cost)} → ${fmt(cp.chips)} chips`}
					/>
				))}
			</CardContent>
		</Card>
	);
}

function StructureCard({
	levels,
	isLoading,
}: {
	levels: BlindLevelRow[];
	isLoading: boolean;
}) {
	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>Structure</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<p className="py-2 text-center text-muted-foreground text-xs">
						Loading levels...
					</p>
				) : (
					<TournamentStructureTable levels={levels} />
				)}
			</CardContent>
		</Card>
	);
}

function toInitialFormValues(
	tournament: TournamentDetail,
	chipPurchases: ChipPurchaseRow[]
) {
	return {
		name: tournament.name,
		variant: tournament.variant,
		buyIn: tournament.buyIn ?? undefined,
		entryFee: tournament.entryFee ?? undefined,
		startingStack: tournament.startingStack ?? undefined,
		bountyAmount: tournament.bountyAmount ?? undefined,
		tableSize: tournament.tableSize ?? undefined,
		currencyId: tournament.currencyId ?? undefined,
		memo: tournament.memo ?? undefined,
		tags: tournament.tags.map((t) => t.name),
		chipPurchases: chipPurchases.map((cp) => ({
			name: cp.name,
			cost: cp.cost,
			chips: cp.chips,
		})),
	};
}

function useTournamentUpdate({
	sessionId,
	storeId,
	tournamentId,
}: {
	sessionId: string;
	storeId: string;
	tournamentId: string;
}) {
	const queryClient = useQueryClient();
	const [isSaving, setIsSaving] = useState(false);

	const save = async (
		values: TournamentFormValues,
		updatedLevels: BlindLevelRow[]
	) => {
		setIsSaving(true);
		try {
			await trpcClient.tournament.updateWithLevels.mutate({
				id: tournamentId,
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
				blindLevels: updatedLevels.map((l) => ({
					isBreak: l.isBreak,
					blind1: l.blind1,
					blind2: l.blind2,
					blind3: l.blind3,
					ante: l.ante,
					minutes: l.minutes,
				})),
			});
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: trpc.tournament.getById.queryOptions({ id: tournamentId })
						.queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: trpc.tournament.listByStore.queryOptions({
						storeId,
						includeArchived: false,
					}).queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: trpc.blindLevel.listByTournament.queryOptions({
						tournamentId,
					}).queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: trpc.tournamentChipPurchase.listByTournament.queryOptions({
						tournamentId,
					}).queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: trpc.liveTournamentSession.getById.queryOptions({
						id: sessionId,
					}).queryKey,
				}),
			]);
		} finally {
			setIsSaving(false);
		}
	};

	return { save, isSaving };
}

function TournamentDetailsBody({
	sessionId,
	storeId,
	tournament,
	chipPurchases,
	levels,
	isLevelsLoading,
	currencyName,
}: {
	sessionId: string;
	storeId: string;
	tournament: TournamentDetail;
	chipPurchases: ChipPurchaseRow[];
	levels: BlindLevelRow[];
	isLevelsLoading: boolean;
	currencyName: string | null | undefined;
}) {
	const [isEditOpen, setIsEditOpen] = useState(false);
	const { save, isSaving } = useTournamentUpdate({
		sessionId,
		storeId,
		tournamentId: tournament.id,
	});
	const { isUpdateWithLevelsPending } = useTournaments({
		storeId,
		showArchived: false,
	});

	const handleSave = async (
		values: TournamentFormValues,
		updatedLevels: BlindLevelRow[]
	) => {
		await save(values, updatedLevels);
		setIsEditOpen(false);
	};

	return (
		<GameSceneShell
			action={
				<Button
					onClick={() => setIsEditOpen(true)}
					size="sm"
					type="button"
					variant="outline"
				>
					<IconEdit size={14} />
					Edit
				</Button>
			}
			title="Tournament"
		>
			<TournamentInfoCard currencyName={currencyName} tournament={tournament} />
			<ChipPurchasesCard chipPurchases={chipPurchases} />
			<StructureCard isLoading={isLevelsLoading} levels={levels} />

			<ResponsiveDialog
				fullHeight
				onOpenChange={setIsEditOpen}
				open={isEditOpen}
				title="Edit Tournament"
			>
				<TournamentModalContent
					initialBlindLevels={levels}
					initialFormValues={toInitialFormValues(tournament, chipPurchases)}
					isLoading={isSaving || isUpdateWithLevelsPending}
					key={tournament.id}
					onSave={handleSave}
				/>
			</ResponsiveDialog>
		</GameSceneShell>
	);
}

function TournamentDetails({ sessionId }: { sessionId: string }) {
	const { session } = useTournamentSession(sessionId);
	const tournamentId = session?.tournamentId ?? "";
	const storeId = session?.storeId ?? "";
	const detail = useTournamentDetail(tournamentId);

	if (!session) {
		return (
			<GameSceneShell title="Tournament">
				<EmptyState
					className="border-none bg-transparent"
					description="Loading session..."
					heading="Loading"
				/>
			</GameSceneShell>
		);
	}

	if (!(tournamentId && storeId)) {
		return (
			<GameSceneShell title="Tournament">
				<EmptyState
					description="このセッションにはトーナメントが紐付いていません。"
					heading="Game not linked"
				/>
			</GameSceneShell>
		);
	}

	if (detail.isTournamentLoading || !detail.tournament) {
		return (
			<GameSceneShell title="Tournament">
				<EmptyState
					className="border-none bg-transparent"
					description="Loading tournament details..."
					heading="Loading"
				/>
			</GameSceneShell>
		);
	}

	const currency = detail.currencies.find(
		(c) => c.id === detail.tournament?.currencyId
	);

	return (
		<TournamentDetailsBody
			chipPurchases={detail.chipPurchases}
			currencyName={currency?.name}
			isLevelsLoading={detail.isLevelsLoading}
			levels={detail.levels}
			sessionId={sessionId}
			storeId={storeId}
			tournament={detail.tournament}
		/>
	);
}

export function ActiveSessionGameScene() {
	const { activeSession, isLoading } = useActiveSession();

	if (isLoading) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<EmptyState
					className="border-none bg-transparent py-0"
					description="Fetching the current active session."
					heading="Loading..."
				/>
			</div>
		);
	}

	if (!activeSession) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<EmptyState
					className="border-none bg-transparent py-0"
					description="Start a live session from the sessions screen."
					heading="No active session"
				/>
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100dvh-4rem)] flex-col px-4 pt-2 pb-0 md:px-6 md:pt-4">
			{activeSession.type === "cash_game" ? (
				<CashGameDetails sessionId={activeSession.id} />
			) : (
				<TournamentDetails sessionId={activeSession.id} />
			)}
		</div>
	);
}

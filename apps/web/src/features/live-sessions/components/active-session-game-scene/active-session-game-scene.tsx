import { IconEdit } from "@tabler/icons-react";
import { AssignRingGameDialog } from "@/features/live-sessions/components/assign-ring-game-dialog";
import { AssignTournamentDialog } from "@/features/live-sessions/components/assign-tournament-dialog";
import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";
import { useAssignDialogState } from "@/features/live-sessions/hooks/use-assign-dialog-state";
import { useCashGameSession } from "@/features/live-sessions/hooks/use-cash-game-session";
import { useRingGameSceneActions } from "@/features/live-sessions/hooks/use-ring-game-scene-actions";
import {
	type ChipPurchaseRow,
	type TournamentDetail,
	useTournamentDetail,
} from "@/features/live-sessions/hooks/use-tournament-detail";
import { useTournamentSceneActions } from "@/features/live-sessions/hooks/use-tournament-scene-actions";
import { useTournamentSession } from "@/features/live-sessions/hooks/use-tournament-session";
import {
	formatAnteSuffix,
	formatBlindParts,
	variantLabel,
} from "@/features/live-sessions/utils/game-scene-formatters";
import { RingGameForm } from "@/features/stores/components/ring-game-form";
import { TournamentEditDialog } from "@/features/stores/components/tournament-edit-dialog";
import type { BlindLevelRow } from "@/features/stores/hooks/use-blind-levels";
import type { RingGame } from "@/features/stores/hooks/use-ring-games";
import { PageHeader } from "@/shared/components/page-header";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";
import { createGroupFormatter } from "@/utils/format-number";
import { getTableSizeClassName } from "@/utils/table-size-colors";

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
		<div className="flex flex-col gap-3 pb-6">
			<PageHeader actions={action} heading={title} size="compact" />
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

function CashGameNotLinked({
	sessionId,
	sessionStoreId,
}: {
	sessionId: string;
	sessionStoreId: string | null;
}) {
	const { isAssignOpen, setIsAssignOpen } = useAssignDialogState();
	return (
		<GameSceneShell title="Cash Game">
			<EmptyState
				action={
					<Button onClick={() => setIsAssignOpen(true)} size="sm" type="button">
						Select or create a game
					</Button>
				}
				description="No cash game is linked to this session."
				heading="Game not linked"
			/>
			<AssignRingGameDialog
				onOpenChange={setIsAssignOpen}
				open={isAssignOpen}
				sessionId={sessionId}
				sessionStoreId={sessionStoreId}
			/>
		</GameSceneShell>
	);
}

function CashGameDetails({ sessionId }: { sessionId: string }) {
	const { session, ringGames } = useCashGameSession(sessionId);
	const storeId = session?.storeId ?? "";
	const ringGameId = session?.ringGameId ?? "";

	const {
		isEditOpen,
		setIsEditOpen,
		handleUpdate,
		isUpdatePending,
		currencies,
	} = useRingGameSceneActions({
		ringGameId,
		sessionId,
		storeId,
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
			<CashGameNotLinked
				sessionId={sessionId}
				sessionStoreId={session.storeId ?? null}
			/>
		);
	}

	const currency = currencies.find((c) => c.id === ringGame.currencyId);

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
		<Table className="table-fixed text-[11px]">
			<TableHeader>
				<TableRow>
					<TableHead className="h-auto w-6 pb-0.5 text-center font-medium text-muted-foreground">
						#
					</TableHead>
					<TableHead className="h-auto pb-0.5 text-center font-medium text-muted-foreground">
						SB
					</TableHead>
					<TableHead className="h-auto pb-0.5 text-center font-medium text-muted-foreground">
						BB
					</TableHead>
					<TableHead className="h-auto pb-0.5 text-center font-medium text-muted-foreground">
						Ante
					</TableHead>
					<TableHead className="h-auto w-8 pb-0.5 text-center font-medium text-muted-foreground">
						Min
					</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{levels.map((row) => {
					if (row.isBreak) {
						return (
							<TableRow className="bg-muted/30" key={row.id}>
								<TableCell className="py-0.5 text-center text-muted-foreground">
									{row.level}
								</TableCell>
								<TableCell
									className="py-0.5 text-center text-muted-foreground"
									colSpan={3}
								>
									Break
								</TableCell>
								<TableCell className="py-0.5 text-center text-muted-foreground">
									{row.minutes ?? "—"}
								</TableCell>
							</TableRow>
						);
					}
					const fmt = createGroupFormatter([row.blind1, row.blind2, row.ante]);
					return (
						<TableRow key={row.id}>
							<TableCell className="py-0.5 text-center text-muted-foreground">
								{row.level}
							</TableCell>
							<TableCell className="py-0.5 text-center">
								{row.blind1 == null ? "—" : fmt(row.blind1)}
							</TableCell>
							<TableCell className="py-0.5 text-center">
								{row.blind2 == null ? "—" : fmt(row.blind2)}
							</TableCell>
							<TableCell className="py-0.5 text-center">
								{row.ante == null ? "—" : fmt(row.ante)}
							</TableCell>
							<TableCell className="py-0.5 text-center text-muted-foreground">
								{row.minutes ?? "—"}
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
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
	const {
		isEditOpen,
		setIsEditOpen,
		handleSave,
		isSaving,
		isUpdateWithLevelsPending,
	} = useTournamentSceneActions({
		sessionId,
		storeId,
		tournamentId: tournament.id,
	});

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

			<TournamentEditDialog
				aiMode="edit"
				initialBlindLevels={levels}
				initialFormValues={toInitialFormValues(tournament, chipPurchases)}
				isLoading={isSaving || isUpdateWithLevelsPending}
				onOpenChange={setIsEditOpen}
				onSave={handleSave}
				open={isEditOpen}
				resetKey={tournament.id}
				title="Edit Tournament"
			/>
		</GameSceneShell>
	);
}

function TournamentNotLinked({
	sessionId,
	sessionStoreId,
}: {
	sessionId: string;
	sessionStoreId: string | null;
}) {
	const { isAssignOpen, setIsAssignOpen } = useAssignDialogState();
	return (
		<GameSceneShell title="Tournament">
			<EmptyState
				action={
					<Button onClick={() => setIsAssignOpen(true)} size="sm" type="button">
						Select or create a tournament
					</Button>
				}
				description="No tournament is linked to this session."
				heading="Game not linked"
			/>
			<AssignTournamentDialog
				onOpenChange={setIsAssignOpen}
				open={isAssignOpen}
				sessionId={sessionId}
				sessionStoreId={sessionStoreId}
			/>
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

	if (!tournamentId) {
		return (
			<TournamentNotLinked
				sessionId={sessionId}
				sessionStoreId={session.storeId ?? null}
			/>
		);
	}

	if (!storeId) {
		return (
			<GameSceneShell title="Tournament">
				<EmptyState
					description="No tournament is linked to this session."
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
		<div className="flex flex-col px-4 pt-2 pb-0 md:px-6 md:pt-4">
			{activeSession.type === "cash_game" ? (
				<CashGameDetails sessionId={activeSession.id} />
			) : (
				<TournamentDetails sessionId={activeSession.id} />
			)}
		</div>
	);
}

import { IconEdit } from "@tabler/icons-react";
import { AssignRingGameDialog } from "@/features/live-sessions/components/assign-ring-game-dialog";
import { AssignTournamentDialog } from "@/features/live-sessions/components/assign-tournament-dialog";
import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";
import { useAssignDialogState } from "@/features/live-sessions/hooks/use-assign-dialog-state";
import { useCashGameSession } from "@/features/live-sessions/hooks/use-cash-game-session";
import { useRingGameSceneActions } from "@/features/live-sessions/hooks/use-ring-game-scene-actions";
import {
	type SessionBlindLevelRow,
	type SessionChipPurchaseRow,
	type SessionTournamentDisplay,
	useSessionTournamentStructure,
} from "@/features/live-sessions/hooks/use-session-tournament-structure";
import {
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
		<div className="flex flex-col gap-3">
			<PageHeader actions={action} heading={title} />
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

interface StructureLevel {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	id: string;
	isBreak: boolean;
	level: number;
	minutes: number | null;
}

function TournamentStructureTable({ levels }: { levels: StructureLevel[] }) {
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
	display,
	master,
	currencyName,
}: {
	display: SessionTournamentDisplay;
	master: TournamentDetail;
	currencyName: string | null | undefined;
}) {
	const fmt = createGroupFormatter([
		display.buyIn,
		display.entryFee,
		display.bountyAmount,
		display.startingStack,
	]);

	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle className="flex flex-wrap items-center gap-1.5">
					<span className="truncate">{display.ruleName}</span>
					<Badge className="px-1 py-0 text-[10px]" variant="secondary">
						{variantLabel(display.variant)}
					</Badge>
					{display.tableSize == null ? null : (
						<Badge
							className={`px-1 py-0 text-[10px] ${getTableSizeClassName(display.tableSize)}`}
						>
							{display.tableSize}-max
						</Badge>
					)}
					{master.tags.map((tag) => (
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
					value={display.buyIn == null ? "—" : fmt(display.buyIn)}
				/>
				<DetailRow
					label="Entry Fee"
					value={display.entryFee == null ? "—" : fmt(display.entryFee)}
				/>
				<DetailRow
					label="Starting Stack"
					value={
						display.startingStack == null ? "—" : fmt(display.startingStack)
					}
				/>
				<DetailRow
					label="Bounty"
					value={display.bountyAmount == null ? "—" : fmt(display.bountyAmount)}
				/>
				<DetailRow label="Currency" value={currencyName ?? "—"} />
				{master.memo ? (
					<div className="py-2">
						<p className="text-muted-foreground text-xs">Memo</p>
						<p className="whitespace-pre-wrap text-sm">{master.memo}</p>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

function ChipPurchasesCard({
	chipPurchases,
}: {
	chipPurchases: SessionChipPurchaseRow[];
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
	levels: StructureLevel[];
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
	master: TournamentDetail,
	masterChipPurchases: Array<{ name: string; cost: number; chips: number }>
) {
	return {
		name: master.name,
		variant: master.variant,
		buyIn: master.buyIn ?? undefined,
		entryFee: master.entryFee ?? undefined,
		startingStack: master.startingStack ?? undefined,
		bountyAmount: master.bountyAmount ?? undefined,
		tableSize: master.tableSize ?? undefined,
		currencyId: master.currencyId ?? undefined,
		memo: master.memo ?? undefined,
		tags: master.tags.map((t) => t.name),
		chipPurchases: masterChipPurchases.map((cp) => ({
			name: cp.name,
			cost: cp.cost,
			chips: cp.chips,
		})),
	};
}

function TournamentDetailsBody({
	sessionId,
	storeId,
	display,
	displayChipPurchases,
	displayLevels,
	isLevelsLoading,
	currencyName,
	master,
	masterChipPurchases,
	masterLevels,
}: {
	sessionId: string;
	storeId: string;
	display: SessionTournamentDisplay;
	displayChipPurchases: SessionChipPurchaseRow[];
	displayLevels: SessionBlindLevelRow[];
	isLevelsLoading: boolean;
	currencyName: string | null | undefined;
	master: TournamentDetail;
	masterChipPurchases: Array<{ name: string; cost: number; chips: number }>;
	masterLevels: BlindLevelRow[];
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
		tournamentId: master.id,
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
			<TournamentInfoCard
				currencyName={currencyName}
				display={display}
				master={master}
			/>
			<ChipPurchasesCard chipPurchases={displayChipPurchases} />
			<StructureCard isLoading={isLevelsLoading} levels={displayLevels} />

			<TournamentEditDialog
				aiMode="edit"
				initialBlindLevels={masterLevels}
				initialFormValues={toInitialFormValues(master, masterChipPurchases)}
				isLoading={isSaving || isUpdateWithLevelsPending}
				onOpenChange={setIsEditOpen}
				onSave={handleSave}
				open={isEditOpen}
				resetKey={master.id}
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
	const snapshot = useSessionTournamentStructure(sessionId);
	const master = useTournamentDetail(tournamentId);

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

	if (master.isTournamentLoading || !master.tournament || !snapshot.display) {
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

	const currency = master.currencies.find(
		(c) => c.id === master.tournament?.currencyId
	);

	return (
		<TournamentDetailsBody
			currencyName={currency?.name}
			display={snapshot.display}
			displayChipPurchases={snapshot.chipPurchases}
			displayLevels={snapshot.blindLevels}
			isLevelsLoading={master.isLevelsLoading}
			master={master.tournament}
			masterChipPurchases={master.chipPurchases}
			masterLevels={master.levels}
			sessionId={sessionId}
			storeId={storeId}
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
		<div className="flex flex-col p-4 md:p-6">
			{activeSession.type === "cash_game" ? (
				<CashGameDetails sessionId={activeSession.id} />
			) : (
				<TournamentDetails sessionId={activeSession.id} />
			)}
		</div>
	);
}

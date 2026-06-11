import { IconEdit } from "@tabler/icons-react";
import { AssignRingGameDialog } from "@/features/live-sessions/components/assign-ring-game-dialog";
import { AssignTournamentDialog } from "@/features/live-sessions/components/assign-tournament-dialog";
import { ModifiedBadge } from "@/features/live-sessions/components/modified-badge";
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
import {
	diffBlindLevels,
	diffCashSnapshot,
	diffChipPurchases,
	diffTournamentSnapshot,
} from "@/features/live-sessions/utils/snapshot-diff";
import { RingGameForm } from "@/features/rooms/components/ring-game-form";
import { TournamentFormSheet } from "@/features/rooms/components/tournament-form-sheet";
import type { RingGame } from "@/features/rooms/hooks/use-ring-games";
import { FormSheet } from "@/shared/components/form-sheet";
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

const EDIT_RING_GAME_FORM_ID = "edit-ring-game-form";
const EDIT_TOURNAMENT_FORM_ID = "edit-tournament-form";

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
	badge,
}: {
	label: string;
	value: React.ReactNode;
	badge?: React.ReactNode;
}) {
	return (
		<div className="flex items-baseline justify-between gap-4 py-1">
			<span className="text-muted-foreground text-xs">{label}</span>
			<span className="flex items-baseline gap-1.5 text-right font-medium text-sm">
				{badge}
				{value}
			</span>
		</div>
	);
}

interface CashSnapshotDisplay {
	ante: number | null;
	anteType: string | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	maxBuyIn: number | null;
	minBuyIn: number | null;
	ruleName: string;
	tableSize: number | null;
	variant: string;
}

function RingGameCardTitle({
	snapshot,
	master,
	diff,
}: {
	snapshot: CashSnapshotDisplay;
	master: RingGame;
	diff: import("@/features/live-sessions/utils/snapshot-diff").DiffMap<
		import("@/features/live-sessions/utils/snapshot-diff").CashDiffField
	>;
}) {
	return (
		<CardTitle className="flex flex-wrap items-center gap-1.5">
			<span className="truncate">{snapshot.ruleName}</span>
			{diff.ruleName ? <ModifiedBadge masterValue={master.name} /> : null}
			<Badge className="px-1 py-0 text-[10px]" variant="secondary">
				{variantLabel(snapshot.variant)}
			</Badge>
			{diff.variant ? (
				<ModifiedBadge masterValue={variantLabel(master.variant)} />
			) : null}
			{snapshot.tableSize == null ? null : (
				<Badge
					className={`px-1 py-0 text-[10px] ${getTableSizeClassName(snapshot.tableSize)}`}
				>
					{snapshot.tableSize}-max
				</Badge>
			)}
			{diff.tableSize ? (
				<ModifiedBadge
					masterValue={
						master.tableSize == null ? "—" : String(master.tableSize)
					}
				/>
			) : null}
		</CardTitle>
	);
}

function RingGameDetailsCard({
	snapshot,
	master,
	currencyUnit,
	currencyName,
	diff,
}: {
	snapshot: CashSnapshotDisplay;
	master: RingGame;
	currencyUnit: string | null | undefined;
	currencyName: string | null | undefined;
	diff: import("@/features/live-sessions/utils/snapshot-diff").DiffMap<
		import("@/features/live-sessions/utils/snapshot-diff").CashDiffField
	>;
}) {
	const blindsStr = formatBlindParts(snapshot);
	const anteStr = formatAnteSuffix(snapshot);
	const fmt = createGroupFormatter([snapshot.minBuyIn, snapshot.maxBuyIn]);
	const buyInStr = (() => {
		if (snapshot.minBuyIn == null && snapshot.maxBuyIn == null) {
			return "—";
		}
		const min = snapshot.minBuyIn == null ? "—" : fmt(snapshot.minBuyIn);
		const max = snapshot.maxBuyIn == null ? "—" : fmt(snapshot.maxBuyIn);
		return `${min} - ${max}${currencyUnit ? ` ${currencyUnit}` : ""}`;
	})();
	const blindsModified =
		diff.blind1 || diff.blind2 || diff.blind3 || diff.ante || diff.anteType;
	const buyInModified = diff.minBuyIn || diff.maxBuyIn;

	return (
		<Card size="sm">
			<CardHeader>
				<RingGameCardTitle diff={diff} master={master} snapshot={snapshot} />
			</CardHeader>
			<CardContent className="divide-y">
				<DetailRow
					badge={
						blindsModified ? (
							<ModifiedBadge masterValue={formatBlindParts(master) || "—"} />
						) : null
					}
					label="Blinds"
					value={
						blindsStr
							? `${blindsStr}${anteStr ? ` ${anteStr}` : ""}${currencyUnit ? ` ${currencyUnit}` : ""}`
							: "—"
					}
				/>
				<DetailRow
					badge={
						buyInModified ? (
							<ModifiedBadge
								masterValue={`${master.minBuyIn ?? "—"} - ${master.maxBuyIn ?? "—"}`}
							/>
						) : null
					}
					label="Buy-in"
					value={buyInStr}
				/>
				<DetailRow
					label="Table"
					value={snapshot.tableSize == null ? "—" : `${snapshot.tableSize}-max`}
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

function CashGameNotLinked({
	sessionId,
	sessionRoomId,
}: {
	sessionId: string;
	sessionRoomId: string | null;
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
				sessionRoomId={sessionRoomId}
			/>
		</GameSceneShell>
	);
}

function CashGameDetails({ sessionId }: { sessionId: string }) {
	const { session, ringGames } = useCashGameSession(sessionId);

	const {
		isEditOpen,
		setIsEditOpen,
		handleUpdate,
		isUpdatePending,
		currencies,
	} = useRingGameSceneActions({
		sessionId,
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

	if (
		!(
			session.ringGameId &&
			ringGame &&
			session.ruleName != null &&
			session.variant != null
		)
	) {
		return (
			<CashGameNotLinked
				sessionId={sessionId}
				sessionRoomId={session.roomId ?? null}
			/>
		);
	}

	const snapshot: CashSnapshotDisplay = {
		ruleName: session.ruleName,
		variant: session.variant,
		blind1: session.blind1,
		blind2: session.blind2,
		blind3: session.blind3,
		ante: session.ante,
		anteType: session.anteType,
		minBuyIn: session.minBuyIn,
		maxBuyIn: session.maxBuyIn,
		tableSize: session.tableSize,
	};
	const diff = diffCashSnapshot(snapshot, ringGame);

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
				diff={diff}
				master={ringGame}
				snapshot={snapshot}
			/>

			<FormSheet
				formId={EDIT_RING_GAME_FORM_ID}
				isLoading={isUpdatePending}
				onOpenChange={setIsEditOpen}
				open={isEditOpen}
				title="Edit Cash Game"
			>
				<RingGameForm
					defaultValues={{
						name: snapshot.ruleName,
						variant: snapshot.variant,
						blind1: snapshot.blind1 ?? undefined,
						blind2: snapshot.blind2 ?? undefined,
						blind3: snapshot.blind3 ?? undefined,
						ante: snapshot.ante ?? undefined,
						anteType: (snapshot.anteType ?? undefined) as
							| "all"
							| "bb"
							| "none"
							| undefined,
						minBuyIn: snapshot.minBuyIn ?? undefined,
						maxBuyIn: snapshot.maxBuyIn ?? undefined,
						tableSize: snapshot.tableSize ?? undefined,
						currencyId: ringGame.currencyId ?? undefined,
						memo: ringGame.memo ?? undefined,
					}}
					formId={EDIT_RING_GAME_FORM_ID}
					onSubmit={handleUpdate}
				/>
			</FormSheet>
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

function fmtForBadge(value: number | null): string {
	return value == null ? "—" : String(value);
}

function TournamentInfoCard({
	display,
	master,
	currencyName,
	diff,
}: {
	display: SessionTournamentDisplay;
	master: TournamentDetail;
	currencyName: string | null | undefined;
	diff: import("@/features/live-sessions/utils/snapshot-diff").DiffMap<
		import("@/features/live-sessions/utils/snapshot-diff").TournamentDiffField
	>;
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
					{diff.ruleName ? <ModifiedBadge masterValue={master.name} /> : null}
					<Badge className="px-1 py-0 text-[10px]" variant="secondary">
						{variantLabel(display.variant)}
					</Badge>
					{diff.variant ? (
						<ModifiedBadge masterValue={variantLabel(master.variant)} />
					) : null}
					{display.tableSize == null ? null : (
						<Badge
							className={`px-1 py-0 text-[10px] ${getTableSizeClassName(display.tableSize)}`}
						>
							{display.tableSize}-max
						</Badge>
					)}
					{diff.tableSize ? (
						<ModifiedBadge masterValue={fmtForBadge(master.tableSize)} />
					) : null}
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
					badge={
						diff.buyIn ? (
							<ModifiedBadge masterValue={fmtForBadge(master.buyIn)} />
						) : null
					}
					label="Buy-in"
					value={display.buyIn == null ? "—" : fmt(display.buyIn)}
				/>
				<DetailRow
					badge={
						diff.entryFee ? (
							<ModifiedBadge masterValue={fmtForBadge(master.entryFee)} />
						) : null
					}
					label="Entry Fee"
					value={display.entryFee == null ? "—" : fmt(display.entryFee)}
				/>
				<DetailRow
					badge={
						diff.startingStack ? (
							<ModifiedBadge masterValue={fmtForBadge(master.startingStack)} />
						) : null
					}
					label="Starting Stack"
					value={
						display.startingStack == null ? "—" : fmt(display.startingStack)
					}
				/>
				<DetailRow
					badge={
						diff.bountyAmount ? (
							<ModifiedBadge masterValue={fmtForBadge(master.bountyAmount)} />
						) : null
					}
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
	isModified,
}: {
	chipPurchases: SessionChipPurchaseRow[];
	isModified: boolean;
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
				<CardTitle className="flex items-center gap-1.5">
					Chip Purchases
					{isModified ? (
						<ModifiedBadge masterValue="differs from master" />
					) : null}
				</CardTitle>
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
	isModified,
}: {
	levels: StructureLevel[];
	isLoading: boolean;
	isModified: boolean;
}) {
	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle className="flex items-center gap-1.5">
					Structure
					{isModified ? (
						<ModifiedBadge masterValue="differs from master" />
					) : null}
				</CardTitle>
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
	display: SessionTournamentDisplay,
	displayChipPurchases: SessionChipPurchaseRow[],
	master: TournamentDetail
) {
	// Form is populated from the SESSION snapshot so the user edits per-
	// session overrides. tags / memo / currencyId fall back to master since
	// they are not part of the rule snapshot.
	return {
		name: display.ruleName,
		variant: display.variant,
		buyIn: display.buyIn ?? undefined,
		entryFee: display.entryFee ?? undefined,
		startingStack: display.startingStack ?? undefined,
		bountyAmount: display.bountyAmount ?? undefined,
		tableSize: display.tableSize ?? undefined,
		currencyId: master.currencyId ?? undefined,
		memo: master.memo ?? undefined,
		tags: master.tags.map((t) => t.name),
		chipPurchases: displayChipPurchases.map((cp) => ({
			name: cp.name,
			cost: cp.cost,
			chips: cp.chips,
		})),
	};
}

function TournamentDetailsBody({
	sessionId,
	display,
	displayChipPurchases,
	displayLevels,
	isLevelsLoading,
	currencyName,
	master,
	diff,
	levelsModified,
	chipPurchasesModified,
}: {
	sessionId: string;
	display: SessionTournamentDisplay;
	displayChipPurchases: SessionChipPurchaseRow[];
	displayLevels: SessionBlindLevelRow[];
	isLevelsLoading: boolean;
	currencyName: string | null | undefined;
	master: TournamentDetail;
	diff: import("@/features/live-sessions/utils/snapshot-diff").DiffMap<
		import("@/features/live-sessions/utils/snapshot-diff").TournamentDiffField
	>;
	levelsModified: boolean;
	chipPurchasesModified: boolean;
}) {
	const {
		isEditOpen,
		setIsEditOpen,
		handleSave,
		isSaving,
		isUpdateWithLevelsPending,
	} = useTournamentSceneActions({
		sessionId,
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
				diff={diff}
				display={display}
				master={master}
			/>
			<ChipPurchasesCard
				chipPurchases={displayChipPurchases}
				isModified={chipPurchasesModified}
			/>
			<StructureCard
				isLoading={isLevelsLoading}
				isModified={levelsModified}
				levels={displayLevels}
			/>

			<TournamentFormSheet
				aiMode="edit"
				formId={EDIT_TOURNAMENT_FORM_ID}
				initialBlindLevels={displayLevels.map((l) => ({
					ante: l.ante,
					blind1: l.blind1,
					blind2: l.blind2,
					blind3: l.blind3,
					id: l.id,
					isBreak: l.isBreak,
					level: l.level,
					minutes: l.minutes,
					tournamentId: master.id,
				}))}
				initialFormValues={toInitialFormValues(
					display,
					displayChipPurchases,
					master
				)}
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
	sessionRoomId,
}: {
	sessionId: string;
	sessionRoomId: string | null;
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
				sessionRoomId={sessionRoomId}
			/>
		</GameSceneShell>
	);
}

function TournamentDetails({ sessionId }: { sessionId: string }) {
	const { session } = useTournamentSession(sessionId);
	const tournamentId = session?.tournamentId ?? "";
	const roomId = session?.roomId ?? "";
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
				sessionRoomId={session.roomId ?? null}
			/>
		);
	}

	if (!roomId) {
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
	const diff = diffTournamentSnapshot(snapshot.display, master.tournament);
	const levelsModified = diffBlindLevels(snapshot.blindLevels, master.levels);
	const chipPurchasesModified = diffChipPurchases(
		snapshot.chipPurchases,
		master.chipPurchases
	);

	return (
		<TournamentDetailsBody
			chipPurchasesModified={chipPurchasesModified}
			currencyName={currency?.name}
			diff={diff}
			display={snapshot.display}
			displayChipPurchases={snapshot.chipPurchases}
			displayLevels={snapshot.blindLevels}
			isLevelsLoading={master.isLevelsLoading}
			levelsModified={levelsModified}
			master={master.tournament}
			sessionId={sessionId}
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

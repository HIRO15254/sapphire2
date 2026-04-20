import {
	TABLE_PLAYER_SOURCE_APPS,
	type TablePlayerSourceApp,
} from "@sapphire2/api/routers/ai-extract-sources";
import {
	IconAlertTriangle,
	IconChevronDown,
	IconLoader2,
	IconPhotoUp,
	IconSparkles,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Input } from "@/shared/components/ui/input";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/shared/components/ui/popover";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

type SessionParam =
	| { liveCashGameSessionId: string; liveTournamentSessionId?: never }
	| { liveCashGameSessionId?: never; liveTournamentSessionId: string };

interface SeatFromScreenshotSheetProps {
	heroSeatPosition: number | null;
	occupiedSeatPositions: Set<number>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionParam: SessionParam;
}

type Step = "select-app" | "upload" | "review";

type RowAction = "existing" | "new" | "hero" | "skip";

interface PlayerOption {
	id: string;
	name: string;
}

interface ReviewRow {
	action: RowAction;
	ambiguous: boolean;
	existingPlayerId: string | null;
	isHeroCandidate: boolean;
	matchedPlayerName: string | null;
	name: string;
	rowId: string;
	seatNumber: number;
	seatPosition: number;
	warning: string | null;
}

const ACCEPTED_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
] as const;
type AcceptedMediaType = (typeof ACCEPTED_TYPES)[number];

function isAcceptedMediaType(type: string): type is AcceptedMediaType {
	return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			resolve(result.split(",")[1] ?? "");
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

function normalizeName(name: string): string {
	return name.trim().toLowerCase();
}

const SOURCE_APP_ENTRIES = Object.entries(TABLE_PLAYER_SOURCE_APPS) as [
	TablePlayerSourceApp,
	(typeof TABLE_PLAYER_SOURCE_APPS)[TablePlayerSourceApp],
][];

function applyRowAction(
	row: ReviewRow,
	targetRowId: string,
	nextAction: RowAction
): ReviewRow {
	if (row.rowId !== targetRowId) {
		if (nextAction === "hero" && row.action === "hero") {
			return {
				...row,
				action: row.existingPlayerId ? "existing" : "new",
			};
		}
		return row;
	}
	if (row.ambiguous && nextAction === "existing") {
		return row;
	}
	return { ...row, action: nextAction };
}

async function applyRow(
	row: ReviewRow,
	sessionParam: SessionParam
): Promise<boolean> {
	try {
		if (row.action === "hero") {
			await updateHeroSeatViaClient(sessionParam, row.seatPosition);
		} else if (row.action === "existing" && row.existingPlayerId) {
			await trpcClient.sessionTablePlayer.add.mutate({
				...sessionParam,
				playerId: row.existingPlayerId,
				seatPosition: row.seatPosition,
			});
		} else if (row.action === "new") {
			await trpcClient.sessionTablePlayer.addNew.mutate({
				...sessionParam,
				playerName: row.name.trim(),
				seatPosition: row.seatPosition,
			});
		}
		return true;
	} catch {
		return false;
	}
}

function updateHeroSeatViaClient(
	sessionParam: SessionParam,
	heroSeatPosition: number | null
): Promise<unknown> {
	if (sessionParam.liveCashGameSessionId !== undefined) {
		return trpcClient.liveCashGameSession.updateHeroSeat.mutate({
			id: sessionParam.liveCashGameSessionId,
			heroSeatPosition,
		});
	}
	if (sessionParam.liveTournamentSessionId !== undefined) {
		return trpcClient.liveTournamentSession.updateHeroSeat.mutate({
			id: sessionParam.liveTournamentSessionId,
			heroSeatPosition,
		});
	}
	throw new Error("Invalid sessionParam: neither cash game nor tournament");
}

export function SeatFromScreenshotSheet({
	heroSeatPosition,
	occupiedSeatPositions,
	onOpenChange,
	open,
	sessionParam,
}: SeatFromScreenshotSheetProps) {
	const queryClient = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [step, setStep] = useState<Step>("select-app");
	const [sourceApp, setSourceApp] = useState<TablePlayerSourceApp>(
		SOURCE_APP_ENTRIES[0][0]
	);
	const [rows, setRows] = useState<ReviewRow[]>([]);
	const [isApplying, setIsApplying] = useState(false);

	const playersQuery = useQuery({
		...trpc.player.list.queryOptions(),
		enabled: open,
	});
	const allPlayers = useMemo<PlayerOption[]>(
		() => playersQuery.data ?? [],
		[playersQuery.data]
	);

	const playersByNormalizedName = useMemo(() => {
		const map = new Map<
			string,
			{ id: string; name: string; count: number }[]
		>();
		for (const p of allPlayers) {
			const key = normalizeName(p.name);
			const bucket = map.get(key) ?? [];
			bucket.push({ id: p.id, name: p.name, count: bucket.length + 1 });
			map.set(key, bucket);
		}
		return map;
	}, [allPlayers]);

	const extractMutation = useMutation(
		trpc.aiExtract.extractTablePlayers.mutationOptions()
	);
	const extractReset = extractMutation.reset;

	useEffect(() => {
		if (open) {
			setStep("select-app");
			setSourceApp(SOURCE_APP_ENTRIES[0][0]);
			setRows([]);
			extractReset();
			setIsApplying(false);
		}
	}, [open, extractReset]);

	const handleSourceAppSelect = (nextApp: TablePlayerSourceApp) => {
		setSourceApp(nextApp);
		setStep("upload");
	};

	const handlePickFile = () => {
		fileInputRef.current?.click();
	};

	const handleImageSelected = async (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) {
			return;
		}
		const mediaType = file.type;
		if (!isAcceptedMediaType(mediaType)) {
			toast.error("Only JPEG, PNG, GIF, or WEBP images are supported.");
			return;
		}

		try {
			const base64 = await fileToBase64(file);
			const result = await extractMutation.mutateAsync({
				sourceApp,
				sources: [{ kind: "image", data: base64, mediaType }],
			});

			const seenSeatNumbers = new Set<number>();
			let heroAssigned = false;
			const built: ReviewRow[] = [];
			for (const seat of result.seats) {
				if (seenSeatNumbers.has(seat.seatNumber)) {
					continue;
				}
				seenSeatNumbers.add(seat.seatNumber);
				const seatPosition = seat.seatNumber - 1;
				const isHero = seat.isHero === true && !heroAssigned;
				if (isHero) {
					heroAssigned = true;
				}
				const row = buildRow({
					isHero,
					name: seat.name,
					occupiedSeatPositions,
					playersByNormalizedName,
					seatNumber: seat.seatNumber,
					seatPosition,
				});
				built.push(row);
			}
			setRows(built);
			setStep("review");
		} catch {
			// toast already handled by MutationCache.onError
		}
	};

	const handleRowNameChange = (rowId: string, nextName: string) => {
		setRows((prev) =>
			prev.map((row) => {
				if (row.rowId !== rowId) {
					return row;
				}
				const trimmed = nextName.trim();
				const nextAction: RowAction = trimmed === "" ? "skip" : "new";
				return buildRow({
					isHero: row.isHeroCandidate,
					name: nextName,
					occupiedSeatPositions,
					playersByNormalizedName,
					preferredAction: nextAction,
					seatNumber: row.seatNumber,
					seatPosition: row.seatPosition,
				});
			})
		);
	};

	const handleRowSelectExisting = (rowId: string, player: PlayerOption) => {
		setRows((prev) =>
			prev.map((row) => {
				if (row.rowId !== rowId) {
					return row;
				}
				return {
					...row,
					action: "existing",
					existingPlayerId: player.id,
					matchedPlayerName: player.name,
					name: player.name,
					ambiguous: false,
				};
			})
		);
	};

	const handleRowActionChange = (rowId: string, nextAction: RowAction) => {
		setRows((prev) =>
			prev.map((row) => applyRowAction(row, rowId, nextAction))
		);
	};

	const invalidateQueries = () => {
		queryClient.invalidateQueries({
			queryKey:
				trpc.sessionTablePlayer.list.queryOptions(sessionParam).queryKey,
		});
		queryClient.invalidateQueries({
			queryKey: trpc.player.list.queryOptions().queryKey,
		});
		if (sessionParam.liveCashGameSessionId !== undefined) {
			queryClient.invalidateQueries({
				queryKey: trpc.liveCashGameSession.getById.queryOptions({
					id: sessionParam.liveCashGameSessionId,
				}).queryKey,
			});
		} else if (sessionParam.liveTournamentSessionId !== undefined) {
			queryClient.invalidateQueries({
				queryKey: trpc.liveTournamentSession.getById.queryOptions({
					id: sessionParam.liveTournamentSessionId,
				}).queryKey,
			});
		}
	};

	const handleApply = async () => {
		const actionable = rows.filter(
			(row) => row.action !== "skip" && row.warning === null
		);
		if (actionable.length === 0) {
			toast.error("Nothing to apply.");
			return;
		}

		setIsApplying(true);
		let success = 0;
		let failure = 0;
		for (const row of actionable) {
			const ok = await applyRow(row, sessionParam);
			if (ok) {
				success += 1;
			} else {
				failure += 1;
			}
		}
		setIsApplying(false);
		invalidateQueries();

		if (failure === 0) {
			toast.success(`Applied ${success} ${success === 1 ? "seat" : "seats"}.`);
			onOpenChange(false);
		} else {
			toast.error(`Applied ${success}, failed ${failure}.`);
		}
	};

	const renderStep = () => {
		if (step === "select-app") {
			return (
				<div className="flex flex-col gap-3">
					<p className="text-muted-foreground text-sm">
						Choose the app the screenshot came from.
					</p>
					<div className="flex flex-col gap-2">
						{SOURCE_APP_ENTRIES.map(([id, config]) => (
							<Button
								key={id}
								onClick={() => handleSourceAppSelect(id)}
								type="button"
								variant="outline"
							>
								{config.label}
							</Button>
						))}
					</div>
					<DialogActionRow>
						<Button
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
					</DialogActionRow>
				</div>
			);
		}

		if (step === "upload") {
			const isPending = extractMutation.isPending;
			return (
				<div className="flex flex-col gap-3">
					<p className="text-muted-foreground text-sm">
						Upload a screenshot from{" "}
						<span className="font-medium text-foreground">
							{TABLE_PLAYER_SOURCE_APPS[sourceApp].label}
						</span>
						.
					</p>
					<Button disabled={isPending} onClick={handlePickFile} type="button">
						{isPending ? (
							<>
								<IconLoader2 className="animate-spin" size={16} />
								Analyzing...
							</>
						) : (
							<>
								<IconPhotoUp size={16} />
								Choose screenshot
							</>
						)}
					</Button>
					<input
						accept="image/jpeg,image/png,image/gif,image/webp"
						className="hidden"
						onChange={handleImageSelected}
						ref={fileInputRef}
						type="file"
					/>
					<DialogActionRow>
						<Button
							disabled={isPending}
							onClick={() => setStep("select-app")}
							type="button"
							variant="outline"
						>
							Back
						</Button>
					</DialogActionRow>
				</div>
			);
		}

		if (rows.length === 0) {
			return (
				<div className="flex flex-col gap-3">
					<p className="text-muted-foreground text-sm">
						No players detected in the screenshot.
					</p>
					<DialogActionRow>
						<Button
							onClick={() => setStep("upload")}
							type="button"
							variant="outline"
						>
							Try another image
						</Button>
						<Button
							onClick={() => onOpenChange(false)}
							type="button"
							variant="ghost"
						>
							Close
						</Button>
					</DialogActionRow>
				</div>
			);
		}

		const seatablesCount = rows.filter(
			(row) => row.action !== "skip" && row.warning === null
		).length;
		const heroAssignedRowId =
			rows.find((r) => r.action === "hero")?.rowId ?? null;

		return (
			<div className="flex flex-col gap-3">
				<p className="text-muted-foreground text-sm">
					Detected {rows.length} {rows.length === 1 ? "seat" : "seats"}. Review
					each row, then press Apply.
				</p>
				<div className="flex flex-col gap-2">
					{rows.map((row) => (
						<ReviewRowItem
							allPlayers={allPlayers}
							heroAlreadySeatedElsewhere={
								heroSeatPosition !== null &&
								heroSeatPosition !== row.seatPosition
							}
							heroAvailable={
								heroAssignedRowId === null || heroAssignedRowId === row.rowId
							}
							key={row.rowId}
							onActionChange={(next) => handleRowActionChange(row.rowId, next)}
							onNameChange={(next) => handleRowNameChange(row.rowId, next)}
							onSelectExisting={(player) =>
								handleRowSelectExisting(row.rowId, player)
							}
							row={row}
						/>
					))}
				</div>
				<DialogActionRow>
					<Button
						disabled={isApplying}
						onClick={() => setStep("upload")}
						type="button"
						variant="outline"
					>
						Try another image
					</Button>
					<Button
						disabled={isApplying || seatablesCount === 0}
						onClick={handleApply}
						type="button"
					>
						{isApplying ? (
							<>
								<IconLoader2 className="animate-spin" size={16} />
								Applying...
							</>
						) : (
							<>
								<IconSparkles size={16} />
								Apply ({seatablesCount})
							</>
						)}
					</Button>
				</DialogActionRow>
			</div>
		);
	};

	return (
		<ResponsiveDialog
			description="Seat players extracted from a screenshot in bulk."
			fullHeight={step === "review"}
			onOpenChange={onOpenChange}
			open={open}
			title="Seat from screenshot"
		>
			{renderStep()}
		</ResponsiveDialog>
	);
}

const ACTION_BADGE_VARIANT: Record<RowAction, "default" | "secondary"> = {
	hero: "default",
	existing: "secondary",
	new: "default",
	skip: "secondary",
};

const ACTION_BADGE_CLASS: Record<RowAction, string> = {
	hero: "border-amber-400 bg-amber-500/80 text-white",
	existing: "",
	new: "bg-violet-500 text-white hover:bg-violet-500/90",
	skip: "text-muted-foreground",
};

const ACTION_BADGE_LABEL: Record<RowAction, string> = {
	hero: "Hero",
	existing: "Existing",
	new: "New",
	skip: "Skip",
};

function ReviewRowItem({
	allPlayers,
	heroAlreadySeatedElsewhere,
	heroAvailable,
	onActionChange,
	onNameChange,
	onSelectExisting,
	row,
}: {
	allPlayers: PlayerOption[];
	heroAlreadySeatedElsewhere: boolean;
	heroAvailable: boolean;
	onActionChange: (next: RowAction) => void;
	onNameChange: (next: string) => void;
	onSelectExisting: (player: PlayerOption) => void;
	row: ReviewRow;
}) {
	const disabled = row.warning !== null;

	return (
		<div className="flex flex-col gap-1 rounded-md border border-border p-2">
			<div className="flex items-center gap-2">
				<Badge className="w-10 shrink-0 justify-center" variant="secondary">
					{row.seatNumber}
				</Badge>
				<SeatCombobox
					allPlayers={allPlayers}
					disabled={disabled}
					heroAvailable={heroAvailable}
					onActionChange={onActionChange}
					onNameChange={onNameChange}
					onSelectExisting={onSelectExisting}
					row={row}
				/>
				<Badge
					className={cn(
						"w-16 shrink-0 justify-center",
						ACTION_BADGE_CLASS[row.action]
					)}
					variant={ACTION_BADGE_VARIANT[row.action]}
				>
					{ACTION_BADGE_LABEL[row.action]}
				</Badge>
			</div>
			{row.warning ? (
				<div className="flex items-start gap-1.5 text-destructive text-xs">
					<IconAlertTriangle className="mt-0.5 shrink-0" size={12} />
					<span>{row.warning}</span>
				</div>
			) : null}
			{row.ambiguous && row.action !== "existing" ? (
				<span className="text-muted-foreground text-xs">
					Multiple players share this name.
				</span>
			) : null}
			{row.action === "hero" && heroAlreadySeatedElsewhere ? (
				<span className="text-muted-foreground text-xs">
					The existing Hero seat will be overwritten.
				</span>
			) : null}
		</div>
	);
}

function getSeatDisplayValue(row: ReviewRow): string {
	if (row.action === "hero") {
		return "Hero (self)";
	}
	return row.name;
}

function SeatCombobox({
	allPlayers,
	disabled,
	heroAvailable,
	onActionChange,
	onNameChange,
	onSelectExisting,
	row,
}: {
	allPlayers: PlayerOption[];
	disabled: boolean;
	heroAvailable: boolean;
	onActionChange: (next: RowAction) => void;
	onNameChange: (next: string) => void;
	onSelectExisting: (player: PlayerOption) => void;
	row: ReviewRow;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [contentWidth, setContentWidth] = useState<number>();
	const anchorRef = useRef<HTMLDivElement>(null);

	const displayValue = getSeatDisplayValue(row);
	const readOnly = row.action === "hero";
	const normalizedInput = row.name.trim().toLowerCase();
	const filteredPlayers = normalizedInput
		? allPlayers.filter((p) => p.name.toLowerCase().includes(normalizedInput))
		: allPlayers;
	const trimmedName = row.name.trim();

	useEffect(() => {
		if (!(isOpen && anchorRef.current)) {
			return;
		}
		setContentWidth(anchorRef.current.offsetWidth);
	}, [isOpen]);

	const handleSelectExisting = (player: PlayerOption) => {
		onSelectExisting(player);
		setIsOpen(false);
	};

	const handlePickHero = () => {
		onActionChange("hero");
		setIsOpen(false);
	};

	const handleKeepAsNew = () => {
		onActionChange("new");
		setIsOpen(false);
	};

	const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Escape") {
			setIsOpen(false);
		}
	};

	return (
		<Popover modal={false} onOpenChange={setIsOpen} open={isOpen}>
			<PopoverAnchor asChild>
				<div className="relative flex-1" ref={anchorRef}>
					<Input
						aria-expanded={isOpen}
						autoComplete="off"
						className={cn(
							"h-8 pr-7",
							readOnly && "cursor-pointer text-muted-foreground"
						)}
						disabled={disabled}
						onChange={(e) => {
							if (readOnly) {
								return;
							}
							onNameChange(e.target.value);
							setIsOpen(true);
						}}
						onFocus={() => {
							if (!disabled) {
								setIsOpen(true);
							}
						}}
						onKeyDown={handleKeyDown}
						placeholder="Player name"
						readOnly={readOnly}
						role="combobox"
						value={displayValue}
					/>
					<IconChevronDown
						className="pointer-events-none absolute top-2 right-2 text-muted-foreground"
						size={14}
					/>
				</div>
			</PopoverAnchor>
			{isOpen ? (
				<PopoverContent
					align="start"
					className="p-0"
					onFocusOutside={(e) => e.preventDefault()}
					onOpenAutoFocus={(e) => e.preventDefault()}
					style={contentWidth ? { width: contentWidth } : undefined}
				>
					<Command shouldFilter={false}>
						<CommandList className="max-h-64 overflow-y-auto overscroll-contain">
							{heroAvailable && row.action !== "hero" ? (
								<CommandItem
									className={row.isHeroCandidate ? "text-amber-500" : ""}
									onMouseDown={(e) => e.preventDefault()}
									onSelect={handlePickHero}
									value="__hero__"
								>
									Seat Hero here
								</CommandItem>
							) : null}
							{trimmedName && row.action !== "new" ? (
								<CommandItem
									onMouseDown={(e) => e.preventDefault()}
									onSelect={handleKeepAsNew}
									value="__new__"
								>
									Create new: {trimmedName}
								</CommandItem>
							) : null}
							{filteredPlayers.length === 0 ? (
								<CommandEmpty>No matching players.</CommandEmpty>
							) : null}
							{filteredPlayers.map((p) => (
								<CommandItem
									key={p.id}
									onMouseDown={(e) => e.preventDefault()}
									onSelect={() => handleSelectExisting(p)}
									value={p.name}
								>
									{p.name}
								</CommandItem>
							))}
						</CommandList>
					</Command>
				</PopoverContent>
			) : null}
		</Popover>
	);
}

function computeRowWarning({
	action,
	occupiedSeatPositions,
	seatNumber,
	seatPosition,
}: {
	action: RowAction;
	occupiedSeatPositions: Set<number>;
	seatNumber: number;
	seatPosition: number;
}): string | null {
	if (seatPosition < 0 || seatPosition > 8) {
		return `Seat ${seatNumber} is out of range (1-9).`;
	}
	if (
		action !== "hero" &&
		action !== "skip" &&
		occupiedSeatPositions.has(seatPosition)
	) {
		return `Seat ${seatNumber} is already occupied.`;
	}
	return null;
}

function computeRowAction({
	effectivePreferredAction,
	isHeroCandidate,
	matchedPlayer,
	trimmedName,
}: {
	effectivePreferredAction: RowAction | undefined;
	isHeroCandidate: boolean;
	matchedPlayer: { id: string; name: string } | null;
	trimmedName: string;
}): RowAction {
	if (effectivePreferredAction) {
		if (effectivePreferredAction === "existing" && !matchedPlayer) {
			return "new";
		}
		if (effectivePreferredAction === "new" && trimmedName === "") {
			return "skip";
		}
		return effectivePreferredAction;
	}
	if (isHeroCandidate) {
		return "hero";
	}
	if (trimmedName === "") {
		return "skip";
	}
	if (matchedPlayer) {
		return "existing";
	}
	return "new";
}

function buildRow({
	isHero,
	name,
	occupiedSeatPositions,
	playersByNormalizedName,
	preferredAction,
	seatNumber,
	seatPosition,
}: {
	isHero: boolean;
	name: string;
	occupiedSeatPositions: Set<number>;
	playersByNormalizedName: Map<
		string,
		{ id: string; name: string; count: number }[]
	>;
	preferredAction?: RowAction;
	seatNumber: number;
	seatPosition: number;
}): ReviewRow {
	const rowId = `seat-${seatNumber}`;
	const trimmedName = name.trim();
	const key = normalizeName(trimmedName);
	const matches = trimmedName ? (playersByNormalizedName.get(key) ?? []) : [];
	const ambiguous = matches.length > 1;
	const matchedPlayer = matches.length === 1 ? matches[0] : null;
	const isHeroCandidate = isHero;

	const effectivePreferredAction = preferredAction;

	const action = computeRowAction({
		effectivePreferredAction,
		isHeroCandidate,
		matchedPlayer,
		trimmedName,
	});
	const warning = computeRowWarning({
		action,
		occupiedSeatPositions,
		seatNumber,
		seatPosition,
	});

	return {
		action,
		ambiguous,
		existingPlayerId: matchedPlayer?.id ?? null,
		isHeroCandidate,
		matchedPlayerName: matchedPlayer?.name ?? null,
		name: trimmedName,
		rowId,
		seatNumber,
		seatPosition,
		warning,
	};
}

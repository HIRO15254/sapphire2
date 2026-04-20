import {
	TABLE_PLAYER_SOURCE_APPS,
	type TablePlayerSourceApp,
} from "@sapphire2/api/routers/ai-extract-sources";
import {
	IconAlertTriangle,
	IconLoader2,
	IconPhotoUp,
	IconSparkles,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Input } from "@/shared/components/ui/input";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
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
	if (nextAction === "hero" && !row.isHeroCandidate) {
		return row;
	}
	if (row.ambiguous && nextAction === "existing") {
		return row;
	}
	return { ...row, action: nextAction };
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
	const { data: sessionData } = authClient.useSession();
	const userNameNormalized = useMemo(() => {
		const raw = sessionData?.user?.name;
		if (!raw) {
			return null;
		}
		const normalized = normalizeName(raw);
		return normalized === "" ? null : normalized;
	}, [sessionData?.user?.name]);

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
	const allPlayers = useMemo(
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
			toast.error("JPEG / PNG / GIF / WEBP のみ対応しています");
			return;
		}

		try {
			const base64 = await fileToBase64(file);
			const result = await extractMutation.mutateAsync({
				sourceApp,
				sources: [{ kind: "image", data: base64, mediaType }],
			});

			const seenSeatNumbers = new Set<number>();
			const built: ReviewRow[] = [];
			for (const seat of result.seats) {
				if (seenSeatNumbers.has(seat.seatNumber)) {
					continue;
				}
				seenSeatNumbers.add(seat.seatNumber);
				const seatPosition = seat.seatNumber - 1;
				const row = buildRow({
					name: seat.name,
					occupiedSeatPositions,
					playersByNormalizedName,
					seatNumber: seat.seatNumber,
					seatPosition,
					userNameNormalized,
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
				return buildRow({
					name: nextName,
					occupiedSeatPositions,
					playersByNormalizedName,
					seatNumber: row.seatNumber,
					seatPosition: row.seatPosition,
					preferredAction: row.action,
					userNameNormalized,
				});
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
			toast.error("着席対象の行がありません");
			return;
		}

		setIsApplying(true);
		let success = 0;
		let failure = 0;
		for (const row of actionable) {
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
				success += 1;
			} catch {
				failure += 1;
			}
		}
		setIsApplying(false);
		invalidateQueries();

		if (failure === 0) {
			toast.success(`${success} 件を反映しました`);
			onOpenChange(false);
		} else {
			toast.error(`反映 ${success} 件成功 / ${failure} 件失敗`);
		}
	};

	const renderStep = () => {
		if (step === "select-app") {
			return (
				<div className="flex flex-col gap-3">
					<p className="text-muted-foreground text-sm">
						スクリーンショットの元となるアプリを選択してください。
					</p>
					<div className="flex flex-col gap-2">
						{SOURCE_APP_ENTRIES.map(([id, config]) => (
							<Button
								key={id}
								onClick={() => setSourceApp(id)}
								type="button"
								variant={sourceApp === id ? "default" : "outline"}
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
							キャンセル
						</Button>
						<Button onClick={() => setStep("upload")} type="button">
							次へ
						</Button>
					</DialogActionRow>
				</div>
			);
		}

		if (step === "upload") {
			const isPending = extractMutation.isPending;
			return (
				<div className="flex flex-col gap-3">
					<div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
						<p className="font-medium">
							{TABLE_PLAYER_SOURCE_APPS[sourceApp].label}
						</p>
						<p className="mt-1 whitespace-pre-wrap text-muted-foreground text-xs">
							{TABLE_PLAYER_SOURCE_APPS[sourceApp].prompt}
						</p>
					</div>
					<Button disabled={isPending} onClick={handlePickFile} type="button">
						{isPending ? (
							<>
								<IconLoader2 className="animate-spin" size={16} />
								AI 解析中...
							</>
						) : (
							<>
								<IconPhotoUp size={16} />
								スクリーンショットを選択
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
							戻る
						</Button>
					</DialogActionRow>
				</div>
			);
		}

		if (rows.length === 0) {
			return (
				<div className="flex flex-col gap-3">
					<p className="text-muted-foreground text-sm">
						プレイヤーが検出されませんでした。
					</p>
					<DialogActionRow>
						<Button
							onClick={() => setStep("upload")}
							type="button"
							variant="outline"
						>
							別の画像を試す
						</Button>
						<Button
							onClick={() => onOpenChange(false)}
							type="button"
							variant="ghost"
						>
							閉じる
						</Button>
					</DialogActionRow>
				</div>
			);
		}

		const seatablesCount = rows.filter(
			(row) => row.action !== "skip" && row.warning === null
		).length;

		return (
			<div className="flex flex-col gap-3">
				<p className="text-muted-foreground text-sm">
					{rows.length} 件を検出しました。自分の席は「Hero
					(自分)」を選択してください。内容を確認して「反映」を押してください。
				</p>
				<div className="flex flex-col gap-2">
					{rows.map((row) => (
						<ReviewRowItem
							heroAlreadySeatedElsewhere={
								heroSeatPosition !== null &&
								heroSeatPosition !== row.seatPosition
							}
							key={row.rowId}
							onActionChange={(next) => handleRowActionChange(row.rowId, next)}
							onNameChange={(next) => handleRowNameChange(row.rowId, next)}
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
						別の画像を試す
					</Button>
					<Button
						disabled={isApplying || seatablesCount === 0}
						onClick={handleApply}
						type="button"
					>
						{isApplying ? (
							<>
								<IconLoader2 className="animate-spin" size={16} />
								反映中...
							</>
						) : (
							<>
								<IconSparkles size={16} />
								反映 ({seatablesCount})
							</>
						)}
					</Button>
				</DialogActionRow>
			</div>
		);
	};

	return (
		<ResponsiveDialog
			description="スクリーンショットから読み取ったプレイヤーを一括で着席させます。"
			fullHeight={step === "review"}
			onOpenChange={onOpenChange}
			open={open}
			title="スクリーンショットから着席"
		>
			{renderStep()}
		</ResponsiveDialog>
	);
}

function ReviewRowItem({
	heroAlreadySeatedElsewhere,
	onActionChange,
	onNameChange,
	row,
}: {
	heroAlreadySeatedElsewhere: boolean;
	onActionChange: (next: RowAction) => void;
	onNameChange: (next: string) => void;
	row: ReviewRow;
}) {
	const disabled = row.warning !== null;
	const existingLabel = row.matchedPlayerName
		? `既存: ${row.matchedPlayerName}`
		: "既存プレイヤー";

	return (
		<div className="flex flex-col gap-2 rounded-md border border-border p-2">
			<div className="flex items-center gap-2">
				<Badge className="shrink-0" variant="secondary">
					席 {row.seatNumber}
				</Badge>
				<Input
					className="h-8"
					disabled={disabled || row.action === "hero"}
					onChange={(e) => onNameChange(e.target.value)}
					placeholder="プレイヤー名"
					value={row.name}
				/>
			</div>
			{row.warning ? (
				<div className="flex items-start gap-1.5 text-destructive text-xs">
					<IconAlertTriangle className="mt-0.5 shrink-0" size={12} />
					<span>{row.warning}</span>
				</div>
			) : (
				<div className="flex flex-wrap items-center gap-2">
					<Select
						disabled={disabled}
						onValueChange={(v) => onActionChange(v as RowAction)}
						value={row.action}
					>
						<SelectTrigger className="h-8 w-auto min-w-[10rem] text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem disabled={!row.existingPlayerId} value="existing">
								{existingLabel}
							</SelectItem>
							<SelectItem value="new">新規作成</SelectItem>
							<SelectItem disabled={!row.isHeroCandidate} value="hero">
								Hero (自分)
							</SelectItem>
							<SelectItem value="skip">スキップ</SelectItem>
						</SelectContent>
					</Select>
					{row.ambiguous && (
						<span className="text-muted-foreground text-xs">
							同名が複数存在します
						</span>
					)}
					{row.action === "hero" && heroAlreadySeatedElsewhere && (
						<span className="text-muted-foreground text-xs">
							既存の Hero 席は上書きされます
						</span>
					)}
				</div>
			)}
		</div>
	);
}

function computeRowWarning({
	effectivePreferredAction,
	isHeroCandidate,
	occupiedSeatPositions,
	seatNumber,
	seatPosition,
	trimmedName,
}: {
	effectivePreferredAction: RowAction | undefined;
	isHeroCandidate: boolean;
	occupiedSeatPositions: Set<number>;
	seatNumber: number;
	seatPosition: number;
	trimmedName: string;
}): string | null {
	if (seatPosition < 0 || seatPosition > 8) {
		return `席番号 ${seatNumber} は範囲外です (1-9)`;
	}
	const isHero =
		effectivePreferredAction === "hero" ||
		(effectivePreferredAction === undefined && isHeroCandidate);
	if (!isHero && occupiedSeatPositions.has(seatPosition)) {
		return `席 ${seatNumber} には既に着席中のプレイヤーがいます`;
	}
	if (!(isHero || trimmedName)) {
		return "名前が空です";
	}
	return null;
}

function computeRowAction({
	effectivePreferredAction,
	isHeroCandidate,
	matchedPlayer,
}: {
	effectivePreferredAction: RowAction | undefined;
	isHeroCandidate: boolean;
	matchedPlayer: { id: string; name: string } | null;
}): RowAction {
	if (effectivePreferredAction) {
		if (effectivePreferredAction === "existing" && !matchedPlayer) {
			return "new";
		}
		return effectivePreferredAction;
	}
	if (isHeroCandidate) {
		return "hero";
	}
	if (matchedPlayer) {
		return "existing";
	}
	return "new";
}

function buildRow({
	name,
	occupiedSeatPositions,
	playersByNormalizedName,
	seatNumber,
	seatPosition,
	preferredAction,
	userNameNormalized,
}: {
	name: string;
	occupiedSeatPositions: Set<number>;
	playersByNormalizedName: Map<
		string,
		{ id: string; name: string; count: number }[]
	>;
	preferredAction?: RowAction;
	seatNumber: number;
	seatPosition: number;
	userNameNormalized: string | null;
}): ReviewRow {
	const rowId = `seat-${seatNumber}`;
	const trimmedName = name.trim();
	const key = normalizeName(trimmedName);
	const matches = trimmedName ? (playersByNormalizedName.get(key) ?? []) : [];
	const ambiguous = matches.length > 1;
	const matchedPlayer = matches.length === 1 ? matches[0] : null;
	const isHeroCandidate =
		userNameNormalized !== null &&
		trimmedName !== "" &&
		key === userNameNormalized;

	const effectivePreferredAction =
		preferredAction === "hero" && !isHeroCandidate
			? undefined
			: preferredAction;

	const warning = computeRowWarning({
		effectivePreferredAction,
		isHeroCandidate,
		occupiedSeatPositions,
		seatNumber,
		seatPosition,
		trimmedName,
	});
	const action = computeRowAction({
		effectivePreferredAction,
		isHeroCandidate,
		matchedPlayer,
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

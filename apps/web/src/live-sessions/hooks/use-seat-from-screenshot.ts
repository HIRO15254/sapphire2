import type { TablePlayerSourceApp } from "@sapphire2/api/routers/ai-extract-sources";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	applyRow,
	applyRowAction,
	buildRow,
	fileToBase64,
	isAcceptedMediaType,
	normalizeName,
	type PlayerOption,
	type ReviewRow,
	type RowAction,
	type SessionParam,
	SOURCE_APP_ENTRIES,
	type Step,
} from "@/live-sessions/utils/seat-screenshot";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc } from "@/utils/trpc";

interface UseSeatFromScreenshotArgs {
	occupiedSeatPositions: Set<number>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionParam: SessionParam;
}

export function useSeatFromScreenshot({
	occupiedSeatPositions,
	onOpenChange,
	open,
	sessionParam,
}: UseSeatFromScreenshotArgs) {
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

	const onSourceAppSelect = (nextApp: TablePlayerSourceApp) => {
		setSourceApp(nextApp);
		setStep("upload");
	};

	const onPickFile = () => {
		fileInputRef.current?.click();
	};

	const onImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

	const onRowNameChange = (rowId: string, nextName: string) => {
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

	const onRowSelectExisting = (rowId: string, player: PlayerOption) => {
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

	const onRowActionChange = (rowId: string, nextAction: RowAction) => {
		setRows((prev) =>
			prev.map((row) => applyRowAction(row, rowId, nextAction))
		);
	};

	const invalidateSessionQueries = async () => {
		const targets = [
			{
				queryKey:
					trpc.sessionTablePlayer.list.queryOptions(sessionParam).queryKey,
			},
			{ queryKey: trpc.player.list.queryOptions().queryKey },
		];
		if (sessionParam.liveCashGameSessionId !== undefined) {
			targets.push({
				queryKey: trpc.liveCashGameSession.getById.queryOptions({
					id: sessionParam.liveCashGameSessionId,
				}).queryKey,
			});
		} else if (sessionParam.liveTournamentSessionId !== undefined) {
			targets.push({
				queryKey: trpc.liveTournamentSession.getById.queryOptions({
					id: sessionParam.liveTournamentSessionId,
				}).queryKey,
			});
		}
		await invalidateTargets(queryClient, targets);
	};

	const onApply = async () => {
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
		await invalidateSessionQueries();

		if (failure === 0) {
			toast.success(`Applied ${success} ${success === 1 ? "seat" : "seats"}.`);
			onOpenChange(false);
		} else {
			toast.error(`Applied ${success}, failed ${failure}.`);
		}
	};

	const onBackToSelectApp = () => setStep("select-app");
	const onBackToUpload = () => setStep("upload");

	return {
		step,
		sourceApp,
		rows,
		isApplying,
		fileInputRef,
		isExtracting: extractMutation.isPending,
		allPlayers,
		onSourceAppSelect,
		onPickFile,
		onImageSelected,
		onRowNameChange,
		onRowSelectExisting,
		onRowActionChange,
		onApply,
		onBackToSelectApp,
		onBackToUpload,
	};
}

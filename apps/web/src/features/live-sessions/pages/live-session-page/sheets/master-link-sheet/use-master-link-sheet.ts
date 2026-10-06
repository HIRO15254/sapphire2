import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import z from "zod";
import { useLinkedMaster } from "@/features/live-sessions/hooks/use-linked-master";
import {
	buildRingGameCreateInput,
	buildTournamentCreateInput,
	type CashRuleSnapshot,
	describeCashMasterMeta,
	describeSnapshotRows,
	describeTournamentMasterMeta,
	hasSameRules,
	masterNounFor,
	type SnapshotBlindLevel,
	type SnapshotChipPurchase,
	type SnapshotRow,
	type TournamentRuleSnapshot,
} from "@/features/live-sessions/utils/master-link";
import {
	describeCashMasterValues,
	describeTournamentMasterValues,
	type MasterFieldValues,
} from "@/features/live-sessions/utils/session-settings";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
import { houseRulesOrNull } from "@/shared/lib/house-rules";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";
import {
	describeSessionDetail,
	describeSessionRuleValues,
	type SessionSheetView,
} from "../session-sheet/session-sheet-view";
import { useDiscardConfirm } from "../use-discard-confirm";

export type MasterLinkMode = "create" | "existing";

interface MasterLinkValues {
	mode: MasterLinkMode;
	name: string;
	pickedId: string;
	roomId: string;
}

interface UseMasterLinkSheetOptions {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}

export interface MasterOption {
	id: string;
	isSameRules: boolean;
	meta: string;
	name: string;
}

const MASTER_LINK_SCHEMA = z
	.object({
		mode: z.enum(["create", "existing"]),
		name: z.string(),
		pickedId: z.string(),
		roomId: z.string(),
	})
	.refine((values) => values.mode !== "create" || values.name.trim() !== "", {
		message: "Required",
		path: ["name"],
	});

const MODES: { key: MasterLinkMode; label: string }[] = [
	{ key: "existing", label: "Select existing" },
	{ key: "create", label: "Create new" },
];

function linkSession(
	sessionType: "cash_game" | "tournament",
	sessionId: string,
	masterId: string | null,
	roomId?: string
): Promise<unknown> {
	const room = roomId === undefined ? null : { roomId };
	return sessionType === "cash_game"
		? trpcClient.liveCashGameSession.update.mutate({
				id: sessionId,
				keepSnapshot: true,
				ringGameId: masterId,
				...room,
			})
		: trpcClient.liveTournamentSession.update.mutate({
				id: sessionId,
				keepSnapshot: true,
				tournamentId: masterId,
				...room,
			});
}

interface TournamentStructure {
	blindLevels: readonly SnapshotBlindLevel[];
	chipPurchases: readonly SnapshotChipPurchase[];
}

interface MasterSource {
	sessionType: "cash_game" | "tournament";
	structure: TournamentStructure | undefined;
	view: SessionSheetView;
}

function numberOf(view: SessionSheetView, key: string): number | null {
	return view.serverNumbers[key] ?? null;
}

function cashSnapshotOf(view: SessionSheetView): CashRuleSnapshot {
	return {
		ante: numberOf(view, "ante"),
		anteType: view.anteType,
		blind1: numberOf(view, "blind1"),
		blind2: numberOf(view, "blind2"),
		blind3: numberOf(view, "blind3"),
		houseRules: houseRulesOrNull(view.houseRules),
		maxBuyIn: numberOf(view, "maxBuyIn"),
		minBuyIn: numberOf(view, "minBuyIn"),
		mixGames: view.mixGames,
		tableSize: view.tableSize,
		variant: view.variantLabel,
	};
}

function tournamentSnapshotOf(view: SessionSheetView): TournamentRuleSnapshot {
	return {
		bountyAmount: numberOf(view, "bountyAmount"),
		buyIn: numberOf(view, "tournamentBuyIn"),
		entryFee: numberOf(view, "entryFee"),
		houseRules: houseRulesOrNull(view.houseRules),
		startingStack: numberOf(view, "startingStack"),
		tableSize: view.tableSize,
		variant: view.variantLabel,
	};
}

async function createMaster(
	{ sessionType, structure, view }: MasterSource,
	name: string,
	roomId: string
): Promise<string> {
	const target = { currencyId: view.selectedCurrencyId, name, roomId };
	const created =
		sessionType === "cash_game"
			? await trpcClient.ringGame.create.mutate(
					buildRingGameCreateInput(target, cashSnapshotOf(view))
				)
			: await trpcClient.tournament.createWithLevels.mutate(
					buildTournamentCreateInput(
						target,
						tournamentSnapshotOf(view),
						structure?.blindLevels ?? [],
						structure?.chipPurchases ?? []
					)
				);
	if (!created) {
		throw new Error(`The ${masterNounFor(sessionType)} was not created`);
	}
	return created.id;
}

function toMasterOptions<T extends { id: string; name: string }>(
	rows: readonly T[] | undefined,
	describe: {
		meta: (row: T) => string;
		values: (row: T) => MasterFieldValues | null;
	},
	sessionRules: MasterFieldValues
): MasterOption[] {
	return (rows ?? []).map((row) => ({
		id: row.id,
		isSameRules: hasSameRules(describe.values(row), sessionRules),
		meta: describe.meta(row),
		name: row.name,
	}));
}

type GameGroupLookup = Pick<
	ReturnType<typeof useGameGroups>,
	"isMixValue" | "labelsFor"
>;

function snapshotRowsOf(
	{ sessionType, structure, view }: MasterSource,
	currency: { name: string | null; unit: string | null },
	gameGroups: GameGroupLookup
): SnapshotRow[] {
	return describeSnapshotRows({
		blindLabels: gameGroups.labelsFor(view.variantLabel),
		blindLevelCount: (structure?.blindLevels ?? []).filter(
			(level) => !level.isBreak
		).length,
		currencyName: currency.name,
		currencyUnit: currency.unit,
		isMix: gameGroups.isMixValue(view.variantLabel),
		mixGames: view.mixGames ?? [],
		numbers: {
			blind1: numberOf(view, "blind1"),
			blind2: numberOf(view, "blind2"),
			entryFee: numberOf(view, "entryFee"),
			maxBuyIn: numberOf(view, "maxBuyIn"),
			minBuyIn: numberOf(view, "minBuyIn"),
			startingStack: numberOf(view, "startingStack"),
			tournamentBuyIn: numberOf(view, "tournamentBuyIn"),
		},
		sessionType,
		tableSize: view.tableSize,
		variant: view.variantLabel,
	});
}

function refreshTargetsFor(
	sessionType: "cash_game" | "tournament",
	sessionId: string
) {
	const live =
		sessionType === "cash_game"
			? {
					detail: trpc.liveCashGameSession.getById.queryOptions({
						id: sessionId,
					}).queryKey,
					list: trpc.liveCashGameSession.list.pathKey(),
				}
			: {
					detail: trpc.liveTournamentSession.getById.queryOptions({
						id: sessionId,
					}).queryKey,
					list: trpc.liveTournamentSession.list.pathKey(),
				};
	return [
		{ queryKey: trpc.session.getById.queryOptions({ id: sessionId }).queryKey },
		{ queryKey: live.detail },
		{ queryKey: live.list },
		{ queryKey: trpc.session.list.pathKey() },
		{ queryKey: trpc.ringGame.listByRoom.pathKey() },
		{ queryKey: trpc.tournament.listByRoom.pathKey() },
		{ queryKey: trpc.tournament.getById.pathKey() },
		{ queryKey: trpc.room.list.pathKey() },
	];
}

export function useMasterLinkSheet({
	onOpenChange,
	open,
	sessionId,
	sessionType,
}: UseMasterLinkSheetOptions) {
	const queryClient = useQueryClient();
	const isCash = sessionType === "cash_game";
	const noun = masterNounFor(sessionType);
	const linked = useLinkedMaster({ sessionId, sessionType });
	const gameGroups = useGameGroups();
	const view = describeSessionDetail(linked.detail, sessionType);

	const roomsQuery = useQuery({
		...trpc.room.list.queryOptions(),
		enabled: open,
	});
	const rooms = roomsQuery.data ?? [];
	const defaultRoomId =
		rooms.find((room) => room.id === linked.detail?.roomId)?.id ??
		rooms[0]?.id ??
		"";

	const liveTournamentQuery = useQuery({
		...trpc.liveTournamentSession.getById.queryOptions({ id: sessionId }),
		enabled: open && !isCash,
	});

	const refresh = () =>
		invalidateTargets(queryClient, refreshTargetsFor(sessionType, sessionId));
	const source: MasterSource = {
		sessionType,
		structure: liveTournamentQuery.data,
		view,
	};

	const linkMutation = useMutation({
		mutationFn: ({ masterId, roomId }: { masterId: string; roomId: string }) =>
			linkSession(sessionType, sessionId, masterId, roomId),
		onError: () => {
			toast.error(`Failed to link the ${noun}`);
		},
		onSettled: refresh,
	});

	const unlinkMutation = useMutation({
		mutationFn: () => linkSession(sessionType, sessionId, null),
		onError: () => {
			toast.error(`Failed to unlink the ${noun}`);
		},
		onSettled: refresh,
	});

	const createMutation = useMutation({
		mutationFn: ({ name, roomId }: { name: string; roomId: string }) =>
			createMaster(source, name, roomId),
		onError: () => {
			toast.error(`Failed to create the ${noun}`);
		},
		onSettled: refresh,
	});

	const openDefaults: MasterLinkValues = {
		mode: "existing",
		name: view.ruleName,
		pickedId: "",
		roomId: "",
	};
	const form = useForm({
		defaultValues: openDefaults,
		onSubmit: async ({ value }) => {
			const roomId = value.roomId || defaultRoomId;
			let masterId = value.pickedId;
			if (value.mode === "create") {
				const createdId = await createMutation
					.mutateAsync({ name: value.name.trim(), roomId })
					.catch(() => null);
				if (createdId === null) {
					return;
				}
				masterId = createdId;
			}
			try {
				await linkMutation.mutateAsync({ masterId, roomId });
				onOpenChange(false);
			} catch {
				if (value.mode === "create") {
					form.setFieldValue("mode", "existing");
					form.setFieldValue("roomId", roomId);
					form.setFieldValue("pickedId", masterId);
				}
			}
		},
		validators: { onSubmit: MASTER_LINK_SCHEMA },
	});

	const wasOpenRef = useRef(false);
	useEffect(() => {
		if (open && !wasOpenRef.current) {
			form.reset(openDefaults);
		}
		wasOpenRef.current = open;
	});

	const discard = useDiscardConfirm({
		isDirty: () => form.state.isDirty,
		onOpenChange,
	});

	const values = useStore(form.store, (state) => state.values);
	const roomId = values.roomId || defaultRoomId;

	const ringGamesQuery = useQuery({
		...trpc.ringGame.listByRoom.queryOptions({ roomId }),
		enabled: open && isCash && roomId !== "",
	});
	const tournamentsQuery = useQuery({
		...trpc.tournament.listByRoom.queryOptions({ roomId }),
		enabled: open && !isCash && roomId !== "",
	});

	const sessionRules = describeSessionRuleValues(linked.detail, sessionType);
	const options = isCash
		? toMasterOptions(
				ringGamesQuery.data,
				{ meta: describeCashMasterMeta, values: describeCashMasterValues },
				sessionRules
			)
		: toMasterOptions(
				tournamentsQuery.data,
				{
					meta: describeTournamentMasterMeta,
					values: describeTournamentMasterValues,
				},
				sessionRules
			);
	const listQuery = isCash ? ringGamesQuery : tournamentsQuery;
	const snapshotRows = snapshotRowsOf(
		source,
		{
			name: linked.detail?.currencyName ?? null,
			unit: linked.detail?.currencyUnit ?? null,
		},
		gameGroups
	);

	const isBusy =
		createMutation.isPending ||
		linkMutation.isPending ||
		unlinkMutation.isPending;

	return {
		confirmLabel: values.mode === "create" ? "Create and link" : "Link",
		discard,
		form,
		isBusy,
		isListLoading: roomId !== "" && listQuery.isPending,
		isSaveDisabled:
			isBusy ||
			roomId === "" ||
			(values.mode === "existing" && values.pickedId === "") ||
			(values.mode === "create" && !isCash && liveTournamentQuery.isPending),
		linked: linked.summary,
		mode: values.mode,
		modes: MODES.map((mode) => ({
			...mode,
			isActive: mode.key === values.mode,
		})),
		noun,
		onModeChange: (mode: MasterLinkMode) => form.setFieldValue("mode", mode),
		onPick: (masterId: string) => form.setFieldValue("pickedId", masterId),
		onRoomChange: (nextRoomId: string) => {
			form.setFieldValue("roomId", nextRoomId);
			form.setFieldValue("pickedId", "");
		},
		onUnlink: () => {
			unlinkMutation.mutate();
		},
		options,
		pickedId: values.pickedId,
		roomId,
		rooms: rooms.map((room) => ({ id: room.id, name: room.name })),
		snapshotRows,
		title: linked.summary === null ? `Link ${noun}` : "Change master",
	};
}

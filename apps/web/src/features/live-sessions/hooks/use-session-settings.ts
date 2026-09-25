import type { MixGameGroup } from "@sapphire2/db/schemas/game";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlindLevelInput } from "@/features/live-sessions/utils/blind-level-rows";
import {
	describeCashMasterValues,
	describeTournamentMasterValues,
} from "@/features/live-sessions/utils/session-settings";
import {
	cancelTargets,
	createOptimisticId,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
	updateQueryEntity,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export type SessionSettingsType = "cash_game" | "tournament";

export interface SessionSnapshotPatch {
	ante?: number | null;
	anteType?: "all" | "bb" | "none" | null;
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
	blindLevels?: BlindLevelInput[];
	bountyAmount?: number | null;
	entryFee?: number | null;
	maxBuyIn?: number | null;
	minBuyIn?: number | null;
	mixGames?: MixGameGroup[] | null;
	ruleName?: string;
	startingStack?: number | null;
	tableSize?: number | null;
	tournamentBuyIn?: number | null;
	variant?: string;
}

export type MasterFieldPatch = Omit<
	SessionSnapshotPatch,
	"blindLevels" | "mixGames" | "variant"
> & { currencyId?: string };

interface UseSessionSettingsOptions {
	sessionId: string;
	sessionType: SessionSettingsType;
}

function snapshotMutation(
	sessionType: SessionSettingsType,
	id: string,
	patch: SessionSnapshotPatch
): Promise<unknown> {
	if (sessionType === "cash_game") {
		const {
			blindLevels: _levels,
			bountyAmount: _bounty,
			entryFee: _fee,
			startingStack: _stack,
			tournamentBuyIn: _buyIn,
			...cash
		} = patch;
		return trpcClient.liveCashGameSession.updateSnapshot.mutate({
			id,
			...cash,
		});
	}
	const {
		ante: _ante,
		anteType: _anteType,
		blind1: _b1,
		blind2: _b2,
		blind3: _b3,
		maxBuyIn: _max,
		minBuyIn: _min,
		mixGames: _mixGames,
		...tournament
	} = patch;
	return trpcClient.liveTournamentSession.updateSnapshot.mutate({
		id,
		...tournament,
	});
}

function syncMasterMutation(
	sessionType: SessionSettingsType,
	masterId: string,
	patch: MasterFieldPatch
): Promise<unknown> {
	if (sessionType === "cash_game") {
		const {
			bountyAmount: _bounty,
			entryFee: _fee,
			ruleName,
			startingStack: _stack,
			tournamentBuyIn: _buyIn,
			...rest
		} = patch;
		return trpcClient.ringGame.update.mutate({
			id: masterId,
			...rest,
			...(ruleName === undefined ? {} : { name: ruleName }),
		});
	}
	const {
		ante: _ante,
		anteType: _anteType,
		blind1: _b1,
		blind2: _b2,
		blind3: _b3,
		maxBuyIn: _max,
		minBuyIn: _min,
		ruleName,
		tournamentBuyIn,
		...rest
	} = patch;
	return trpcClient.tournament.update.mutate({
		id: masterId,
		...rest,
		...(ruleName === undefined ? {} : { name: ruleName }),
		...(tournamentBuyIn === undefined ? {} : { buyIn: tournamentBuyIn }),
	});
}

function liveUpdateMutation(
	sessionType: SessionSettingsType,
	id: string,
	patch: { currencyId?: string; memo?: string | null }
): Promise<unknown> {
	return sessionType === "cash_game"
		? trpcClient.liveCashGameSession.update.mutate({ id, ...patch })
		: trpcClient.liveTournamentSession.update.mutate({ id, ...patch });
}

const NO_BLIND_LEVELS: never[] = [];

interface PatchableEntity {
	[key: string]: unknown;
}

type SnapshotKeyMap = Partial<Record<keyof SessionSnapshotPatch, string>>;

const CASH_DETAIL_KEY_MAP: SnapshotKeyMap = {
	ante: "cashAnte",
	anteType: "cashAnteType",
	blind1: "cashBlind1",
	blind2: "ringGameBlind2",
	blind3: "cashBlind3",
	maxBuyIn: "cashMaxBuyIn",
	minBuyIn: "cashMinBuyIn",
	mixGames: "cashMixGames",
	ruleName: "ringGameName",
	tableSize: "cashTableSize",
	variant: "cashVariant",
};

const TOURNAMENT_DETAIL_KEY_MAP: SnapshotKeyMap = {
	bountyAmount: "tournamentBountyAmount",
	ruleName: "tournamentName",
	startingStack: "tournamentStartingStack",
	tableSize: "tournamentTableSize",
	variant: "tournamentVariant",
};

const TOURNAMENT_LIVE_KEY_MAP: SnapshotKeyMap = {
	tournamentBuyIn: "buyIn",
};

function remapPatchKeys(
	patch: SessionSnapshotPatch,
	keyMap: SnapshotKeyMap
): PatchableEntity {
	const remapped: PatchableEntity = {};
	for (const [key, value] of Object.entries(patch) as [
		keyof SessionSnapshotPatch,
		unknown,
	][]) {
		if (key !== "blindLevels") {
			remapped[keyMap[key] ?? key] = value;
		}
	}
	return remapped;
}

function toOptimisticBlindLevels(
	sessionId: string,
	levels: BlindLevelInput[]
): PatchableEntity[] {
	return levels.map((level, index) => ({
		...level,
		id: createOptimisticId("blind-level"),
		level: index + 1,
		sessionId,
	}));
}

export function useSessionSettings({
	sessionId,
	sessionType,
}: UseSessionSettingsOptions) {
	const queryClient = useQueryClient();
	const isCash = sessionType === "cash_game";

	const detailKey = trpc.session.getById.queryOptions({
		id: sessionId,
	}).queryKey;
	const liveKey = isCash
		? trpc.liveCashGameSession.getById.queryOptions({ id: sessionId }).queryKey
		: trpc.liveTournamentSession.getById.queryOptions({ id: sessionId })
				.queryKey;
	const tagsKey = trpc.sessionTag.list.queryOptions().queryKey;

	const detailQuery = useQuery({
		...trpc.session.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
	});
	const tournamentLiveQuery = useQuery({
		...trpc.liveTournamentSession.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId && !isCash,
	});
	const tagsQuery = useQuery(trpc.sessionTag.list.queryOptions());
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());

	const masterRoomId = detailQuery.data?.roomId ?? null;
	const masterRingGameId = detailQuery.data?.ringGameId ?? null;
	const masterTournamentId = detailQuery.data?.tournamentId ?? null;

	const ringGameListQueryOptions = trpc.ringGame.listByRoom.queryOptions({
		roomId: masterRoomId ?? "",
	});
	const tournamentMasterQueryOptions = trpc.tournament.getById.queryOptions({
		id: masterTournamentId ?? "",
	});

	const ringGameMasterQuery = useQuery({
		...ringGameListQueryOptions,
		enabled: isCash && masterRoomId !== null && masterRingGameId !== null,
	});
	const tournamentMasterQuery = useQuery({
		...tournamentMasterQueryOptions,
		enabled: !isCash && masterTournamentId !== null,
	});

	const master = isCash
		? describeCashMasterValues(
				ringGameMasterQuery.data?.find((row) => row.id === masterRingGameId) ??
					null
			)
		: describeTournamentMasterValues(tournamentMasterQuery.data ?? null);

	const masterId = isCash ? masterRingGameId : masterTournamentId;

	const refresh = () =>
		invalidateTargets(queryClient, [
			{ queryKey: detailKey },
			{ queryKey: liveKey },
			{ queryKey: trpc.session.list.pathKey() },
		]);

	const cancelSettingsQueries = () =>
		cancelTargets(queryClient, [
			{ queryKey: detailKey },
			{ queryKey: liveKey },
		]);

	const snapshot = useMutation({
		mutationFn: (patch: SessionSnapshotPatch) =>
			snapshotMutation(sessionType, sessionId, patch),
		onMutate: async (patch) => {
			await cancelSettingsQueries();
			const previousDetail = snapshotQuery(queryClient, detailKey);
			const previousLive = snapshotQuery(queryClient, liveKey);
			updateQueryEntity<PatchableEntity>(
				queryClient,
				detailKey,
				remapPatchKeys(
					patch,
					isCash ? CASH_DETAIL_KEY_MAP : TOURNAMENT_DETAIL_KEY_MAP
				)
			);
			updateQueryEntity<PatchableEntity>(queryClient, liveKey, {
				...remapPatchKeys(patch, isCash ? {} : TOURNAMENT_LIVE_KEY_MAP),
				...(patch.blindLevels === undefined
					? null
					: {
							blindLevels: toOptimisticBlindLevels(
								sessionId,
								patch.blindLevels
							),
						}),
			});
			return { previousDetail, previousLive };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousDetail,
				context?.previousLive,
			]);
		},
		onSettled: refresh,
	});

	const live = useMutation({
		mutationFn: (patch: { currencyId?: string; memo?: string | null }) =>
			liveUpdateMutation(sessionType, sessionId, patch),
		onMutate: async (patch) => {
			await cancelSettingsQueries();
			const previousDetail = snapshotQuery(queryClient, detailKey);
			const previousLive = snapshotQuery(queryClient, liveKey);
			const currency =
				patch.currencyId === undefined
					? null
					: ((currenciesQuery.data ?? []).find(
							(candidate) => candidate.id === patch.currencyId
						) ?? null);
			updateQueryEntity<PatchableEntity>(queryClient, detailKey, {
				...patch,
				...(currency
					? { currencyName: currency.name, currencyUnit: currency.unit }
					: null),
			});
			updateQueryEntity<PatchableEntity>(queryClient, liveKey, patch);
			return { previousDetail, previousLive };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousDetail,
				context?.previousLive,
			]);
		},
		onSettled: refresh,
	});

	const tags = useMutation({
		mutationFn: (tagIds: string[]) =>
			trpcClient.session.update.mutate({ id: sessionId, tagIds }),
		onMutate: async (tagIds) => {
			await cancelTargets(queryClient, [{ queryKey: detailKey }]);
			const previousDetail = snapshotQuery(queryClient, detailKey);
			const tagsById = new Map(
				(tagsQuery.data ?? []).map((tag) => [tag.id, tag])
			);
			updateQueryEntity<PatchableEntity>(queryClient, detailKey, {
				tags: tagIds.map((id) => ({ id, name: tagsById.get(id)?.name ?? "" })),
			});
			return { previousDetail };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [context?.previousDetail]);
		},
		onSettled: refresh,
	});

	const syncMaster = useMutation({
		mutationFn: (patch: MasterFieldPatch) => {
			if (masterId === null) {
				return Promise.reject(new Error("No linked master to sync"));
			}
			return syncMasterMutation(sessionType, masterId, patch);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: ringGameListQueryOptions.queryKey },
				{ queryKey: tournamentMasterQueryOptions.queryKey },
			]);
		},
	});

	const createTag = useMutation({
		mutationFn: (name: string) => trpcClient.sessionTag.create.mutate({ name }),
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: tagsKey }]);
		},
	});

	return {
		availableTags: tagsQuery.data ?? [],
		blindLevels: tournamentLiveQuery.data?.blindLevels ?? NO_BLIND_LEVELS,
		currencies: currenciesQuery.data ?? [],
		detail: detailQuery.data ?? null,
		hasBlindLevels: tournamentLiveQuery.data !== undefined,
		isSaving: snapshot.isPending || live.isPending || tags.isPending,
		isSyncingMaster: syncMaster.isPending,
		master,
		onCreateTag: (name: string) => createTag.mutateAsync(name),
		onSyncMasterFromSession: (patch: MasterFieldPatch) =>
			syncMaster.mutateAsync(patch),
		onUpdateLive: (patch: { currencyId?: string; memo?: string | null }) =>
			live.mutateAsync(patch),
		onUpdateSnapshot: (patch: SessionSnapshotPatch) =>
			snapshot.mutateAsync(patch),
		onUpdateTags: (tagIds: string[]) => tags.mutateAsync(tagIds),
	};
}

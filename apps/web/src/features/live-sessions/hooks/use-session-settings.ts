import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export type SessionSettingsType = "cash_game" | "tournament";

export interface SessionSnapshotPatch {
	ante?: number | null;
	anteType?: "all" | "bb" | "none" | null;
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
	bountyAmount?: number | null;
	entryFee?: number | null;
	maxBuyIn?: number | null;
	minBuyIn?: number | null;
	ruleName?: string;
	startingStack?: number | null;
	tableSize?: number | null;
	tournamentBuyIn?: number | null;
}

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
		...tournament
	} = patch;
	return trpcClient.liveTournamentSession.updateSnapshot.mutate({
		id,
		...tournament,
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

export function useSessionSettings({
	sessionId,
	sessionType,
}: UseSessionSettingsOptions) {
	const queryClient = useQueryClient();

	const detailKey = trpc.session.getById.queryOptions({
		id: sessionId,
	}).queryKey;
	const liveKey =
		sessionType === "cash_game"
			? trpc.liveCashGameSession.getById.queryOptions({ id: sessionId })
					.queryKey
			: trpc.liveTournamentSession.getById.queryOptions({ id: sessionId })
					.queryKey;
	const tagsKey = trpc.sessionTag.list.queryOptions().queryKey;
	const currenciesKey = trpc.currency.list.queryOptions().queryKey;

	const detailQuery = useQuery({
		...trpc.session.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
	});
	const tagsQuery = useQuery(trpc.sessionTag.list.queryOptions());
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());

	const refresh = () =>
		invalidateTargets(queryClient, [
			{ queryKey: detailKey },
			{ queryKey: liveKey },
			{ queryKey: trpc.session.list.pathKey() },
		]);

	const snapshot = useMutation({
		mutationFn: (patch: SessionSnapshotPatch) =>
			snapshotMutation(sessionType, sessionId, patch),
		onSettled: refresh,
	});

	const live = useMutation({
		mutationFn: (patch: { currencyId?: string; memo?: string | null }) =>
			liveUpdateMutation(sessionType, sessionId, patch),
		onSettled: refresh,
	});

	const tags = useMutation({
		mutationFn: (tagIds: string[]) =>
			trpcClient.session.update.mutate({ id: sessionId, tagIds }),
		onSettled: refresh,
	});

	const createTag = useMutation({
		mutationFn: (name: string) => trpcClient.sessionTag.create.mutate({ name }),
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: tagsKey }]);
		},
	});

	const createCurrency = useMutation({
		mutationFn: (values: { name: string; unit: string }) =>
			trpcClient.currency.create.mutate(values),
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: currenciesKey }]);
		},
	});

	return {
		availableTags: tagsQuery.data ?? [],
		currencies: currenciesQuery.data ?? [],
		detail: detailQuery.data ?? null,
		isCurrencyPending: createCurrency.isPending,
		isLoading: detailQuery.isLoading,
		onCreateCurrency: (values: { name: string; unit: string }) =>
			createCurrency.mutateAsync(values),
		onCreateTag: (name: string) => createTag.mutateAsync(name),
		onUpdateLive: (patch: { currencyId?: string; memo?: string | null }) => {
			live.mutate(patch);
		},
		onUpdateSnapshot: (patch: SessionSnapshotPatch) => {
			snapshot.mutate(patch);
		},
		onUpdateTags: (tagIds: string[]) => {
			tags.mutate(tagIds);
		},
	};
}

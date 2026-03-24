import { IconCards, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SessionCard } from "@/components/sessions/session-card";
import {
	SessionFilters,
	type SessionFilterValues,
} from "@/components/sessions/session-filters";
import { SessionForm } from "@/components/sessions/session-form";
import { SessionSummary } from "@/components/sessions/session-summary";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/sessions/")({
	component: SessionsPage,
});

interface CashGameFormValues {
	ante?: number;
	anteType?: string;
	blind1?: number;
	blind2?: number;
	blind3?: number;
	buyIn: number;
	cashOut: number;
	currencyId?: string;
	endTime?: string;
	memo?: string;
	ringGameId?: string;
	sessionDate: string;
	startTime?: string;
	storeId?: string;
	tableSize?: number;
	tagIds?: string[];
	type: "cash_game";
	variant: string;
}

interface TournamentFormValues {
	addonCost?: number;
	bountyPrizes?: number;
	currencyId?: string;
	endTime?: string;
	entryFee?: number;
	memo?: string;
	placement?: number;
	prizeMoney?: number;
	rebuyCost?: number;
	rebuyCount?: number;
	sessionDate: string;
	startTime?: string;
	storeId?: string;
	tagIds?: string[];
	totalEntries?: number;
	tournamentBuyIn: number;
	tournamentId?: string;
	type: "tournament";
}

type SessionFormValues = CashGameFormValues | TournamentFormValues;

interface SessionItem {
	addonCost: number | null;
	bountyPrizes: number | null;
	buyIn: number | null;
	cashOut: number | null;
	createdAt: string;
	currencyId: string | null;
	currencyName: string | null;
	endedAt: string | null;
	entryFee: number | null;
	evCashOut: number | null;
	id: string;
	memo: string | null;
	placement: number | null;
	prizeMoney: number | null;
	profitLoss: number | null;
	rebuyCost: number | null;
	rebuyCount: number | null;
	ringGameId: string | null;
	ringGameName: string | null;
	sessionDate: string;
	startedAt: string | null;
	storeId: string | null;
	storeName: string | null;
	tags: Array<{ id: string; name: string }>;
	totalEntries: number | null;
	tournamentBuyIn: number | null;
	tournamentId: string | null;
	tournamentName: string | null;
	type: string;
}

function timeToUnix(
	sessionDate: string,
	time: string | undefined
): number | undefined {
	if (!time) {
		return undefined;
	}
	return Math.floor(new Date(`${sessionDate}T${time}`).getTime() / 1000);
}

function useStoreGames(storeId: string | undefined) {
	const ringGamesQuery = useQuery({
		...trpc.ringGame.listByStore.queryOptions({ storeId: storeId ?? "" }),
		enabled: !!storeId,
	});
	const tournamentsQuery = useQuery({
		...trpc.tournament.listByStore.queryOptions({ storeId: storeId ?? "" }),
		enabled: !!storeId,
	});
	return {
		ringGames: (ringGamesQuery.data ?? []).map((g) => ({
			id: g.id,
			name: g.name,
			variant: g.variant,
			blind1: g.blind1,
			blind2: g.blind2,
			blind3: g.blind3,
			ante: g.ante,
			anteType: g.anteType,
			tableSize: g.tableSize,
			currencyId: g.currencyId,
		})),
		tournaments: (tournamentsQuery.data ?? []).map((t) => ({
			id: t.id,
			name: t.name,
			buyIn: t.buyIn,
			entryFee: t.entryFee,
			rebuyCost: t.rebuyCost,
			addonCost: t.addonCost,
		})),
	};
}

function useEntityLists() {
	const storesQuery = useQuery(trpc.store.list.queryOptions());
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	return {
		stores: (storesQuery.data ?? []).map((s) => ({ id: s.id, name: s.name })),
		currencies: (currenciesQuery.data ?? []).map((c) => ({
			id: c.id,
			name: c.name,
		})),
	};
}

function formatDateForInput(date: string): string {
	const d = new Date(date);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatTimeFromDate(date: string | null): string | undefined {
	if (!date) {
		return undefined;
	}
	const d = new Date(date);
	const hours = String(d.getHours()).padStart(2, "0");
	const minutes = String(d.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

function buildCreatePayload(values: SessionFormValues) {
	const sessionDate = Math.floor(new Date(values.sessionDate).getTime() / 1000);
	const common = {
		sessionDate,
		startedAt: timeToUnix(values.sessionDate, values.startTime),
		endedAt: timeToUnix(values.sessionDate, values.endTime),
		memo: values.memo,
		tagIds: values.tagIds,
		storeId: values.storeId,
		currencyId: values.currencyId,
	};
	if (values.type === "cash_game") {
		return {
			...common,
			type: "cash_game" as const,
			buyIn: values.buyIn,
			cashOut: values.cashOut,
			variant: values.variant,
			blind1: values.blind1,
			blind2: values.blind2,
			blind3: values.blind3,
			ante: values.ante,
			anteType: values.anteType as "none" | "all" | "bb" | undefined,
			tableSize: values.tableSize,
			ringGameId: values.ringGameId,
		};
	}
	return {
		...common,
		type: "tournament" as const,
		tournamentBuyIn: values.tournamentBuyIn,
		entryFee: values.entryFee,
		placement: values.placement,
		totalEntries: values.totalEntries,
		prizeMoney: values.prizeMoney,
		rebuyCount: values.rebuyCount,
		rebuyCost: values.rebuyCost,
		addonCost: values.addonCost,
		bountyPrizes: values.bountyPrizes,
		tournamentId: values.tournamentId,
	};
}

function buildUpdatePayload(values: SessionFormValues & { id: string }) {
	const common = {
		id: values.id,
		sessionDate: Math.floor(new Date(values.sessionDate).getTime() / 1000),
		startedAt: timeToUnix(values.sessionDate, values.startTime) ?? null,
		endedAt: timeToUnix(values.sessionDate, values.endTime) ?? null,
		memo: values.memo,
		tagIds: values.tagIds,
		storeId: values.storeId ?? null,
		currencyId: values.currencyId ?? null,
	};
	if (values.type === "cash_game") {
		return {
			...common,
			buyIn: values.buyIn,
			cashOut: values.cashOut,
			variant: values.variant,
			blind1: values.blind1,
			blind2: values.blind2,
			blind3: values.blind3,
			ante: values.ante,
			anteType: values.anteType as "none" | "all" | "bb" | undefined,
			tableSize: values.tableSize,
			ringGameId: values.ringGameId ?? null,
		};
	}
	return {
		...common,
		tournamentBuyIn: values.tournamentBuyIn,
		entryFee: values.entryFee,
		placement: values.placement,
		totalEntries: values.totalEntries,
		prizeMoney: values.prizeMoney,
		rebuyCount: values.rebuyCount,
		rebuyCost: values.rebuyCost,
		addonCost: values.addonCost,
		bountyPrizes: values.bountyPrizes,
		tournamentId: values.tournamentId ?? null,
	};
}

function buildOptimisticItem(newSession: SessionFormValues): SessionItem {
	const item: SessionItem = {
		id: `temp-${Date.now()}`,
		type: newSession.type,
		sessionDate: newSession.sessionDate,
		buyIn: null,
		cashOut: null,
		evCashOut: null,
		tournamentBuyIn: null,
		entryFee: null,
		placement: null,
		totalEntries: null,
		prizeMoney: null,
		rebuyCount: null,
		rebuyCost: null,
		addonCost: null,
		bountyPrizes: null,
		profitLoss: 0,
		startedAt: null,
		endedAt: null,
		memo: newSession.memo ?? null,
		storeId: newSession.storeId ?? null,
		storeName: null,
		ringGameId: null,
		ringGameName: null,
		tournamentId: null,
		tournamentName: null,
		currencyId: newSession.currencyId ?? null,
		currencyName: null,
		createdAt: new Date().toISOString(),
		tags: [],
	};
	if (newSession.type === "cash_game") {
		item.buyIn = newSession.buyIn;
		item.cashOut = newSession.cashOut;
		item.profitLoss = newSession.cashOut - newSession.buyIn;
	} else {
		item.tournamentBuyIn = newSession.tournamentBuyIn;
		item.entryFee = newSession.entryFee ?? null;
	}
	return item;
}

function buildEditDefaults(session: SessionItem) {
	return {
		type: session.type as "cash_game" | "tournament",
		sessionDate: formatDateForInput(session.sessionDate),
		buyIn: session.buyIn ?? 0,
		cashOut: session.cashOut ?? 0,
		tournamentBuyIn: session.tournamentBuyIn ?? 0,
		entryFee: session.entryFee ?? undefined,
		placement: session.placement ?? undefined,
		totalEntries: session.totalEntries ?? undefined,
		prizeMoney: session.prizeMoney ?? undefined,
		rebuyCount: session.rebuyCount ?? undefined,
		rebuyCost: session.rebuyCost ?? undefined,
		addonCost: session.addonCost ?? undefined,
		bountyPrizes: session.bountyPrizes ?? undefined,
		startTime: formatTimeFromDate(session.startedAt),
		endTime: formatTimeFromDate(session.endedAt),
		memo: session.memo ?? undefined,
		tagIds: session.tags.map((t) => t.id),
		storeId: session.storeId ?? undefined,
		ringGameId: session.ringGameId ?? undefined,
		tournamentId: session.tournamentId ?? undefined,
		currencyId: session.currencyId ?? undefined,
	};
}

function filtersToListInput(filters: SessionFilterValues) {
	return {
		type: filters.type,
		storeId: filters.storeId,
		dateFrom: filters.dateFrom
			? Math.floor(new Date(filters.dateFrom).getTime() / 1000)
			: undefined,
		dateTo: filters.dateTo
			? Math.floor(new Date(`${filters.dateTo}T23:59:59`).getTime() / 1000)
			: undefined,
	};
}

function SessionsPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingSession, setEditingSession] = useState<SessionItem | null>(
		null
	);
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>();
	const [editStoreId, setEditStoreId] = useState<string | undefined>();
	const [filters, setFilters] = useState<SessionFilterValues>({});

	const queryClient = useQueryClient();

	const listInput = filtersToListInput(filters);
	const sessionListKey = trpc.session.list.queryOptions(listInput).queryKey;

	const sessionsQuery = useQuery(trpc.session.list.queryOptions(listInput));
	const sessions = sessionsQuery.data?.items ?? [];
	const summary = sessionsQuery.data?.summary;

	const tagsQuery = useQuery(trpc.sessionTag.list.queryOptions());
	const availableTags = tagsQuery.data ?? [];

	const { stores, currencies } = useEntityLists();
	const createGames = useStoreGames(selectedStoreId);
	const editGames = useStoreGames(editStoreId);

	const createTagMutation = useMutation({
		mutationFn: (name: string) => trpcClient.sessionTag.create.mutate({ name }),
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: trpc.sessionTag.list.queryOptions().queryKey,
			});
		},
	});

	const handleCreateTag = async (name: string) => {
		const result = await createTagMutation.mutateAsync(name);
		return { id: result.id, name: result.name };
	};

	const createMutation = useMutation({
		mutationFn: (values: SessionFormValues) =>
			trpcClient.session.create.mutate(buildCreatePayload(values)),
		onMutate: async (newSession) => {
			await queryClient.cancelQueries({ queryKey: sessionListKey });
			const previous = queryClient.getQueryData(sessionListKey);
			queryClient.setQueryData(sessionListKey, (old) => {
				if (!old) {
					return old;
				}
				return {
					...old,
					items: [buildOptimisticItem(newSession), ...old.items],
				};
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(sessionListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: sessionListKey });
		},
		onSuccess: () => {
			setIsCreateOpen(false);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: SessionFormValues & { id: string }) =>
			trpcClient.session.update.mutate(buildUpdatePayload(values)),
		onMutate: async (updated) => {
			await queryClient.cancelQueries({ queryKey: sessionListKey });
			const previous = queryClient.getQueryData(sessionListKey);
			queryClient.setQueryData(sessionListKey, (old) => {
				if (!old) {
					return old;
				}
				return {
					...old,
					items: old.items.map((s) =>
						s.id === updated.id
							? {
									...s,
									sessionDate: updated.sessionDate,
									memo: updated.memo ?? null,
								}
							: s
					),
				};
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(sessionListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: sessionListKey });
		},
		onSuccess: () => {
			setEditingSession(null);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.session.delete.mutate({ id }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: sessionListKey });
			const previous = queryClient.getQueryData(sessionListKey);
			queryClient.setQueryData(sessionListKey, (old) => {
				if (!old) {
					return old;
				}
				return { ...old, items: old.items.filter((s) => s.id !== id) };
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(sessionListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: sessionListKey });
		},
	});

	const handleCreate = (values: SessionFormValues) => {
		createMutation.mutate(values);
	};

	const handleUpdate = (values: SessionFormValues) => {
		if (!editingSession) {
			return;
		}
		updateMutation.mutate({ id: editingSession.id, ...values });
	};

	const handleDelete = (id: string) => {
		deleteMutation.mutate(id);
	};

	return (
		<div className="p-4 md:p-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Sessions</h1>
				<Button onClick={() => setIsCreateOpen(true)}>
					<IconPlus size={16} />
					New Session
				</Button>
			</div>

			{summary && <SessionSummary summary={summary} />}
			<SessionFilters
				filters={filters}
				onFiltersChange={setFilters}
				stores={stores}
			/>

			{sessions.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
					<IconCards size={48} />
					<p className="text-lg">No sessions yet</p>
					<p className="text-sm">
						Record your first poker session to start tracking P&L.
					</p>
					<Button onClick={() => setIsCreateOpen(true)} variant="outline">
						<IconPlus size={16} />
						New Session
					</Button>
				</div>
			) : (
				<div className="flex flex-col gap-2">
					{sessions.map((s) => (
						<SessionCard
							key={s.id}
							onDelete={handleDelete}
							onEdit={(session) => {
								setEditingSession(session);
								setEditStoreId(session.storeId ?? undefined);
							}}
							session={s}
						/>
					))}
				</div>
			)}

			<ResponsiveDialog
				onOpenChange={(open) => {
					setIsCreateOpen(open);
					if (!open) {
						setSelectedStoreId(undefined);
					}
				}}
				open={isCreateOpen}
				title="New Session"
			>
				<SessionForm
					currencies={currencies}
					isLoading={createMutation.isPending}
					onCreateTag={handleCreateTag}
					onStoreChange={setSelectedStoreId}
					onSubmit={handleCreate}
					ringGames={createGames.ringGames}
					stores={stores}
					tags={availableTags}
					tournaments={createGames.tournaments}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingSession(null);
						setEditStoreId(undefined);
					}
				}}
				open={editingSession !== null}
				title="Edit Session"
			>
				{editingSession && (
					<SessionForm
						currencies={currencies}
						defaultValues={buildEditDefaults(editingSession)}
						isLoading={updateMutation.isPending}
						onCreateTag={handleCreateTag}
						onStoreChange={setEditStoreId}
						onSubmit={handleUpdate}
						ringGames={editGames.ringGames}
						stores={stores}
						tags={availableTags}
						tournaments={editGames.tournaments}
					/>
				)}
			</ResponsiveDialog>
		</div>
	);
}

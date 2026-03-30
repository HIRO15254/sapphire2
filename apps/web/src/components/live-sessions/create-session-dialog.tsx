import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CreateCashGameSessionForm } from "@/components/live-cash-game/create-cash-game-session-form";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

function useStoreRingGames(storeId: string | undefined) {
	const ringGamesQuery = useQuery({
		...trpc.ringGame.listByStore.queryOptions({ storeId: storeId ?? "" }),
		enabled: !!storeId,
	});
	return (ringGamesQuery.data ?? []).map((g) => ({
		id: g.id,
		name: g.name,
		maxBuyIn: g.maxBuyIn,
		currencyId: g.currencyId,
	}));
}

interface CreateSessionDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function CreateSessionDialog({
	open,
	onOpenChange,
}: CreateSessionDialogProps) {
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const storesQuery = useQuery(trpc.store.list.queryOptions());
	const stores = (storesQuery.data ?? []).map((s) => ({
		id: s.id,
		name: s.name,
	}));

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = (currenciesQuery.data ?? []).map((c) => ({
		id: c.id,
		name: c.name,
	}));

	const ringGames = useStoreRingGames(selectedStoreId);

	const sessionListKey = trpc.liveCashGameSession.list.queryOptions(
		{}
	).queryKey;

	const createMutation = useMutation({
		mutationFn: (values: {
			currencyId?: string;
			initialBuyIn: number;
			memo?: string;
			ringGameId?: string;
			storeId?: string;
		}) => trpcClient.liveCashGameSession.create.mutate(values),
		onSuccess: async (data) => {
			await queryClient.invalidateQueries({ queryKey: sessionListKey });
			onOpenChange(false);
			await navigate({
				to: "/live-sessions/cash-game/$sessionId",
				params: { sessionId: data.id },
			});
		},
	});

	return (
		<ResponsiveDialog
			onOpenChange={(o) => {
				onOpenChange(o);
				if (!o) {
					setSelectedStoreId(undefined);
				}
			}}
			open={open}
			title="New Cash Game"
		>
			<CreateCashGameSessionForm
				currencies={currencies}
				isLoading={createMutation.isPending}
				onStoreChange={setSelectedStoreId}
				onSubmit={(values) => createMutation.mutate(values)}
				ringGames={ringGames}
				stores={stores}
			/>
		</ResponsiveDialog>
	);
}

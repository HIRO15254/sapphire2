import { IconCards, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SessionCard } from "@/components/sessions/session-card";
import { SessionForm } from "@/components/sessions/session-form";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/sessions/")({
	component: SessionsPage,
});

interface SessionFormValues {
	addonCost?: number;
	bountyPrizes?: number;
	buyIn?: number;
	cashOut?: number;
	entryFee?: number;
	placement?: number;
	prizeMoney?: number;
	rebuyCost?: number;
	rebuyCount?: number;
	sessionDate: number;
	totalEntries?: number;
	tournamentBuyIn?: number;
	type: "cash_game" | "tournament";
}

interface SessionItem {
	addonCost: number | null;
	bountyPrizes: number | null;
	buyIn: number | null;
	cashOut: number | null;
	createdAt: Date | string;
	entryFee: number | null;
	id: string;
	placement: number | null;
	prizeMoney: number | null;
	profitLoss: number;
	rebuyCost: number | null;
	rebuyCount: number | null;
	sessionDate: Date | string;
	totalEntries: number | null;
	tournamentBuyIn: number | null;
	type: string;
}

function SessionsPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingSession, setEditingSession] = useState<SessionItem | null>(
		null
	);

	const queryClient = useQueryClient();
	const sessionListKey = trpc.session.list.queryOptions().queryKey;

	const sessionsQuery = useQuery(trpc.session.list.queryOptions());
	const sessions = sessionsQuery.data?.items ?? [];

	const createMutation = useMutation({
		mutationFn: (values: SessionFormValues) =>
			trpcClient.session.create.mutate(values),
		onMutate: async () => {
			await queryClient.cancelQueries({ queryKey: sessionListKey });
			const previous = queryClient.getQueryData(sessionListKey);
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
			trpcClient.session.update.mutate(values),
		onMutate: async () => {
			await queryClient.cancelQueries({ queryKey: sessionListKey });
			const previous = queryClient.getQueryData(sessionListKey);
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
				return {
					...old,
					items: old.items.filter((s: { id: string }) => s.id !== id),
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

			{sessions.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
					<IconCards size={48} />
					<p className="text-lg">No sessions yet</p>
					<p className="text-sm">
						Record your first session to start tracking P&L.
					</p>
					<Button onClick={() => setIsCreateOpen(true)} variant="outline">
						<IconPlus size={16} />
						New Session
					</Button>
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{sessions.map((session) => (
						<SessionCard
							key={session.id}
							onDelete={handleDelete}
							onEdit={setEditingSession}
							session={session}
						/>
					))}
				</div>
			)}

			<ResponsiveDialog
				onOpenChange={setIsCreateOpen}
				open={isCreateOpen}
				title="New Session"
			>
				<SessionForm
					isLoading={createMutation.isPending}
					onSubmit={handleCreate}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingSession(null);
					}
				}}
				open={editingSession !== null}
				title="Edit Session"
			>
				{editingSession && (
					<SessionForm
						defaultValues={{
							type: editingSession.type as "cash_game" | "tournament",
							sessionDate:
								typeof editingSession.sessionDate === "string"
									? new Date(editingSession.sessionDate).getTime()
									: editingSession.sessionDate.getTime(),
							buyIn: editingSession.buyIn ?? undefined,
							cashOut: editingSession.cashOut ?? undefined,
							tournamentBuyIn: editingSession.tournamentBuyIn ?? undefined,
							entryFee: editingSession.entryFee ?? undefined,
							placement: editingSession.placement ?? undefined,
							totalEntries: editingSession.totalEntries ?? undefined,
							prizeMoney: editingSession.prizeMoney ?? undefined,
							rebuyCount: editingSession.rebuyCount ?? undefined,
							rebuyCost: editingSession.rebuyCost ?? undefined,
							addonCost: editingSession.addonCost ?? undefined,
							bountyPrizes: editingSession.bountyPrizes ?? undefined,
						}}
						disableTypeChange
						isLoading={updateMutation.isPending}
						onSubmit={handleUpdate}
					/>
				)}
			</ResponsiveDialog>
		</div>
	);
}

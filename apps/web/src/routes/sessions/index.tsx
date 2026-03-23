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
	buyIn: number;
	cashOut: number;
	sessionDate: string;
	type: "cash_game";
}

interface SessionItem {
	buyIn: number | null;
	cashOut: number | null;
	createdAt: Date | string;
	id: string;
	profitLoss: number;
	sessionDate: Date | string;
	type: "cash_game" | "tournament";
}

function SessionsPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingSession, setEditingSession] = useState<SessionItem | null>(
		null
	);

	const queryClient = useQueryClient();
	const sessionListKey = trpc.session.list.queryOptions({}).queryKey;

	const sessionsQuery = useQuery(trpc.session.list.queryOptions({}));
	const sessions = sessionsQuery.data?.items ?? [];

	const createMutation = useMutation({
		mutationFn: (values: SessionFormValues) =>
			trpcClient.session.create.mutate({
				type: values.type,
				sessionDate: Math.floor(new Date(values.sessionDate).getTime() / 1000),
				buyIn: values.buyIn,
				cashOut: values.cashOut,
			}),
		onMutate: async (newSession) => {
			await queryClient.cancelQueries({ queryKey: sessionListKey });
			const previous = queryClient.getQueryData(sessionListKey);
			queryClient.setQueryData(sessionListKey, (old) => {
				if (!old) {
					return old;
				}
				return {
					...old,
					items: [
						{
							id: `temp-${Date.now()}`,
							type: newSession.type as "cash_game" | "tournament",
							sessionDate: new Date(newSession.sessionDate),
							buyIn: newSession.buyIn,
							cashOut: newSession.cashOut,
							profitLoss: newSession.cashOut - newSession.buyIn,
							createdAt: new Date(),
						},
						...old.items,
					],
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
			trpcClient.session.update.mutate({
				id: values.id,
				sessionDate: Math.floor(new Date(values.sessionDate).getTime() / 1000),
				buyIn: values.buyIn,
				cashOut: values.cashOut,
			}),
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
									sessionDate: new Date(updated.sessionDate),
									buyIn: updated.buyIn,
									cashOut: updated.cashOut,
									profitLoss: updated.cashOut - updated.buyIn,
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
				return {
					...old,
					items: old.items.filter((s) => s.id !== id),
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

	const formatDateForInput = (date: Date | string): string => {
		const d = typeof date === "string" ? new Date(date) : date;
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
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
							onEdit={setEditingSession}
							session={s}
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
							sessionDate: formatDateForInput(editingSession.sessionDate),
							buyIn: editingSession.buyIn ?? 0,
							cashOut: editingSession.cashOut ?? 0,
						}}
						isLoading={updateMutation.isPending}
						onSubmit={handleUpdate}
					/>
				)}
			</ResponsiveDialog>
		</div>
	);
}

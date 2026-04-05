import { IconBuildingStore, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StoreCard } from "@/components/stores/store-card";
import { StoreForm } from "@/components/stores/store-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/stores/")({
	component: StoresPage,
});

interface StoreValues {
	memo?: string;
	name: string;
}

interface StoreItem {
	id: string;
	memo?: string | null;
	name: string;
}

function StoresPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingStore, setEditingStore] = useState<StoreItem | null>(null);

	const queryClient = useQueryClient();
	const storeListKey = trpc.store.list.queryOptions().queryKey;

	const storesQuery = useQuery(trpc.store.list.queryOptions());
	const stores = storesQuery.data ?? [];

	const createMutation = useMutation({
		mutationFn: (values: StoreValues) => trpcClient.store.create.mutate(values),
		onMutate: async (newStore) => {
			await queryClient.cancelQueries({ queryKey: storeListKey });
			const previous = queryClient.getQueryData(storeListKey);
			queryClient.setQueryData(storeListKey, (old) => {
				if (!old) {
					return old;
				}
				const base = old[0];
				return [
					...old,
					{
						...base,
						id: `temp-${Date.now()}`,
						name: newStore.name,
						memo: newStore.memo ?? null,
					},
				];
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(storeListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: storeListKey });
		},
		onSuccess: () => {
			setIsCreateOpen(false);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: StoreValues & { id: string }) =>
			trpcClient.store.update.mutate(values),
		onMutate: async (updated) => {
			await queryClient.cancelQueries({ queryKey: storeListKey });
			const previous = queryClient.getQueryData(storeListKey);
			queryClient.setQueryData(storeListKey, (old) =>
				old?.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(storeListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: storeListKey });
		},
		onSuccess: () => {
			setEditingStore(null);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.store.delete.mutate({ id }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: storeListKey });
			const previous = queryClient.getQueryData(storeListKey);
			queryClient.setQueryData(storeListKey, (old) =>
				old?.filter((s) => s.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(storeListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: storeListKey });
		},
	});

	const handleCreate = (values: StoreValues) => {
		createMutation.mutate(values);
	};

	const handleUpdate = (values: StoreValues) => {
		if (!editingStore) {
			return;
		}
		updateMutation.mutate({ id: editingStore.id, ...values });
	};

	const handleDelete = (id: string) => {
		deleteMutation.mutate(id);
	};

	return (
		<div className="p-4 md:p-6">
			<PageHeader
				actions={
					<Button onClick={() => setIsCreateOpen(true)}>
						<IconPlus size={16} />
						New Store
					</Button>
				}
				heading="Stores"
			/>

			{stores.length === 0 ? (
				<EmptyState
					action={
						<Button onClick={() => setIsCreateOpen(true)} variant="outline">
							<IconPlus size={16} />
							New Store
						</Button>
					}
					description="Create your first store to get started."
					heading="No stores yet"
					icon={<IconBuildingStore size={48} />}
				/>
			) : (
				<div className="flex flex-col gap-2">
					{stores.map((store) => (
						<StoreCard
							key={store.id}
							onDelete={handleDelete}
							onEdit={setEditingStore}
							store={store}
						/>
					))}
				</div>
			)}

			<ResponsiveDialog
				onOpenChange={setIsCreateOpen}
				open={isCreateOpen}
				title="New Store"
			>
				<StoreForm
					isLoading={createMutation.isPending}
					onSubmit={handleCreate}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingStore(null);
					}
				}}
				open={editingStore !== null}
				title="Edit Store"
			>
				{editingStore && (
					<StoreForm
						defaultValues={{
							name: editingStore.name,
							memo: editingStore.memo ?? undefined,
						}}
						isLoading={updateMutation.isPending}
						onSubmit={handleUpdate}
					/>
				)}
			</ResponsiveDialog>
		</div>
	);
}

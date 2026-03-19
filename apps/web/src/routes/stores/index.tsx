import { IconBuildingStore, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { StoreCard } from "@/components/stores/store-card";
import { StoreForm } from "@/components/stores/store-form";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
	const [isSubmitting, setIsSubmitting] = useState(false);

	const storesQuery = useQuery(trpc.store.list.queryOptions());
	const stores = storesQuery.data ?? [];

	const handleCreate = async (values: StoreValues) => {
		setIsSubmitting(true);
		try {
			await trpcClient.store.create.mutate(values);
			await storesQuery.refetch();
			setIsCreateOpen(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleUpdate = async (values: StoreValues) => {
		if (!editingStore) {
			return;
		}
		setIsSubmitting(true);
		try {
			await trpcClient.store.update.mutate({ id: editingStore.id, ...values });
			await storesQuery.refetch();
			setEditingStore(null);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async (id: string) => {
		await trpcClient.store.delete.mutate({ id });
		await storesQuery.refetch();
	};

	return (
		<div className="p-4 md:p-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Stores</h1>
				<Button onClick={() => setIsCreateOpen(true)}>
					<IconPlus size={16} />
					New Store
				</Button>
			</div>

			{stores.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
					<IconBuildingStore size={48} />
					<p className="text-lg">No stores yet</p>
					<p className="text-sm">Create your first store to get started.</p>
					<Button onClick={() => setIsCreateOpen(true)} variant="outline">
						<IconPlus size={16} />
						New Store
					</Button>
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

			<Dialog onOpenChange={setIsCreateOpen} open={isCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New Store</DialogTitle>
					</DialogHeader>
					<StoreForm isLoading={isSubmitting} onSubmit={handleCreate} />
				</DialogContent>
			</Dialog>

			<Dialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingStore(null);
					}
				}}
				open={editingStore !== null}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Store</DialogTitle>
					</DialogHeader>
					{editingStore && (
						<StoreForm
							defaultValues={{
								name: editingStore.name,
								memo: editingStore.memo ?? undefined,
							}}
							isLoading={isSubmitting}
							onSubmit={handleUpdate}
						/>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

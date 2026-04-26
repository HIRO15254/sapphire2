import { IconBuildingStore, IconPlus } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { StoreCard } from "@/features/stores/components/store-card";
import { StoreForm } from "@/features/stores/components/store-form";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { useStoresPage } from "./-use-stores-page";

export const Route = createFileRoute("/stores/")({
	component: StoresPage,
});

function StoresPage() {
	const {
		stores,
		isCreatePending,
		isUpdatePending,
		isCreateOpen,
		editingStore,
		setIsCreateOpen,
		setEditingStore,
		handleCreate,
		handleUpdate,
		handleDelete,
		handleCloseEdit,
	} = useStoresPage();

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
				<StoreForm isLoading={isCreatePending} onSubmit={handleCreate} />
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						handleCloseEdit();
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
						isLoading={isUpdatePending}
						onSubmit={handleUpdate}
					/>
				)}
			</ResponsiveDialog>
		</div>
	);
}

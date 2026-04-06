import { IconBuildingStore, IconPlus } from "@tabler/icons-react"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { StoreCard } from "@/components/stores/store-card"
import { StoreForm } from "@/components/stores/store-form"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import type { StoreItem, StoreValues } from "@/hooks/use-stores"
import { useStores } from "@/hooks/use-stores"

export const Route = createFileRoute("/stores/")({
	component: StoresPage,
})

function StoresPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [editingStore, setEditingStore] = useState<StoreItem | null>(null)

	const { stores, isCreatePending, isUpdatePending, create, update, delete: deleteStore } = useStores()

	const handleCreate = (values: StoreValues) => {
		create(values).then(() => {
			setIsCreateOpen(false)
		})
	}

	const handleUpdate = (values: StoreValues) => {
		if (!editingStore) {
			return
		}
		update({ id: editingStore.id, ...values }).then(() => {
			setEditingStore(null)
		})
	}

	const handleDelete = (id: string) => {
		deleteStore(id)
	}

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
					isLoading={isCreatePending}
					onSubmit={handleCreate}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingStore(null)
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
	)
}

import { DeleteStoreDialog } from "@/features/stores/components/delete-store-dialog";
import { RingGameTab } from "@/features/stores/components/ring-game-tab";
import { StoreActionsDrawer } from "@/features/stores/components/store-actions-drawer";
import { StoreForm } from "@/features/stores/components/store-form";
import { TournamentTab } from "@/features/stores/components/tournament-tab";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import { StoreDetailSkeleton } from "./store-detail-skeleton";
import { TopBar } from "./top-bar";
import { useStoreDetailPage } from "./use-store-detail-page";

const EDIT_STORE_FORM_ID = "store-edit-form";

interface StoreDetailPageProps {
	storeId: string;
}

export function StoreDetailPage({ storeId }: StoreDetailPageProps) {
	const {
		store,
		isLoading,
		isUpdatePending,
		isActionsOpen,
		isEditOpen,
		confirmingDelete,
		setIsActionsOpen,
		setIsEditOpen,
		setConfirmingDelete,
		openEditFromActions,
		openDeleteFromActions,
		handleEdit,
		handleConfirmDelete,
	} = useStoreDetailPage(storeId);

	if (isLoading) {
		return (
			<div className="theme-v2 min-h-full bg-background text-foreground">
				<div className="p-4">
					<StoreDetailSkeleton />
				</div>
			</div>
		);
	}

	if (!store) {
		return (
			<div className="theme-v2 min-h-full bg-background text-foreground">
				<div className="p-4">
					<TopBar />
					<PageHeader heading="Store not found" />
					<p className="py-16 text-center text-muted-foreground text-sm">
						This store may have been deleted.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="theme-v2 min-h-full bg-background text-foreground">
			<div className="p-4">
				<TopBar onOpenActions={() => setIsActionsOpen(true)} />
				<PageHeader
					description={store.memo ?? undefined}
					heading={store.name}
				/>

				<Tabs defaultValue="ring-games">
					<TabsList className="w-full">
						<TabsTrigger value="ring-games">Cash games</TabsTrigger>
						<TabsTrigger value="tournaments">Tournaments</TabsTrigger>
					</TabsList>
					<TabsContent value="ring-games">
						<RingGameTab storeId={storeId} />
					</TabsContent>
					<TabsContent value="tournaments">
						<TournamentTab storeId={storeId} />
					</TabsContent>
				</Tabs>

				<StoreActionsDrawer
					onDelete={openDeleteFromActions}
					onEdit={openEditFromActions}
					onOpenChange={setIsActionsOpen}
					open={isActionsOpen}
				/>

				<FormSheet
					contentClassName="theme-v2"
					formId={EDIT_STORE_FORM_ID}
					isLoading={isUpdatePending}
					onOpenChange={setIsEditOpen}
					open={isEditOpen}
					title="Edit store"
				>
					<StoreForm
						defaultValues={{
							name: store.name,
							memo: store.memo ?? undefined,
						}}
						formId={EDIT_STORE_FORM_ID}
						onSubmit={handleEdit}
					/>
				</FormSheet>

				<DeleteStoreDialog
					onConfirm={handleConfirmDelete}
					onOpenChange={setConfirmingDelete}
					open={confirmingDelete}
					storeName={store.name}
				/>
			</div>
		</div>
	);
}

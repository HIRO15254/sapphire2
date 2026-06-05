import { IconPlus } from "@tabler/icons-react";
import { StoreForm } from "@/features/stores/components/store-form";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { StoreList } from "./store-list";
import { useStoresPage } from "./use-stores-page";

const CREATE_FORM_ID = "store-create-form";

export function StoresPage() {
	const {
		stores,
		isLoading,
		isCreateOpen,
		isCreatePending,
		setIsCreateOpen,
		handleCreate,
	} = useStoresPage();

	return (
		<div className="theme-v2 min-h-full bg-background text-foreground">
			<div className="p-4">
				<PageHeader
					actions={
						<Button onClick={() => setIsCreateOpen(true)} size="sm">
							<IconPlus size={16} />
							New store
						</Button>
					}
					heading="Stores"
				/>

				<StoreList
					isLoading={isLoading}
					onCreate={() => setIsCreateOpen(true)}
					stores={stores}
				/>

				<FormSheet
					contentClassName="theme-v2"
					formId={CREATE_FORM_ID}
					isLoading={isCreatePending}
					onOpenChange={setIsCreateOpen}
					open={isCreateOpen}
					title="New store"
				>
					<StoreForm formId={CREATE_FORM_ID} onSubmit={handleCreate} />
				</FormSheet>
			</div>
		</div>
	);
}

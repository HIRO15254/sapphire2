import { IconPlus } from "@tabler/icons-react";
import { ItemFormV2 } from "@/features/items/components/item-form";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { ItemList } from "./item-list";
import { useItemsPage } from "./use-items-page";

const CREATE_FORM_ID = "item-create-form";

export function ItemsPage() {
	const {
		items,
		isLoading,
		isError,
		retry,
		isCreateOpen,
		isCreatePending,
		setIsCreateOpen,
		handleCreate,
	} = useItemsPage();

	return (
		<div className="min-h-full bg-background text-foreground">
			<div className="p-4">
				<PageHeader
					actions={
						<Button onClick={() => setIsCreateOpen(true)} size="sm">
							<IconPlus size={16} />
							New item
						</Button>
					}
					heading="Items"
				/>

				<ItemList
					isError={isError}
					isLoading={isLoading}
					items={items}
					onCreate={() => setIsCreateOpen(true)}
					onRetry={retry}
				/>

				<FormSheet
					formId={CREATE_FORM_ID}
					isLoading={isCreatePending}
					onOpenChange={setIsCreateOpen}
					open={isCreateOpen}
					title="New item"
				>
					<ItemFormV2 formId={CREATE_FORM_ID} onSubmit={handleCreate} />
				</FormSheet>
			</div>
		</div>
	);
}

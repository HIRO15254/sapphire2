import { IconCoins, IconPlus } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { CurrencyFormV2 } from "@/features/currencies/v2/components/currency-form";
import { CurrencyListCard } from "@/features/currencies/v2/components/currency-list-card";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { useCurrenciesPage } from "./-use-currencies-page";

export const Route = createFileRoute("/currencies/")({
	component: CurrenciesPage,
});

const CREATE_FORM_ID = "currency-create-form";

function CurrenciesPage() {
	const {
		currencies,
		isCreateOpen,
		isCreatePending,
		setIsCreateOpen,
		handleCreate,
	} = useCurrenciesPage();

	return (
		<div className="theme-v2 min-h-full bg-background text-foreground">
			<div className="p-4">
				<PageHeader
					actions={
						<Button onClick={() => setIsCreateOpen(true)} size="sm">
							<IconPlus size={16} />
							New currency
						</Button>
					}
					heading="Currencies"
				/>

				{currencies.length === 0 ? (
					<EmptyState
						action={
							<Button onClick={() => setIsCreateOpen(true)} variant="outline">
								<IconPlus size={16} />
								New currency
							</Button>
						}
						description="Create your first currency to start tracking balances."
						heading="No currencies yet"
						icon={<IconCoins size={48} />}
					/>
				) : (
					<div className="flex flex-col gap-2">
						{currencies.map((c) => (
							<CurrencyListCard currency={c} key={c.id} />
						))}
					</div>
				)}

				<Drawer
					dismissible={false}
					onOpenChange={setIsCreateOpen}
					open={isCreateOpen}
				>
					<DrawerContent className="theme-v2 rounded-t-xl">
						<DrawerHeader>
							<DrawerTitle>New currency</DrawerTitle>
							<DrawerDescription className="sr-only">
								New currency dialog
							</DrawerDescription>
						</DrawerHeader>
						<div className="overflow-y-auto px-4">
							<CurrencyFormV2 formId={CREATE_FORM_ID} onSubmit={handleCreate} />
						</div>
						<DrawerFooter className="flex-row justify-end pb-[calc(1rem+env(safe-area-inset-bottom))]">
							<Button
								onClick={() => setIsCreateOpen(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								disabled={isCreatePending}
								form={CREATE_FORM_ID}
								type="submit"
							>
								{isCreatePending ? "Saving..." : "Save"}
							</Button>
						</DrawerFooter>
					</DrawerContent>
				</Drawer>
			</div>
		</div>
	);
}

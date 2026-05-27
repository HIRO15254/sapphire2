import { IconCoins, IconPlus } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { CurrencyFormV2 } from "@/features/currencies/v2/components/currency-form";
import { CurrencyListCard } from "@/features/currencies/v2/components/currency-list-card";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
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
			<div className="mx-auto max-w-3xl p-4 md:p-6">
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

				<ResponsiveDialog
					contentClassName="theme-v2"
					onOpenChange={setIsCreateOpen}
					open={isCreateOpen}
					primaryAction={{
						form: CREATE_FORM_ID,
						isLoading: isCreatePending,
						label: "Save",
					}}
					title="New currency"
				>
					<CurrencyFormV2 formId={CREATE_FORM_ID} onSubmit={handleCreate} />
				</ResponsiveDialog>
			</div>
		</div>
	);
}

import { IconCoins, IconPlus } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { CurrencyFormV2 } from "@/features/currencies/v2/components/currency-form";
import { CurrencyListCard } from "@/features/currencies/v2/components/currency-list-card";
import { CurrencyListSkeleton } from "@/features/currencies/v2/components/currency-list-skeleton";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { useCurrenciesPage } from "./-use-currencies-page";

export const Route = createFileRoute("/currencies/")({
	component: CurrenciesPage,
});

const CREATE_FORM_ID = "currency-create-form";

function CurrenciesPage() {
	const {
		currencies,
		isLoading,
		isCreateOpen,
		isCreatePending,
		setIsCreateOpen,
		handleCreate,
		handleToggleFavorite,
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

				{(() => {
					if (isLoading) {
						return <CurrencyListSkeleton />;
					}
					if (currencies.length === 0) {
						return (
							<EmptyState
								action={
									<Button
										onClick={() => setIsCreateOpen(true)}
										variant="outline"
									>
										<IconPlus size={16} />
										New currency
									</Button>
								}
								description="Create your first currency to start tracking balances."
								heading="No currencies yet"
								icon={<IconCoins size={48} />}
							/>
						);
					}
					return (
						<div className="flex flex-col gap-2">
							{currencies.map((c) => (
								<CurrencyListCard
									currency={c}
									key={c.id}
									onToggleFavorite={() => handleToggleFavorite(c.id)}
								/>
							))}
						</div>
					);
				})()}

				<FormSheet
					contentClassName="theme-v2"
					formId={CREATE_FORM_ID}
					isLoading={isCreatePending}
					onOpenChange={setIsCreateOpen}
					open={isCreateOpen}
					title="New currency"
				>
					<CurrencyFormV2 formId={CREATE_FORM_ID} onSubmit={handleCreate} />
				</FormSheet>
			</div>
		</div>
	);
}

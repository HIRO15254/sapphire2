import { IconPlus } from "@tabler/icons-react";
import { CurrencyFormV2 } from "@/features/currencies/v2/components/currency-form";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { CurrencyList } from "./currency-list";
import { useCurrenciesPage } from "./use-currencies-page";

const CREATE_FORM_ID = "currency-create-form";

export function CurrenciesPage() {
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

				<CurrencyList
					currencies={currencies}
					isLoading={isLoading}
					onCreate={() => setIsCreateOpen(true)}
					onToggleFavorite={handleToggleFavorite}
				/>

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

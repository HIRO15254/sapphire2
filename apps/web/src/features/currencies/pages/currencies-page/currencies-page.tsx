import { IconPlus } from "@tabler/icons-react";
import { CurrencyFormV2 } from "@/features/currencies/components/currency-form";
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
		isError,
		retry,
		isCreateOpen,
		isCreatePending,
		setIsCreateOpen,
		handleCreate,
		handleToggleFavorite,
	} = useCurrenciesPage();

	return (
		<div className="min-h-full bg-background text-foreground">
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
					isError={isError}
					isLoading={isLoading}
					onCreate={() => setIsCreateOpen(true)}
					onRetry={retry}
					onToggleFavorite={handleToggleFavorite}
				/>

				<FormSheet
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

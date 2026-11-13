import { IconArrowsExchange } from "@tabler/icons-react";
import {
	MemoField,
	SelectField,
	TextField,
} from "@/features/assets/components/form-fields";
import type {
	WalletAsset,
	WalletCategory,
} from "@/features/assets/hooks/use-wallet-data";
import { firstError } from "@/features/assets/utils/form";
import type {
	ExchangeEditSubmit,
	WalletHistoryItem,
	WalletLine,
} from "./ledger-target";
import { useExchangeEditForm } from "./use-exchange-edit-form";

interface ExchangeEditFormProps {
	assets: WalletAsset[];
	categories: WalletCategory[];
	counterpart: WalletHistoryItem["counterpart"];
	formId: string;
	line: WalletLine;
	onSubmit: (values: ExchangeEditSubmit) => Promise<void>;
}

export function ExchangeEditForm(props: ExchangeEditFormProps) {
	const {
		amountLabel,
		categoryOptions,
		form,
		onFormSubmit,
		onTextChange,
		otherText,
	} = useExchangeEditForm(props);

	return (
		<form
			className="flex flex-col gap-3.5 pt-1 pb-2"
			id={props.formId}
			noValidate
			onSubmit={onFormSubmit}
		>
			<div className="bg-muted flex items-center gap-2.5 rounded-md px-3 py-2.5">
				<IconArrowsExchange
					aria-hidden
					className="text-muted-foreground size-4 flex-none"
				/>
				<span className="text-muted-foreground min-w-0 flex-1 text-[length:var(--m-text-footnote)]">
					Other side
				</span>
				<span className="font-mono text-[13px]">{otherText}</span>
			</div>
			<form.Field name="amount">
				{(field) => (
					<TextField
						error={firstError(field.state.meta.errors)}
						id="exchange-edit-amount"
						inputMode="decimal"
						label={amountLabel}
						onBlur={field.handleBlur}
						onChange={onTextChange(field.handleChange)}
						required
						value={field.state.value}
					/>
				)}
			</form.Field>
			<form.Field name="occurredAt">
				{(field) => (
					<TextField
						error={firstError(field.state.meta.errors)}
						id="exchange-edit-occurred-at"
						label="Date and time"
						onBlur={field.handleBlur}
						onChange={onTextChange(field.handleChange)}
						required
						type="datetime-local"
						value={field.state.value}
					/>
				)}
			</form.Field>
			<form.Field name="categoryId">
				{(field) => (
					<SelectField
						id="exchange-edit-category"
						label="Category"
						onValueChange={field.handleChange}
						options={categoryOptions(field.state.value)}
						value={field.state.value}
					/>
				)}
			</form.Field>
			<form.Field name="memo">
				{(field) => (
					<MemoField
						error={firstError(field.state.meta.errors)}
						id="exchange-edit-memo"
						onBlur={field.handleBlur}
						onChange={onTextChange(field.handleChange)}
						value={field.state.value}
					/>
				)}
			</form.Field>
		</form>
	);
}

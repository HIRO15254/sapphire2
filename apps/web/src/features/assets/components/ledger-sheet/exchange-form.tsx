import { IconArrowDown } from "@tabler/icons-react";
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
import type { ExchangeSubmit } from "./ledger-target";
import { useExchangeForm } from "./use-exchange-form";

interface ExchangeFormProps {
	assets: WalletAsset[];
	categories: WalletCategory[];
	formId: string;
	fromId: string | null;
	onSubmit: (values: ExchangeSubmit) => Promise<void>;
}

export function ExchangeForm(props: ExchangeFormProps) {
	const { assetOptions, categoryOptions, form, onFormSubmit, onTextChange } =
		useExchangeForm(props);

	return (
		<form
			className="flex flex-col gap-3.5 pt-1 pb-2"
			id={props.formId}
			noValidate
			onSubmit={onFormSubmit}
		>
			<div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-2">
				<form.Field name="fromId">
					{(field) => (
						<SelectField
							error={firstError(field.state.meta.errors)}
							id="exchange-from"
							label="From"
							onValueChange={field.handleChange}
							options={assetOptions}
							required
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="fromAmount">
					{(field) => (
						<TextField
							error={firstError(field.state.meta.errors)}
							id="exchange-from-amount"
							inputMode="decimal"
							label="Amount"
							onBlur={field.handleBlur}
							onChange={onTextChange(field.handleChange)}
							required
							value={field.state.value}
						/>
					)}
				</form.Field>
			</div>
			<div className="text-muted-foreground flex justify-center">
				<IconArrowDown aria-hidden className="size-5" />
			</div>
			<div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-2">
				<form.Field name="toId">
					{(field) => (
						<SelectField
							error={firstError(field.state.meta.errors)}
							id="exchange-to"
							label="To"
							onValueChange={field.handleChange}
							options={assetOptions}
							required
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="toAmount">
					{(field) => (
						<TextField
							error={firstError(field.state.meta.errors)}
							id="exchange-to-amount"
							inputMode="decimal"
							label="Amount"
							onBlur={field.handleBlur}
							onChange={onTextChange(field.handleChange)}
							required
							value={field.state.value}
						/>
					)}
				</form.Field>
			</div>
			<form.Field name="occurredAt">
				{(field) => (
					<TextField
						error={firstError(field.state.meta.errors)}
						id="exchange-occurred-at"
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
						id="exchange-category"
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
						id="exchange-memo"
						onBlur={field.handleBlur}
						onChange={onTextChange(field.handleChange)}
						value={field.state.value}
					/>
				)}
			</form.Field>
		</form>
	);
}

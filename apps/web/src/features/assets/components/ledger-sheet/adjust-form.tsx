import {
	GroupLabel,
	MemoField,
	SelectField,
	TextField,
} from "@/features/assets/components/form-fields";
import type {
	WalletAsset,
	WalletCategory,
} from "@/features/assets/hooks/use-wallet-data";
import { firstError } from "@/features/assets/utils/form";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
import type { AdjustSubmit, WalletLine } from "./ledger-target";
import { useAdjustForm } from "./use-adjust-form";

interface AdjustFormProps {
	assetId: string | null;
	assets: WalletAsset[];
	categories: WalletCategory[];
	formId: string;
	line: WalletLine | null;
	lockAsset: boolean;
	onSubmit: (values: AdjustSubmit) => Promise<void>;
}

export function AdjustForm(props: AdjustFormProps) {
	const {
		assetOptions,
		categoryOptions,
		form,
		isAssetLocked,
		onDirectionChange,
		onFormSubmit,
		onTextChange,
	} = useAdjustForm(props);

	return (
		<form
			className="flex flex-col gap-3.5 pt-1 pb-2"
			id={props.formId}
			noValidate
			onSubmit={onFormSubmit}
		>
			<form.Field name="assetId">
				{(field) => (
					<SelectField
						disabled={isAssetLocked}
						error={firstError(field.state.meta.errors)}
						id="adjust-asset"
						label="Asset"
						onValueChange={field.handleChange}
						options={assetOptions(field.state.value)}
						required
						value={field.state.value}
					/>
				)}
			</form.Field>
			<form.Field name="direction">
				{(field) => (
					<div className="flex flex-col gap-1.5">
						<GroupLabel id="adjust-direction-label">Direction</GroupLabel>
						<ToggleGroup
							aria-labelledby="adjust-direction-label"
							onValueChange={onDirectionChange(field.handleChange)}
							type="single"
							value={field.state.value}
						>
							<ToggleGroupItem value="add">Add</ToggleGroupItem>
							<ToggleGroupItem value="remove">Remove</ToggleGroupItem>
						</ToggleGroup>
					</div>
				)}
			</form.Field>
			<form.Field name="amount">
				{(field) => (
					<TextField
						error={firstError(field.state.meta.errors)}
						id="adjust-amount"
						inputMode="decimal"
						label="Amount"
						onBlur={field.handleBlur}
						onChange={onTextChange(field.handleChange)}
						required
						value={field.state.value}
					/>
				)}
			</form.Field>
			<form.Field name="categoryId">
				{(field) => (
					<SelectField
						id="adjust-category"
						label="Category"
						onValueChange={field.handleChange}
						options={categoryOptions(field.state.value)}
						value={field.state.value}
					/>
				)}
			</form.Field>
			<form.Field name="occurredAt">
				{(field) => (
					<TextField
						error={firstError(field.state.meta.errors)}
						id="adjust-occurred-at"
						label="Date and time"
						onBlur={field.handleBlur}
						onChange={onTextChange(field.handleChange)}
						required
						type="datetime-local"
						value={field.state.value}
					/>
				)}
			</form.Field>
			<form.Field name="memo">
				{(field) => (
					<MemoField
						error={firstError(field.state.meta.errors)}
						id="adjust-memo"
						onBlur={field.handleBlur}
						onChange={onTextChange(field.handleChange)}
						value={field.state.value}
					/>
				)}
			</form.Field>
		</form>
	);
}

import {
	GroupLabel,
	MemoField,
	SelectField,
	TextField,
} from "@/features/assets/components/form-fields";
import type {
	WalletAsset,
	WalletRate,
} from "@/features/assets/hooks/use-wallet-data";
import { firstError } from "@/features/assets/utils/form";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/shared/components/ui/alert";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
import {
	type Effective,
	type RateFormSubmit,
	selectQuoteAssetId,
	selectWarningInputs,
	useRateForm,
} from "./use-rate-form";

interface RateFormProps {
	assets: WalletAsset[];
	baseAssetId: string;
	baseCurrencyId: string | null;
	defaultEffective: Effective;
	formId: string;
	lockedQuoteId: string | null;
	onSubmit: (values: RateFormSubmit) => Promise<void>;
	rates: WalletRate[];
}

export function RateForm(props: RateFormProps) {
	const {
		conflict,
		form,
		isLocked,
		onEffectiveChange,
		onFormSubmit,
		onTextChange,
		options,
		quoteHint,
		valueLabel,
		warningFor,
	} = useRateForm(props);

	return (
		<form
			className="flex flex-col gap-3.5 pt-1 pb-2"
			id={props.formId}
			noValidate
			onSubmit={onFormSubmit}
		>
			<form.Field name="quoteAssetId">
				{(field) => (
					<SelectField
						disabled={isLocked}
						error={firstError(field.state.meta.errors)}
						id="rate-quote"
						label="Currency"
						onValueChange={field.handleChange}
						options={options}
						required
						value={field.state.value}
					/>
				)}
			</form.Field>
			<form.Subscribe selector={selectQuoteAssetId}>
				{(quoteAssetId) => (
					<form.Field name="value">
						{(field) => (
							<Field
								description={quoteHint(quoteAssetId)}
								error={firstError(field.state.meta.errors)}
								htmlFor="rate-value"
								label={valueLabel}
								required
							>
								<Input
									id="rate-value"
									inputMode="decimal"
									onBlur={field.handleBlur}
									onChange={onTextChange(field.handleChange)}
									size="xl"
									type="text"
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>
				)}
			</form.Subscribe>
			<form.Field name="effective">
				{(field) => (
					<div className="flex flex-col gap-1.5">
						<GroupLabel id="rate-effective-label">Effective</GroupLabel>
						<ToggleGroup
							aria-labelledby="rate-effective-label"
							onValueChange={onEffectiveChange(field.handleChange)}
							type="single"
							value={field.state.value}
						>
							<ToggleGroupItem value="start">From the start</ToggleGroupItem>
							<ToggleGroupItem value="date">From a date</ToggleGroupItem>
						</ToggleGroup>
						{conflict?.field === "effective" ? (
							<p
								className="text-destructive-text m-0 text-[length:var(--m-text-footnote)]"
								role="alert"
							>
								{conflict.message}
							</p>
						) : null}
					</div>
				)}
			</form.Field>
			<form.Subscribe selector={selectWarningInputs}>
				{({ date, effective, quoteAssetId }) => {
					const warning = warningFor(quoteAssetId, effective, date);
					return (
						<>
							{effective === "date" ? (
								<form.Field name="date">
									{(field) => (
										<TextField
											error={
												conflict?.field === "date"
													? conflict.message
													: firstError(field.state.meta.errors)
											}
											id="rate-date"
											label="Start date"
											onBlur={field.handleBlur}
											onChange={onTextChange(field.handleChange)}
											required
											type="date"
											value={field.state.value}
										/>
									)}
								</form.Field>
							) : null}
							{warning ? (
								<Alert variant="warning">
									<AlertTitle>Past valuations change</AlertTitle>
									<AlertDescription>{warning}</AlertDescription>
								</Alert>
							) : null}
						</>
					);
				}}
			</form.Subscribe>
			<form.Field name="memo">
				{(field) => (
					<MemoField
						error={firstError(field.state.meta.errors)}
						id="rate-memo"
						onBlur={field.handleBlur}
						onChange={onTextChange(field.handleChange)}
						value={field.state.value}
					/>
				)}
			</form.Field>
		</form>
	);
}

import { IconPlus, IconX } from "@tabler/icons-react";
import { GroupLabel } from "@/features/assets/components/form-fields";
import type { WalletAsset } from "@/features/assets/hooks/use-wallet-data";
import { firstError } from "@/features/assets/utils/form";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { IconButton } from "@/shared/components/ui/icon-button";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
import {
	type AssetFormSubmit,
	DECIMAL_OPTIONS,
	selectRateLabelParts,
	useAssetForm,
} from "./use-asset-form";

interface AssetFormProps {
	asset: WalletAsset | null;
	currencies: WalletAsset[];
	formId: string;
	onSubmit: (values: AssetFormSubmit) => Promise<void>;
}

function LockNote({ show }: { show: boolean }) {
	return show ? (
		<p className="text-muted-foreground m-0 leading-normal text-[length:var(--m-text-footnote)]">
			Used in records.
		</p>
	) : null;
}

export function AssetForm({
	asset,
	currencies,
	formId,
	onSubmit,
}: AssetFormProps) {
	const {
		form,
		isLocked,
		nameError,
		onAddRate,
		onDecimalsChange,
		onFormSubmit,
		onKindChange,
		onRemoveRate,
		onTextChange,
		quoteOptions,
		showRates,
		totalCurrencies,
	} = useAssetForm({ asset, currencies, onSubmit });

	return (
		<form
			className="flex flex-col gap-3.5 pt-1 pb-2"
			id={formId}
			noValidate
			onSubmit={onFormSubmit}
		>
			<form.Field name="name">
				{(field) => (
					<Field
						error={nameError ?? firstError(field.state.meta.errors)}
						htmlFor="asset-name"
						label="Name"
						required
					>
						<Input
							id="asset-name"
							onBlur={field.handleBlur}
							onChange={onTextChange(field.handleChange, "name")}
							size="xl"
							type="text"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field name="kind">
				{(field) => (
					<div className="flex flex-col gap-1.5">
						<GroupLabel id="asset-kind-label">Kind</GroupLabel>
						<ToggleGroup
							aria-labelledby="asset-kind-label"
							disabled={isLocked}
							onValueChange={onKindChange(field.handleChange)}
							type="single"
							value={field.state.value}
						>
							<ToggleGroupItem value="currency">Currency</ToggleGroupItem>
							<ToggleGroupItem value="item">Item</ToggleGroupItem>
						</ToggleGroup>
						<LockNote show={isLocked} />
					</div>
				)}
			</form.Field>

			<form.Field name="unit">
				{(field) => (
					<Field
						error={firstError(field.state.meta.errors)}
						htmlFor="asset-unit"
						label="Unit"
					>
						<Input
							id="asset-unit"
							onBlur={field.handleBlur}
							onChange={onTextChange(field.handleChange)}
							size="xl"
							type="text"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field name="decimals">
				{(field) => (
					<div className="flex flex-col gap-1.5">
						<Field htmlFor="asset-decimals" label="Decimal places" required>
							<Select
								disabled={isLocked}
								onValueChange={onDecimalsChange(field.handleChange)}
								value={field.state.value}
							>
								<SelectTrigger id="asset-decimals">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{DECIMAL_OPTIONS.map((option) => (
										<SelectItem key={option} value={option}>
											{option}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<LockNote show={isLocked} />
					</div>
				)}
			</form.Field>

			{showRates ? (
				<form.Subscribe selector={selectRateLabelParts}>
					{({ name, unit }) => (
						<form.Field mode="array" name="rates">
							{(ratesField) => (
								<div className="flex flex-col gap-2">
									{ratesField.state.value.length > 0 ? (
										<GroupLabel id="asset-rates-label">{`1 ${unit || name || "unit"} equals`}</GroupLabel>
									) : null}
									{ratesField.state.value.map((row, index) => (
										<div className="flex items-start gap-2" key={row.key}>
											<form.Field name={`rates[${index}].value`}>
												{(field) => (
													<Field
														className="min-w-0 flex-1"
														error={firstError(field.state.meta.errors)}
													>
														<Input
															aria-label={`1 ${unit || name || "unit"} in ${
																currencies.find(
																	(currency) => currency.id === row.quoteAssetId
																)?.name ?? ""
															}`}
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
											<form.Field name={`rates[${index}].quoteAssetId`}>
												{(field) => (
													<div className="w-[124px] flex-none">
														<Select
															onValueChange={field.handleChange}
															value={field.state.value}
														>
															<SelectTrigger aria-label="Currency">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																{quoteOptions(
																	ratesField.state.value,
																	field.state.value
																).map((currency) => (
																	<SelectItem
																		key={currency.id}
																		value={currency.id}
																	>
																		{currency.name}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
												)}
											</form.Field>
											<IconButton
												label="Remove rate"
												onClick={onRemoveRate(index)}
												size="xl"
												type="button"
											>
												<IconX aria-hidden />
											</IconButton>
										</div>
									))}
									{ratesField.state.value.length < totalCurrencies ? (
										<Button
											className="w-full"
											onClick={onAddRate(ratesField.state.value)}
											size="xl"
											type="button"
											variant="outline"
										>
											<IconPlus aria-hidden />
											Add rate
										</Button>
									) : null}
								</div>
							)}
						</form.Field>
					)}
				</form.Subscribe>
			) : null}

			<form.Field name="description">
				{(field) => (
					<Field
						error={firstError(field.state.meta.errors)}
						htmlFor="asset-description"
						label="Description"
					>
						<Textarea
							id="asset-description"
							onBlur={field.handleBlur}
							onChange={onTextChange(field.handleChange)}
							rows={2}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
		</form>
	);
}

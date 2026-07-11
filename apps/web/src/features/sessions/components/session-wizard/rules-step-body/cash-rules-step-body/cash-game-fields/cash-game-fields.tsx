import type { ReactFormExtendedApi } from "@tanstack/react-form";
import { OverrideLabel } from "@/features/sessions/components/override-label";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectWithClear,
} from "@/shared/components/ui/select";
import { VariantSelect } from "@/shared/components/variant-select";
import { useVariantLabels } from "@/shared/hooks/use-variant-labels";

// biome-ignore-start lint/suspicious/noExplicitAny: tanstack-form's ReactFormExtendedApi has 12 generic parameters; threading a fully typed form through child components would require exporting the parent's full form generics.
type AnyForm = ReactFormExtendedApi<
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any
>;
// biome-ignore-end lint/suspicious/noExplicitAny: end

interface CashGameFieldsProps {
	currencies?: Array<{ id: string; name: string }>;
	form: AnyForm;
	isLiveLinked?: boolean;
	onCurrencyChange?: (id: string | undefined) => void;
	/** Field labels that diverge from the picked master ring game. */
	overriddenLabels?: ReadonlySet<string>;
	selectedCurrencyId?: string;
}

const ANTE_TYPES = [
	{ value: "none", label: "No ante" },
	{ value: "bb", label: "BB ante" },
	{ value: "all", label: "All ante" },
] as const;

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

// Stable override-set keys for the blind fields (cashOverriddenFields emits
// these), independent of the variant-aware display labels.
const BLIND_OVERRIDE_KEYS = {
	blind1: "SB",
	blind2: "BB",
	blind3: "Straddle",
} as const;

function CashBlindFields({
	form,
	isLiveLinked,
	overriddenLabels,
	variant,
}: {
	form: AnyForm;
	isLiveLinked: boolean;
	overriddenLabels?: ReadonlySet<string>;
	variant: string;
}) {
	const blindLabels = useVariantLabels(variant || "nlh");
	const blind3Label = blindLabels.blind3;

	return (
		<div
			className={
				blind3Label === null
					? "grid grid-cols-2 gap-3"
					: "grid grid-cols-3 gap-3"
			}
		>
			<form.Field name="blind1">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label={
							<OverrideLabel
								label={blindLabels.blind1}
								overridden={overriddenLabels}
								overrideKey={BLIND_OVERRIDE_KEYS.blind1}
							/>
						}
					>
						<Input
							disabled={isLiveLinked}
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="blind2">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label={
							<OverrideLabel
								label={blindLabels.blind2}
								overridden={overriddenLabels}
								overrideKey={BLIND_OVERRIDE_KEYS.blind2}
							/>
						}
					>
						<Input
							disabled={isLiveLinked}
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			{blind3Label !== null && (
				<form.Field name="blind3">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label={
								<OverrideLabel
									label={blind3Label}
									overridden={overriddenLabels}
									overrideKey={BLIND_OVERRIDE_KEYS.blind3}
								/>
							}
						>
							<Input
								disabled={isLiveLinked}
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
			)}
		</div>
	);
}

export function CashGameFields({
	currencies,
	form,
	isLiveLinked = false,
	onCurrencyChange,
	overriddenLabels,
	selectedCurrencyId,
}: CashGameFieldsProps) {
	return (
		<>
			{currencies && currencies.length > 0 && (
				<Field label="Currency">
					<SelectWithClear
						onValueChange={onCurrencyChange}
						value={selectedCurrencyId}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{currencies.map((c) => (
								<SelectItem key={c.id} value={c.id}>
									{c.name}
								</SelectItem>
							))}
						</SelectContent>
					</SelectWithClear>
				</Field>
			)}

			<form.Field name="variant">
				{(field) => (
					<Field
						htmlFor={field.name}
						label={
							<OverrideLabel label="Variant" overridden={overriddenLabels} />
						}
					>
						<VariantSelect
							disabled={isLiveLinked}
							id={field.name}
							onChange={(v) => field.handleChange(v)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Subscribe selector={(state): string => state.values.variant}>
				{(variant) => (
					<CashBlindFields
						form={form}
						isLiveLinked={isLiveLinked}
						overriddenLabels={overriddenLabels}
						variant={variant}
					/>
				)}
			</form.Subscribe>

			<div className="flex gap-3">
				<form.Field name="anteType">
					{(field) => (
						<Field
							className="flex-1"
							htmlFor={field.name}
							label={
								<OverrideLabel
									label="Ante type"
									overridden={overriddenLabels}
								/>
							}
						>
							<Select
								disabled={isLiveLinked}
								onValueChange={(v) => field.handleChange(v)}
								value={field.state.value}
							>
								<SelectTrigger className="w-full" id={field.name}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{ANTE_TYPES.map((at) => (
										<SelectItem key={at.value} value={at.value}>
											{at.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					)}
				</form.Field>

				<form.Subscribe selector={(state) => state.values.anteType === "none"}>
					{(isAnteDisabled) => (
						<form.Field name="ante">
							{(field) => (
								<Field
									className="flex-1"
									error={field.state.meta.errors[0]?.message}
									htmlFor={field.name}
									label={
										<OverrideLabel label="Ante" overridden={overriddenLabels} />
									}
								>
									<Input
										disabled={isLiveLinked || isAnteDisabled}
										id={field.name}
										inputMode="numeric"
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										value={field.state.value}
									/>
								</Field>
							)}
						</form.Field>
					)}
				</form.Subscribe>
			</div>

			<form.Field name="tableSize">
				{(field) => (
					<Field
						htmlFor={field.name}
						label={
							<OverrideLabel label="Table size" overridden={overriddenLabels} />
						}
					>
						<Select
							disabled={isLiveLinked}
							onValueChange={(v) => field.handleChange(v)}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TABLE_SIZES.map((size) => (
									<SelectItem key={size} value={size.toString()}>
										{size}-max
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>
		</>
	);
}

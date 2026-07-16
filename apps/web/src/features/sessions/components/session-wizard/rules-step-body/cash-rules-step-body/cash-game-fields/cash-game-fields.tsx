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
import { ANTE_TYPE_OPTIONS } from "@/shared/lib/ante-types";
import { CashBlindFields } from "./cash-blind-fields";

// biome-ignore-start lint/suspicious/noExplicitAny: tanstack-form's ReactFormExtendedApi has 12 generic parameters; threading a fully typed form through child components would require exporting the parent's full form generics.
export type AnyForm = ReactFormExtendedApi<
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
	/** True for the legacy "mix" key or any of the caller's mix master labels. */
	isMixValue: (value: string) => boolean;
	onCurrencyChange?: (id: string | undefined) => void;
	/**
	 * Variant field's onChange — routed through the wizard state so picking a
	 * mix master reseeds the mix editor from its saved composition.
	 */
	onVariantChange: (variant: string) => void;
	/** Field labels that diverge from the picked master ring game. */
	overriddenLabels?: ReadonlySet<string>;
	selectedCurrencyId?: string;
}

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function CashGameFields({
	currencies,
	form,
	isLiveLinked = false,
	isMixValue,
	onCurrencyChange,
	onVariantChange,
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
							includeMix
							onChange={onVariantChange}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			{/* Mix games replace the flat blind/ante fields with the group
			    editor rendered by the surrounding rules step. */}
			<form.Subscribe selector={(state): string => state.values.variant}>
				{(variant) =>
					isMixValue(variant) ? null : (
						<>
							<CashBlindFields
								form={form}
								isLiveLinked={isLiveLinked}
								overriddenLabels={overriddenLabels}
								variant={variant}
							/>
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
													{ANTE_TYPE_OPTIONS.map((at) => (
														<SelectItem key={at.value} value={at.value}>
															{at.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</Field>
									)}
								</form.Field>

								<form.Subscribe
									selector={(state) => state.values.anteType === "none"}
								>
									{(isAnteDisabled) => (
										<form.Field name="ante">
											{(field) => (
												<Field
													className="flex-1"
													error={field.state.meta.errors[0]?.message}
													htmlFor={field.name}
													label={
														<OverrideLabel
															label="Ante"
															overridden={overriddenLabels}
														/>
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
						</>
					)
				}
			</form.Subscribe>

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

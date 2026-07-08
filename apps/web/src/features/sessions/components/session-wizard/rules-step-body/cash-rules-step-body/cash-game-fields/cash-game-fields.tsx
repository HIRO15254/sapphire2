import type { ReactFormExtendedApi } from "@tanstack/react-form";
import type { GameVariant } from "@/features/game-variants/hooks/use-game-variants";
import { resolveBlindLabels } from "@/features/game-variants/utils/blind-labels";
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
	/** The caller's active game variants, powering the Variant select. */
	variants: readonly Pick<
		GameVariant,
		"blindLabel1" | "blindLabel2" | "blindLabel3" | "id" | "name"
	>[];
}

const ANTE_TYPES = [
	{ value: "none", label: "No ante" },
	{ value: "bb", label: "BB ante" },
	{ value: "all", label: "All ante" },
] as const;

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function CashGameFields({
	currencies,
	form,
	isLiveLinked = false,
	onCurrencyChange,
	overriddenLabels,
	selectedCurrencyId,
	variants,
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
						<Select
							disabled={isLiveLinked}
							onValueChange={(v) => field.handleChange(v)}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{variants.map((v) => (
									<SelectItem key={v.id} value={v.name}>
										{v.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Subscribe selector={(state) => state.values.variant}>
				{(currentVariant) => {
					const blindLabels = resolveBlindLabels(currentVariant, variants);
					return (
						<div className="grid grid-cols-3 gap-3">
							{blindLabels.blind1 == null ? null : (
								<form.Field name="blind1">
									{(field) => (
										<Field
											error={field.state.meta.errors[0]?.message}
											htmlFor={field.name}
											label={
												<OverrideLabel
													label={blindLabels.blind1 ?? ""}
													overridden={overriddenLabels}
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
							{blindLabels.blind2 == null ? null : (
								<form.Field name="blind2">
									{(field) => (
										<Field
											error={field.state.meta.errors[0]?.message}
											htmlFor={field.name}
											label={
												<OverrideLabel
													label={blindLabels.blind2 ?? ""}
													overridden={overriddenLabels}
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
							{blindLabels.blind3 == null ? null : (
								<form.Field name="blind3">
									{(field) => (
										<Field
											error={field.state.meta.errors[0]?.message}
											htmlFor={field.name}
											label={
												<OverrideLabel
													label={blindLabels.blind3 ?? ""}
													overridden={overriddenLabels}
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
				}}
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

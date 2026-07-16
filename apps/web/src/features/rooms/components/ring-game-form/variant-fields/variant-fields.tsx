import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import { MixFormSheet } from "@/shared/components/mix-form-sheet";
import { MixGamesEditor } from "@/shared/components/mix-games-editor";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { VariantSelect } from "@/shared/components/variant-select";
import { useVariantLabels } from "@/shared/hooks/use-variant-labels";
import { ANTE_TYPE_OPTIONS } from "@/shared/lib/ante-types";
import { BlindFields } from "../blind-fields";
import type { useRingGameForm } from "../use-ring-game-form";

type AnteType = "all" | "bb" | "none";
type RingGameFormState = ReturnType<typeof useRingGameForm>;

type VariantFieldsProps = Pick<
	RingGameFormState,
	| "editingMix"
	| "form"
	| "groupFor"
	| "isMixSheetOpen"
	| "isMixValue"
	| "mixRowFor"
	| "onEditMix"
	| "onMixSaved"
	| "onVariantChange"
	| "setIsMixSheetOpen"
	| "variants"
>;

export function VariantFields(props: VariantFieldsProps) {
	return (
		<>
			<VariantPicker
				form={props.form}
				onVariantChange={props.onVariantChange}
			/>
			<VariantFieldsContent {...props} />
		</>
	);
}

function VariantPicker({
	form,
	onVariantChange,
}: Pick<VariantFieldsProps, "form" | "onVariantChange">) {
	return (
		<form.Field name="variant">
			{(field) => (
				<Field htmlFor={field.name} label="Variant" required>
					<VariantSelect
						id={field.name}
						includeMix
						onChange={onVariantChange}
						value={field.state.value}
					/>
				</Field>
			)}
		</form.Field>
	);
}

function VariantFieldsContent(props: VariantFieldsProps) {
	return (
		<props.form.Subscribe selector={(state) => state.values.variant}>
			{(variant) =>
				props.isMixValue(variant) ? (
					<MixVariantFields {...props} variant={variant} />
				) : (
					<FlatVariantFields form={props.form} variant={variant} />
				)
			}
		</props.form.Subscribe>
	);
}

function MixVariantFields({
	editingMix,
	form,
	groupFor,
	isMixSheetOpen,
	mixRowFor,
	onEditMix,
	onMixSaved,
	setIsMixSheetOpen,
	variants,
	variant,
}: VariantFieldsProps & { variant: string }) {
	return (
		<>
			<form.Field name="mixGames">
				{(field) => (
					<MixGamesEditor
						onChange={(rows) => field.handleChange(rows)}
						onEditMix={
							mixRowFor(variant) ? () => onEditMix(variant) : undefined
						}
						resolveGroup={groupFor}
						value={field.state.value}
					/>
				)}
			</form.Field>
			<MixFormSheet
				editingMix={editingMix}
				key={editingMix ? `edit-${editingMix.id}` : "closed"}
				onOpenChange={setIsMixSheetOpen}
				onSaved={onMixSaved}
				open={isMixSheetOpen}
				variants={variants}
			/>
		</>
	);
}

function FlatVariantFields({
	form,
	variant,
}: Pick<VariantFieldsProps, "form"> & { variant: string }) {
	const blindLabels = useVariantLabels(variant || DEFAULT_VARIANT_LABEL);

	return (
		<>
			<BlindFields blindLabels={blindLabels} form={form} />
			<div className="flex gap-3">
				<form.Field name="anteType">
					{(field) => (
						<Field className="flex-1" htmlFor={field.name} label="Ante type">
							<Select
								onValueChange={(value) => field.handleChange(value as AnteType)}
								value={field.state.value}
							>
								<SelectTrigger className="w-full" id={field.name}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{ANTE_TYPE_OPTIONS.map((anteType) => (
										<SelectItem key={anteType.value} value={anteType.value}>
											{anteType.label}
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
									label="Ante"
								>
									<Input
										disabled={isAnteDisabled}
										id={field.name}
										inputMode="numeric"
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									/>
								</Field>
							)}
						</form.Field>
					)}
				</form.Subscribe>
			</div>
		</>
	);
}

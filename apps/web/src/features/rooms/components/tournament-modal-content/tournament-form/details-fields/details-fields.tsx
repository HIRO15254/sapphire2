import { ChipPurchasesEditor } from "@/shared/components/chip-purchases-editor";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { VariantSelect } from "@/shared/components/variant-select";
import type { useTournamentForm } from "../use-tournament-form";

type TournamentFormState = ReturnType<typeof useTournamentForm>;
type DetailsFieldsProps = Pick<
	TournamentFormState,
	"form" | "onScopeChange" | "onVariantFieldChange" | "scopeOf"
>;

export function DetailsFields({
	form,
	onScopeChange,
	onVariantFieldChange,
	scopeOf,
}: DetailsFieldsProps) {
	return (
		<>
			<form.Field name="variant">
				{(field) => {
					const scope = scopeOf(field.state.value);
					return (
						<>
							<Field label="Variant scope">
								<RadioGroup
									className="flex flex-col gap-1"
									onValueChange={(value) =>
										onScopeChange(
											value as "all" | "perLevel",
											field.state.value
										)
									}
									value={scope}
								>
									<label
										className="flex items-center gap-2 py-1 text-sm"
										htmlFor="tournament-scope-all"
									>
										<RadioGroupItem id="tournament-scope-all" value="all" />
										Same variant for all levels
									</label>
									<label
										className="flex items-center gap-2 py-1 text-sm"
										htmlFor="tournament-scope-per-level"
									>
										<RadioGroupItem
											id="tournament-scope-per-level"
											value="perLevel"
										/>
										Choose games per level
									</label>
								</RadioGroup>
							</Field>
							{scope === "all" ? (
								<Field htmlFor={field.name} label="Variant" required>
									<VariantSelect
										id={field.name}
										includeMix
										onChange={onVariantFieldChange}
										value={field.state.value}
									/>
								</Field>
							) : (
								<p className="text-muted-foreground text-xs">
									Assign each level's games in the Structure tab.
								</p>
							)}
						</>
					);
				}}
			</form.Field>

			<div className="grid grid-cols-2 gap-3">
				<NumericField form={form} label="Buy-in" name="buyIn" />
				<NumericField form={form} label="Entry fee" name="entryFee" />
			</div>
			<NumericField form={form} label="Starting stack" name="startingStack" />
			<form.Field name="chipPurchases">
				{(field) => (
					<ChipPurchasesEditor
						onChange={(rows) => field.handleChange(rows)}
						value={field.state.value}
					/>
				)}
			</form.Field>
			<NumericField form={form} label="Bounty amount" name="bountyAmount" />
		</>
	);
}

function NumericField({
	form,
	label,
	name,
}: Pick<DetailsFieldsProps, "form"> & {
	label: string;
	name: "bountyAmount" | "buyIn" | "entryFee" | "startingStack";
}) {
	return (
		<form.Field name={name}>
			{(field) => (
				<Field
					error={field.state.meta.errors[0]?.message}
					htmlFor={field.name}
					label={label}
				>
					<Input
						id={field.name}
						inputMode="numeric"
						onBlur={field.handleBlur}
						onChange={(event) => field.handleChange(event.target.value)}
						value={field.state.value}
					/>
				</Field>
			)}
		</form.Field>
	);
}

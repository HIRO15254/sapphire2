import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import { OverrideLabel } from "@/features/sessions/components/override-label";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { useVariantLabels } from "@/shared/hooks/use-variant-labels";
import type { AnyForm } from "../cash-game-fields";

interface CashBlindFieldsProps {
	form: AnyForm;
	isLiveLinked: boolean;
	overriddenLabels?: ReadonlySet<string>;
	variant: string;
}

type BlindName = "blind1" | "blind2" | "blind3";

const BLIND_OVERRIDE_KEYS: Record<BlindName, string> = {
	blind1: "SB",
	blind2: "BB",
	blind3: "Straddle",
};

function BlindField({
	form,
	isLiveLinked,
	label,
	name,
	overriddenLabels,
}: {
	form: AnyForm;
	isLiveLinked: boolean;
	label: string;
	name: BlindName;
	overriddenLabels?: ReadonlySet<string>;
}) {
	return (
		<form.Field name={name}>
			{(field) => (
				<Field
					error={field.state.meta.errors[0]?.message}
					htmlFor={field.name}
					label={
						<OverrideLabel
							label={label}
							overridden={overriddenLabels}
							overrideKey={BLIND_OVERRIDE_KEYS[name]}
						/>
					}
				>
					<Input
						disabled={isLiveLinked}
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

export function CashBlindFields({
	form,
	isLiveLinked,
	overriddenLabels,
	variant,
}: CashBlindFieldsProps) {
	const blindLabels = useVariantLabels(variant || DEFAULT_VARIANT_LABEL);
	const blind3Label = blindLabels.blind3;

	return (
		<div
			className={
				blind3Label === null
					? "grid grid-cols-2 gap-3"
					: "grid grid-cols-3 gap-3"
			}
		>
			<BlindField
				form={form}
				isLiveLinked={isLiveLinked}
				label={blindLabels.blind1}
				name="blind1"
				overriddenLabels={overriddenLabels}
			/>
			<BlindField
				form={form}
				isLiveLinked={isLiveLinked}
				label={blindLabels.blind2}
				name="blind2"
				overriddenLabels={overriddenLabels}
			/>
			{blind3Label === null ? null : (
				<BlindField
					form={form}
					isLiveLinked={isLiveLinked}
					label={blind3Label}
					name="blind3"
					overriddenLabels={overriddenLabels}
				/>
			)}
		</div>
	);
}

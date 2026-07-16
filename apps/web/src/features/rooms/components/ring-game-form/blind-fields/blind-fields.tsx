import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import type { BlindSlotLabels } from "@/shared/hooks/use-variant-labels";
import type { useRingGameForm } from "../use-ring-game-form";

interface BlindFieldsProps {
	blindLabels: BlindSlotLabels;
	form: ReturnType<typeof useRingGameForm>["form"];
}

export function BlindFields({ blindLabels, form }: BlindFieldsProps) {
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
						label={blindLabels.blind1}
					>
						<Input
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
						label={blindLabels.blind2}
					>
						<Input
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
							label={blind3Label}
						>
							<Input
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

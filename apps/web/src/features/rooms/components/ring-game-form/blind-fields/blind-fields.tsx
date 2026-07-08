import type { BlindLabels } from "@/features/game-variants/utils/blind-labels";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import type { useRingGameForm } from "../use-ring-game-form";

interface BlindFieldsProps {
	blindLabels: BlindLabels;
	form: ReturnType<typeof useRingGameForm>["form"];
}

export function BlindFields({ blindLabels, form }: BlindFieldsProps) {
	return (
		<div className="grid grid-cols-3 gap-3">
			{blindLabels.blind1 == null ? null : (
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
			)}
			{blindLabels.blind2 == null ? null : (
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
			)}
			{blindLabels.blind3 == null ? null : (
				<form.Field name="blind3">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label={blindLabels.blind3}
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

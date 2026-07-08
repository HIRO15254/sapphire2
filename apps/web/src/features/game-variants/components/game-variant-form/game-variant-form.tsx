import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import type {
	GameVariantFormDefaultValues,
	GameVariantFormValues,
} from "./use-game-variant-form";
import {
	BLIND_LABEL_MAX_LENGTH,
	NAME_MAX_LENGTH,
	useGameVariantForm,
} from "./use-game-variant-form";

interface GameVariantFormProps {
	defaultValues?: GameVariantFormDefaultValues;
	/**
	 * Stable id assigned to the `<form>` element so an external Save button
	 * (rendered by the surrounding FormSheet toolbar) can submit it via the
	 * HTML `form` attribute.
	 */
	formId: string;
	onSubmit: (values: GameVariantFormValues) => void;
}

export function GameVariantForm({
	defaultValues,
	formId,
	onSubmit,
}: GameVariantFormProps) {
	const { form } = useGameVariantForm({ defaultValues, onSubmit });

	return (
		<form
			className="flex flex-col gap-4"
			id={formId}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="name">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Name"
						required
					>
						<Input
							id={field.name}
							maxLength={NAME_MAX_LENGTH}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="blindLabel1">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Blind label 1"
					>
						<Input
							id={field.name}
							maxLength={BLIND_LABEL_MAX_LENGTH}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="blindLabel2">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Blind label 2"
					>
						<Input
							id={field.name}
							maxLength={BLIND_LABEL_MAX_LENGTH}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="blindLabel3">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Blind label 3"
					>
						<Input
							id={field.name}
							maxLength={BLIND_LABEL_MAX_LENGTH}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
		</form>
	);
}

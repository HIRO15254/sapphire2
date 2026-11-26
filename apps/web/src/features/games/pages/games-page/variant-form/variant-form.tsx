import type {
	GameGroup,
	GameVariant,
} from "@/features/games/hooks/use-game-masters";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { firstError } from "@/shared/lib/form-errors";
import { useVariantForm, type VariantFormSubmit } from "./use-variant-form";

interface VariantFormProps {
	formId: string;
	groups: GameGroup[];
	onSubmit: (values: VariantFormSubmit) => Promise<void>;
	variant: GameVariant | null;
	variants: GameVariant[] | undefined;
}

export function VariantForm({
	formId,
	groups,
	onSubmit,
	variant,
	variants,
}: VariantFormProps) {
	const {
		form,
		groupError,
		labelError,
		onFormSubmit,
		onGroupChange,
		onTextChange,
		structureHint,
	} = useVariantForm({ groups, onSubmit, variant, variants });

	return (
		<form
			className="flex flex-col gap-3.5 pt-1 pb-2"
			id={formId}
			noValidate
			onSubmit={onFormSubmit}
		>
			<form.Field name="label">
				{(field) => (
					<Field
						error={labelError ?? firstError(field.state.meta.errors)}
						htmlFor="variant-label"
						label="Name"
						required
					>
						<Input
							id="variant-label"
							onBlur={field.handleBlur}
							onChange={onTextChange("label", field.handleChange)}
							size="xl"
							type="text"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="shortLabel">
				{(field) => (
					<Field
						error={firstError(field.state.meta.errors)}
						htmlFor="variant-short-label"
						label="Short name"
					>
						<Input
							id="variant-short-label"
							onBlur={field.handleBlur}
							onChange={onTextChange(null, field.handleChange)}
							size="xl"
							type="text"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="groupId">
				{(field) => (
					<Field
						description={structureHint(field.state.value)}
						error={groupError ?? firstError(field.state.meta.errors)}
						htmlFor="variant-group"
						label="Structure"
						required
					>
						<Select
							onValueChange={onGroupChange(field.handleChange)}
							value={field.state.value}
						>
							<SelectTrigger id="variant-group">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{groups.map((group) => (
									<SelectItem key={group.id} value={group.id}>
										{group.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>
		</form>
	);
}

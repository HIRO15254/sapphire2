import { FormSheet } from "@/shared/components/form-sheet";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { ADD_CUSTOM_VALUE, useVariantSelect } from "./use-variant-select";

interface VariantSelectProps {
	disabled?: boolean;
	/** Variants (preset keys / custom labels) hidden from the options. */
	excludeVariants?: string[];
	id?: string;
	/** Show the special "mix" preset (only where a mix editor exists). */
	includeMix?: boolean;
	onChange: (variant: string) => void;
	value: string;
}

const BLIND_LABEL_FIELDS = [
	{ name: "blind1Label", label: "Blind 1 label" },
	{ name: "blind2Label", label: "Blind 2 label" },
	{ name: "blind3Label", label: "Blind 3 label" },
] as const;

/**
 * Required variant picker shared by every game/rule form: presets, the
 * user's custom variants, and a trailing "Add custom variant" affordance
 * that opens an inline creation sheet and selects the new variant.
 */
export function VariantSelect({
	disabled = false,
	excludeVariants,
	id,
	includeMix = false,
	onChange,
	value,
}: VariantSelectProps) {
	const {
		customVariants,
		form,
		formId,
		handleValueChange,
		isAddOpen,
		isCreatePending,
		presets,
		setIsAddOpen,
		unknownValue,
	} = useVariantSelect({ excludeVariants, includeMix, onChange, value });

	return (
		<>
			<Select
				disabled={disabled}
				onValueChange={handleValueChange}
				value={value}
			>
				<SelectTrigger className="w-full" id={id}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectLabel>Presets</SelectLabel>
						{presets.map((preset) => (
							<SelectItem key={preset.key} value={preset.key}>
								{preset.label}
							</SelectItem>
						))}
					</SelectGroup>
					{customVariants.length > 0 && (
						<>
							<SelectSeparator />
							<SelectGroup>
								<SelectLabel>Custom</SelectLabel>
								{customVariants.map((custom) => (
									<SelectItem key={custom.id} value={custom.label}>
										{custom.label}
									</SelectItem>
								))}
							</SelectGroup>
						</>
					)}
					{unknownValue ? (
						<SelectItem value={unknownValue}>{unknownValue}</SelectItem>
					) : null}
					<SelectSeparator />
					<SelectItem value={ADD_CUSTOM_VALUE}>Add custom variant</SelectItem>
				</SelectContent>
			</Select>
			<FormSheet
				formId={formId}
				isLoading={isCreatePending}
				onOpenChange={setIsAddOpen}
				open={isAddOpen}
				title="New custom variant"
			>
				<form
					className="flex flex-col gap-3"
					id={formId}
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<form.Field name="label">
						{(field) => (
							<Field
								error={field.state.meta.errors[0]?.message}
								htmlFor={`${formId}-label`}
								label="Name"
								required
							>
								<Input
									id={`${formId}-label`}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>
					<div className="grid grid-cols-3 gap-3">
						{BLIND_LABEL_FIELDS.map(({ name, label }) => (
							<form.Field key={name} name={name}>
								{(field) => (
									<Field
										error={field.state.meta.errors[0]?.message}
										htmlFor={`${formId}-${name}`}
										label={label}
									>
										<Input
											id={`${formId}-${name}`}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											value={field.state.value}
										/>
									</Field>
								)}
							</form.Field>
						))}
					</div>
				</form>
			</FormSheet>
		</>
	);
}

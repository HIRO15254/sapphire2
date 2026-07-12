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
	/** Variant labels hidden from the options. */
	excludeVariants?: string[];
	id?: string;
	/** Show the special "Mixed Game" mode entry (value: "mix"). */
	includeMix?: boolean;
	onChange: (variant: string) => void;
	/**
	 * Trigger text while nothing is selected — Radix renders a blank trigger
	 * otherwise, which the "add a game" pick-and-reset mount sites hit on
	 * every render (their value is always "").
	 */
	placeholder?: string;
	value: string;
}

/**
 * Required variant picker shared by every game/rule form. Options are the
 * user's own variant rows (seeded at signup, fully editable in Settings),
 * plus the user's named mix masters (HORSE / 8-Game / 10-Game / custom,
 * shown as a separated group) where a mix editor exists, plus a trailing
 * "Add custom variant" affordance that creates a row (name + short label +
 * owning group) and selects it.
 */
export function VariantSelect({
	disabled = false,
	excludeVariants,
	id,
	includeMix = false,
	onChange,
	placeholder,
	value,
}: VariantSelectProps) {
	const {
		form,
		formId,
		groups,
		handleValueChange,
		isAddOpen,
		isCreatePending,
		isLoading,
		mixOptions,
		setIsAddOpen,
		unknownValue,
		variantOptions,
	} = useVariantSelect({ excludeVariants, includeMix, onChange, value });

	return (
		<>
			<Select
				disabled={disabled || isLoading}
				onValueChange={handleValueChange}
				value={value}
			>
				<SelectTrigger className="w-full" id={id}>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent>
					{variantOptions.map((option) => (
						<SelectItem key={option.id} value={option.label}>
							{option.label}
						</SelectItem>
					))}
					{mixOptions.length > 0 ? (
						<>
							<SelectSeparator />
							<SelectGroup>
								<SelectLabel>Mixes</SelectLabel>
								{mixOptions.map((option) => (
									<SelectItem key={option.id} value={option.label}>
										{option.label}
									</SelectItem>
								))}
							</SelectGroup>
						</>
					) : null}
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
					<div className="grid grid-cols-2 gap-3">
						<form.Field name="shortLabel">
							{(field) => (
								<Field
									error={field.state.meta.errors[0]?.message}
									htmlFor={`${formId}-shortLabel`}
									label="Short label"
								>
									<Input
										id={`${formId}-shortLabel`}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										value={field.state.value}
									/>
								</Field>
							)}
						</form.Field>
						<form.Field name="groupId">
							{(field) => (
								<Field
									error={field.state.meta.errors[0]?.message}
									htmlFor={`${formId}-groupId`}
									label="Group"
									required
								>
									<Select
										onValueChange={(v) => field.handleChange(v)}
										value={field.state.value}
									>
										<SelectTrigger className="w-full" id={`${formId}-groupId`}>
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
					</div>
				</form>
			</FormSheet>
		</>
	);
}

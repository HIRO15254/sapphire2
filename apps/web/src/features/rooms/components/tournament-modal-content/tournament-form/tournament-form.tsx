import type { TournamentFormValues } from "@/features/rooms/hooks/use-tournaments";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { DetailsFields } from "./details-fields";
import { MetadataFields } from "./metadata-fields";
import { useTournamentForm } from "./use-tournament-form";

interface TournamentFormProps {
	defaultValues?: Omit<TournamentFormValues, "tags" | "chipPurchases"> & {
		chipPurchases?: Array<{ name: string; cost: number; chips: number }>;
		tags?: string[];
	};
	/**
	 * Stable id assigned to the `<form>` element so an external Save button
	 * (e.g. the surrounding FormSheet toolbar) can submit it via the HTML
	 * `form` attribute. The form renders no submit button of its own.
	 */
	formId: string;
	/**
	 * Called when a submit attempt fails validation. Lets the surrounding modal
	 * reveal this (Details) tab so the user sees the errors instead of a
	 * seemingly dead Save button on another tab (SA2-97 follow-up).
	 */
	onInvalidSubmit?: () => void;
	/**
	 * Registers a getter for the form's current values so AI auto-fill can
	 * merge over what the user has already entered.
	 */
	onRegisterLiveValues?: (
		getter: () => Omit<TournamentFormValues, "tags" | "chipPurchases"> & {
			chipPurchases?: Array<{ name: string; cost: number; chips: number }>;
			tags?: string[];
		}
	) => void;
	onSubmit: (values: TournamentFormValues) => void;
	/** Live variant changes so the Structure tab's labels stay in sync. */
	onVariantChange?: (variant: string) => void;
}

export function TournamentForm({
	onSubmit,
	defaultValues,
	formId,
	onInvalidSubmit,
	onRegisterLiveValues,
	onVariantChange,
}: TournamentFormProps) {
	const formState = useTournamentForm({
		defaultValues,
		onInvalidSubmit,
		onRegisterLiveValues,
		onSubmit,
		onVariantChange,
	});
	const { form } = formState;

	return (
		<form
			className="flex flex-col gap-4"
			id={formId}
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="name">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Tournament name"
						required
					>
						<Input
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<DetailsFields
				form={form}
				onScopeChange={formState.onScopeChange}
				onVariantFieldChange={formState.onVariantFieldChange}
				scopeOf={formState.scopeOf}
			/>
			<MetadataFields currencies={formState.currencies} form={form} />
		</form>
	);
}

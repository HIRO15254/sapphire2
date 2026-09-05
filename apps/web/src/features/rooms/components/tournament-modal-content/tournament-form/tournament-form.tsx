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
	formId: string;
	onInvalidSubmit?: () => void;
	onRegisterLiveValues?: (
		getter: () => Omit<TournamentFormValues, "tags" | "chipPurchases"> & {
			chipPurchases?: Array<{ name: string; cost: number; chips: number }>;
			tags?: string[];
		}
	) => void;
	onSubmit: (values: TournamentFormValues) => void;
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

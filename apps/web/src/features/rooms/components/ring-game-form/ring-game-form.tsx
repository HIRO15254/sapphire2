import type { RingGameFormValues } from "@/features/rooms/hooks/use-ring-games";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
import { LimitsFields } from "./limits-fields";
import { useRingGameForm } from "./use-ring-game-form";
import { VariantFields } from "./variant-fields";

interface RingGameFormProps {
	defaultValues?: RingGameFormValues;
	/**
	 * Stable id assigned to the `<form>` element so an external Save button
	 * (e.g. the surrounding FormSheet toolbar) can submit it via the HTML
	 * `form` attribute. The form renders no submit button of its own.
	 */
	formId: string;
	onSubmit: (values: RingGameFormValues) => void;
}

/**
 * Mount gate (c05): the inner form seeds its mix-game rows once from the
 * master variant→group mapping, so it must not mount until the master lists
 * are loaded — seeding against the pending fallback would freeze rows
 * without a real group identity.
 */
export function RingGameForm(props: RingGameFormProps) {
	const { isLoading } = useGameGroups();
	if (isLoading) {
		return (
			<p className="py-8 text-center text-muted-foreground text-sm">
				Loading game data
			</p>
		);
	}
	return <RingGameFormBody {...props} />;
}

function RingGameFormBody({
	onSubmit,
	defaultValues,
	formId,
}: RingGameFormProps) {
	const formState = useRingGameForm({ defaultValues, onSubmit });
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
						label="Game name"
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
			<VariantFields {...formState} />
			<LimitsFields currencies={formState.currencies} form={form} />
		</form>
	);
}

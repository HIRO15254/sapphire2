import { ChipPurchaseFields } from "@/live-sessions/components/event-fields/chip-purchase-fields";
import { usePurchaseChipsEditor } from "@/live-sessions/hooks/event-editors/use-purchase-chips-editor";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { type EditorBaseProps, TimeField } from "./shared";

type Props = Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onSubmit"
>;

export function PurchaseChipsEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: Props) {
	const { form, timeValidator } = usePurchaseChipsEditor({
		event,
		isLoading,
		maxTime,
		minTime,
		onSubmit,
	});

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field
				name="time"
				validators={{
					onChange: ({ value }) => timeValidator(value),
				}}
			>
				{(field) => (
					<TimeField
						error={field.state.meta.errors[0]?.toString() ?? null}
						onChange={(v) => field.handleChange(v)}
						value={field.state.value}
					/>
				)}
			</form.Field>
			<form.Field name="name">
				{(nameField) => (
					<form.Field name="cost">
						{(costField) => (
							<form.Field name="chips">
								{(chipsField) => (
									<ChipPurchaseFields
										chips={chipsField.state.value}
										chipsError={chipsField.state.meta.errors[0]?.message}
										cost={costField.state.value}
										costError={costField.state.meta.errors[0]?.message}
										name={nameField.state.value}
										nameError={nameField.state.meta.errors[0]?.message}
										onChipsChange={(v) => chipsField.handleChange(v)}
										onCostChange={(v) => costField.handleChange(v)}
										onNameChange={(v) => nameField.handleChange(v)}
									/>
								)}
							</form.Field>
						)}
					</form.Field>
				)}
			</form.Field>
			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, isSubmitting]) => (
					<DialogActionRow>
						<Button
							disabled={!canSubmit || isSubmitting || isLoading}
							type="submit"
						>
							{isLoading ? "Saving..." : "Save"}
						</Button>
					</DialogActionRow>
				)}
			</form.Subscribe>
		</form>
	);
}

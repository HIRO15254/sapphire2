import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { type EditorBaseProps, TimeField } from "../shared";
import { useVirtualAmountEditor } from "./use-virtual-amount-editor";

type Props = Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onSubmit"
>;

export function VirtualAmountEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: Props) {
	const { form, isItemBased, itemName, timeValidator } = useVirtualAmountEditor(
		{
			event,
			isLoading,
			maxTime,
			minTime,
			onSubmit,
		}
	);

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
			{isItemBased ? (
				<p className="text-muted-foreground text-sm">{itemName}</p>
			) : null}
			<form.Field name="value">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor="edit-virtual-value"
						label={isItemBased ? "Count" : "Amount"}
						required
					>
						<Input
							id="edit-virtual-value"
							inputMode="numeric"
							onChange={(e) => field.handleChange(e.target.value)}
							type="text"
							value={field.state.value}
						/>
					</Field>
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

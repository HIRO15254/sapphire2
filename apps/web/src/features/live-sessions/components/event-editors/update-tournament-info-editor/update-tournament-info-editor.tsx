import { TournamentInfoFields } from "@/features/live-sessions/components/event-fields/tournament-info-fields";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { type EditorBaseProps, TimeField } from "../shared";
import { useUpdateTournamentInfoEditor } from "./use-update-tournament-info-editor";

interface ChipPurchaseType {
	chips: number;
	cost: number;
	name: string;
}

type Props = Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onSubmit"
> & {
	chipPurchaseTypes?: ChipPurchaseType[];
};

export function UpdateTournamentInfoEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
	chipPurchaseTypes,
}: Props) {
	const { form, timeValidator } = useUpdateTournamentInfoEditor({
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
			<form.Subscribe selector={(state) => state.values}>
				{(values) => (
					<TournamentInfoFields
						chipPurchaseCounts={values.chipPurchaseCounts}
						chipPurchaseTypes={chipPurchaseTypes}
						onChipPurchaseCountsChange={(v) =>
							form.setFieldValue("chipPurchaseCounts", v)
						}
						onRemainingPlayersChange={(v) =>
							form.setFieldValue("remainingPlayers", v)
						}
						onTotalEntriesChange={(v) => form.setFieldValue("totalEntries", v)}
						remainingPlayers={values.remainingPlayers}
						totalEntries={values.totalEntries}
					/>
				)}
			</form.Subscribe>
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

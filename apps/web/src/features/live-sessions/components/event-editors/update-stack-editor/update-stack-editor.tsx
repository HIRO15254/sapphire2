import { TournamentInfoFields } from "@/features/live-sessions/components/event-fields/tournament-info-fields";
import { UpdateStackFields } from "@/features/live-sessions/components/event-fields/update-stack-fields";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { type EditorBaseProps, TimeField } from "../shared";
import { useUpdateStackEditor } from "./use-update-stack-editor";

interface ChipPurchaseType {
	chips: number;
	cost: number;
	name: string;
}

type Props = Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onSubmit" | "sessionType"
> & {
	chipPurchaseTypes?: ChipPurchaseType[];
};

export function UpdateStackEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
	sessionType,
	chipPurchaseTypes,
}: Props) {
	const { form, timeValidator, isTournament } = useUpdateStackEditor({
		event,
		isLoading,
		maxTime,
		minTime,
		onSubmit,
		sessionType,
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
			<form.Field name="stackAmount">
				{(field) => {
					const firstError = field.state.meta.errors[0];
					const errorMessage =
						typeof firstError === "object" && firstError !== null
							? (firstError as { message?: string }).message
							: undefined;
					return (
						<UpdateStackFields
							error={errorMessage}
							onStackAmountChange={(v) => field.handleChange(v)}
							value={field.state.value}
						/>
					);
				}}
			</form.Field>
			{isTournament ? (
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
							onTotalEntriesChange={(v) =>
								form.setFieldValue("totalEntries", v)
							}
							remainingPlayers={values.remainingPlayers}
							totalEntries={values.totalEntries}
						/>
					)}
				</form.Subscribe>
			) : null}
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

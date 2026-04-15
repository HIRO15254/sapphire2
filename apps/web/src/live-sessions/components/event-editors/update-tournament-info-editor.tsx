import { useForm } from "@tanstack/react-form";
import { TournamentInfoFields } from "@/live-sessions/components/event-fields";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import {
	TimeField,
	toTimeInputValue,
	validateOccurredAtTime,
	toOccurredAtTimestamp,
	type EditorBaseProps,
} from "./shared";

interface ChipPurchaseCount {
	chipsPerUnit: number;
	count: number;
	name: string;
}

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
	const payload = (event.payload ?? {}) as Record<string, unknown>;

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			remainingPlayers:
				typeof payload.remainingPlayers === "number"
					? String(payload.remainingPlayers)
					: "",
			totalEntries:
				typeof payload.totalEntries === "number"
					? String(payload.totalEntries)
					: "",
			chipPurchaseCounts: Array.isArray(payload.chipPurchaseCounts)
				? (payload.chipPurchaseCounts as ChipPurchaseCount[])
				: ([] as ChipPurchaseCount[]),
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit(
				{
					remainingPlayers: value.remainingPlayers
						? Number(value.remainingPlayers)
						: null,
					totalEntries: value.totalEntries ? Number(value.totalEntries) : null,
					chipPurchaseCounts: value.chipPurchaseCounts,
				},
				occurredAt
			);
		},
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
					onChange: ({ value }) =>
						validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
						undefined,
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
			<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
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

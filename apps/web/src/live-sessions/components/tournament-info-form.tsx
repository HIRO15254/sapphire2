import { useForm } from "@tanstack/react-form";
import z from "zod";
import {
	StackNumberField,
	StackSecondaryGrid,
} from "@/live-sessions/components/stack-ui";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface TournamentInfoFormProps {
	chipPurchaseTypes?: Array<{ name: string; cost: number; chips: number }>;
	isLoading: boolean;
	onSubmit: (values: {
		remainingPlayers: number | null;
		totalEntries: number | null;
		chipPurchaseCounts: Array<{
			name: string;
			count: number;
			chipsPerUnit: number;
		}>;
	}) => void;
}

const tournamentInfoFormSchema = z.object({
	remainingPlayers: z.coerce
		.number()
		.int("Must be a whole number")
		.min(1, "Must be at least 1")
		.optional(),
	totalEntries: z.coerce
		.number()
		.int("Must be a whole number")
		.min(1, "Must be at least 1")
		.optional(),
	chipPurchaseCounts: z.array(
		z.object({
			name: z.string(),
			count: z.coerce.number().int().min(0),
			chipsPerUnit: z.number(),
		})
	),
});

export function TournamentInfoForm({
	chipPurchaseTypes = [],
	isLoading,
	onSubmit,
}: TournamentInfoFormProps) {
	const form = useForm({
		defaultValues: {
			remainingPlayers: undefined as number | undefined,
			totalEntries: undefined as number | undefined,
			chipPurchaseCounts: [] as Array<{
				name: string;
				count: number;
				chipsPerUnit: number;
			}>,
		},
		onSubmit: ({ value }) => {
			onSubmit({
				remainingPlayers: value.remainingPlayers ?? null,
				totalEntries: value.totalEntries ?? null,
				chipPurchaseCounts: value.chipPurchaseCounts,
			});
		},
		validators: {
			onSubmit: tournamentInfoFormSchema,
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
			<StackSecondaryGrid>
				<form.Field name="remainingPlayers">
					{(field) => (
						<Field
							className="flex-1"
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Remaining Players"
						>
							<Input
								id={field.name}
								inputMode="numeric"
								min={1}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) =>
									field.handleChange(
										e.target.value === "" ? undefined : Number(e.target.value)
									)
								}
								type="number"
								value={field.state.value ?? ""}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="totalEntries">
					{(field) => (
						<Field
							className="flex-1"
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Total Entries"
						>
							<Input
								id={field.name}
								inputMode="numeric"
								min={1}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) =>
									field.handleChange(
										e.target.value === "" ? undefined : Number(e.target.value)
									)
								}
								type="number"
								value={field.state.value ?? ""}
							/>
						</Field>
					)}
				</form.Field>
			</StackSecondaryGrid>

			{chipPurchaseTypes.length > 0 && (
				<div className="flex flex-col gap-1.5">
					{chipPurchaseTypes.map((t) => (
						<form.Field key={t.name} name="chipPurchaseCounts">
							{(field) => {
								const counts = field.state.value;
								const countEntry = counts.find((c) => c.name === t.name);
								const countValue = countEntry?.count ?? 0;
								return (
									<StackNumberField
										className="flex-1"
										id={`chip-purchase-count-${t.name}`}
										inputMode="numeric"
										label={`${t.name} count`}
										min={0}
										onChange={(value) => {
											const newCount = Number(value);
											const without = counts.filter((c) => c.name !== t.name);
											if (newCount === 0) {
												field.handleChange(without);
											} else {
												field.handleChange([
													...without,
													{
														name: t.name,
														count: newCount,
														chipsPerUnit: t.chips,
													},
												]);
											}
										}}
										type="number"
										value={countValue === 0 ? "" : String(countValue)}
									/>
								);
							}}
						</form.Field>
					))}
				</div>
			)}

			<form.Subscribe>
				{(state) => (
					<DialogActionRow>
						<Button
							disabled={isLoading || !state.canSubmit || state.isSubmitting}
							type="submit"
						>
							{isLoading || state.isSubmitting ? "Saving..." : "Update"}
						</Button>
					</DialogActionRow>
				)}
			</form.Subscribe>
		</form>
	);
}

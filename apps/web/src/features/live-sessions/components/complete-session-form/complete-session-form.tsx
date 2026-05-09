import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { CompleteSessionValues } from "./use-complete-session-form";
import { useCompleteSessionForm } from "./use-complete-session-form";

interface CompleteSessionFormProps {
	defaultFinalStack?: number;
	isLoading: boolean;
	kind: "cash_game" | "tournament";
	onSubmit: (values: CompleteSessionValues) => void;
}

export function CompleteSessionForm({
	defaultFinalStack,
	isLoading,
	kind,
	onSubmit,
}: CompleteSessionFormProps) {
	const { cashForm, tournamentForm } = useCompleteSessionForm(
		kind === "cash_game"
			? { kind: "cash_game", defaultFinalStack, onSubmit }
			: { kind: "tournament", onSubmit }
	);

	if (kind === "cash_game") {
		return (
			<form
				className="flex flex-col gap-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					cashForm.handleSubmit();
				}}
			>
				<cashForm.Field name="finalStack">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Final Stack"
							required
						>
							<Input
								id={field.name}
								inputMode="numeric"
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</cashForm.Field>

				<DialogActionRow>
					<cashForm.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
					>
						{([canSubmit, isSubmitting]) => (
							<Button
								disabled={isLoading || !canSubmit || isSubmitting}
								type="submit"
							>
								{isLoading ? "Completing..." : "Complete Session"}
							</Button>
						)}
					</cashForm.Subscribe>
				</DialogActionRow>
			</form>
		);
	}

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				tournamentForm.handleSubmit();
			}}
		>
			<div className="flex items-center gap-2">
				<tournamentForm.Field name="beforeDeadline">
					{(field) => (
						<>
							<Checkbox
								checked={field.state.value}
								id={field.name}
								onCheckedChange={(checked) =>
									field.handleChange(checked === true)
								}
							/>
							<Label htmlFor={field.name}>
								Completed before registration deadline
							</Label>
						</>
					)}
				</tournamentForm.Field>
			</div>

			<tournamentForm.Subscribe
				selector={(state) => state.values.beforeDeadline}
			>
				{(beforeDeadline) =>
					!beforeDeadline && (
						<div className="grid grid-cols-2 gap-2">
							<tournamentForm.Field name="placement">
								{(field) => (
									<Field
										error={field.state.meta.errors[0]?.message}
										htmlFor={field.name}
										label="Placement"
										required
									>
										<Input
											id={field.name}
											inputMode="numeric"
											name={field.name}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											value={field.state.value}
										/>
									</Field>
								)}
							</tournamentForm.Field>

							<tournamentForm.Field name="totalEntries">
								{(field) => (
									<Field
										error={field.state.meta.errors[0]?.message}
										htmlFor={field.name}
										label="Total Entries"
										required
									>
										<Input
											id={field.name}
											inputMode="numeric"
											name={field.name}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											value={field.state.value}
										/>
									</Field>
								)}
							</tournamentForm.Field>
						</div>
					)
				}
			</tournamentForm.Subscribe>

			<tournamentForm.Field name="prizeMoney">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Prize Money"
						required
					>
						<Input
							id={field.name}
							inputMode="numeric"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</tournamentForm.Field>

			<tournamentForm.Field name="bountyPrizes">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Bounty Prizes"
					>
						<Input
							id={field.name}
							inputMode="numeric"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</tournamentForm.Field>

			<DialogActionRow>
				<tournamentForm.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<Button
							disabled={isLoading || !canSubmit || isSubmitting}
							type="submit"
						>
							{isLoading ? "Completing..." : "Complete Tournament"}
						</Button>
					)}
				</tournamentForm.Subscribe>
			</DialogActionRow>
		</form>
	);
}

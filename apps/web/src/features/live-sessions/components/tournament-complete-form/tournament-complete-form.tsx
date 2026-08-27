import { IconClockOff } from "@tabler/icons-react";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { useTournamentCompleteForm } from "./use-tournament-complete-form";

interface TournamentCompleteFormProps {
	formId: string;
	onSubmit: (
		values:
			| {
					beforeDeadline: false;
					bountyPrizes: number;
					placement: number;
					prizeMoney: number;
					totalEntries: number;
			  }
			| {
					beforeDeadline: true;
					bountyPrizes: number;
					prizeMoney: number;
			  }
	) => void;
}

export function TournamentCompleteForm({
	formId,
	onSubmit,
}: TournamentCompleteFormProps) {
	const { form } = useTournamentCompleteForm({ onSubmit });

	return (
		<form
			className="flex flex-col gap-4"
			id={formId}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2.5">
				<form.Field name="beforeDeadline">
					{(field) => (
						<>
							<Label
								className="inline-flex items-center gap-1.5 text-sm"
								htmlFor={field.name}
							>
								<IconClockOff className="size-4 text-warning" />
								Early exit (left before the result)
							</Label>
							<Switch
								checked={field.state.value}
								id={field.name}
								onCheckedChange={(checked) =>
									field.handleChange(checked === true)
								}
							/>
						</>
					)}
				</form.Field>
			</div>

			<form.Subscribe selector={(state) => state.values.beforeDeadline}>
				{(beforeDeadline) =>
					beforeDeadline ? (
						<p className="text-muted-foreground text-xs">
							Early exit does not record place or total entries.
						</p>
					) : (
						<>
							<div className="grid grid-cols-2 gap-2">
								<form.Field name="placement">
									{(field) => (
										<Field
											error={field.state.meta.errors[0]?.message}
											htmlFor={field.name}
											label="Place"
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
								</form.Field>

								<form.Field name="totalEntries">
									{(field) => (
										<Field
											error={field.state.meta.errors[0]?.message}
											htmlFor={field.name}
											label="Total entries"
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
								</form.Field>
							</div>
							<p className="text-muted-foreground text-xs">
								Place must not exceed total entries.
							</p>
						</>
					)
				}
			</form.Subscribe>

			<div className="grid grid-cols-2 gap-2">
				<form.Field name="prizeMoney">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Prize"
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
				</form.Field>

				<form.Field name="bountyPrizes">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Bounty won"
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
				</form.Field>
			</div>

			<p className="text-muted-foreground text-xs">
				You can edit this from history later. This closes the record.
			</p>
		</form>
	);
}

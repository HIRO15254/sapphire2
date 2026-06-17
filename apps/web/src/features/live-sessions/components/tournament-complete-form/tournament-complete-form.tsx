import { Checkbox } from "@/shared/components/ui/checkbox";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useTournamentCompleteForm } from "./use-tournament-complete-form";

type TournamentCompleteValues =
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
	| {
			bagStack: number;
			result: "promoted";
	  };

interface TournamentCompleteFormProps {
	/** Whether the linked rule allows promoting to a next day. */
	canPromote?: boolean;
	/** Current stack, used to prefill the bag when promoting. */
	defaultBagStack?: number | null;
	/**
	 * Stable id assigned to the `<form>` element so the surrounding FormSheet
	 * toolbar can submit it via the HTML `form` attribute. The form renders no
	 * submit button of its own.
	 */
	formId: string;
	onSubmit: (values: TournamentCompleteValues) => void;
}

export function TournamentCompleteForm({
	canPromote = false,
	defaultBagStack,
	formId,
	onSubmit,
}: TournamentCompleteFormProps) {
	const { form } = useTournamentCompleteForm({
		canPromote,
		defaultBagStack,
		onSubmit,
	});

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
			{canPromote && (
				<div className="flex items-center gap-2">
					<form.Field name="promote">
						{(field) => (
							<>
								<Checkbox
									checked={field.state.value}
									id={field.name}
									onCheckedChange={(checked) =>
										field.handleChange(checked === true)
									}
								/>
								<Label htmlFor={field.name}>Promote to next day</Label>
							</>
						)}
					</form.Field>
				</div>
			)}

			<form.Subscribe selector={(state) => state.values.promote}>
				{(promote) =>
					promote ? (
						<form.Field name="bagStack">
							{(field) => (
								<Field
									error={field.state.meta.errors[0]?.message}
									htmlFor={field.name}
									label="Bag stack"
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
					) : (
						<>
							<div className="flex items-center gap-2">
								<form.Field name="beforeDeadline">
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
								</form.Field>
							</div>

							<form.Subscribe selector={(state) => state.values.beforeDeadline}>
								{(beforeDeadline) =>
									!beforeDeadline && (
										<div className="grid grid-cols-2 gap-2">
											<form.Field name="placement">
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
															onChange={(e) =>
																field.handleChange(e.target.value)
															}
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
														label="Total Entries"
														required
													>
														<Input
															id={field.name}
															inputMode="numeric"
															name={field.name}
															onBlur={field.handleBlur}
															onChange={(e) =>
																field.handleChange(e.target.value)
															}
															value={field.state.value}
														/>
													</Field>
												)}
											</form.Field>
										</div>
									)
								}
							</form.Subscribe>

							<form.Field name="prizeMoney">
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
							</form.Field>

							<form.Field name="bountyPrizes">
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
							</form.Field>
						</>
					)
				}
			</form.Subscribe>
		</form>
	);
}

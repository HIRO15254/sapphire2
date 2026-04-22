import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { type EditorBaseProps, type SessionType, TimeField } from "../shared";
import {
	useCashGameEndEditor,
	useTournamentEndEditor,
} from "./use-session-end-editor";

type Props = Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onSubmit"
> & {
	sessionType: SessionType;
};

function CashGameEndEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: Props) {
	const { form, timeValidator } = useCashGameEndEditor({
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
			<form.Field name="cashOutAmount">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Cash-out Amount"
						required
					>
						<Input
							id={field.name}
							inputMode="numeric"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="0"
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

function TournamentEndEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: Props) {
	const { form, timeValidator } = useTournamentEndEditor({
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
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="1"
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
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="100"
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
							placeholder="0"
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
							placeholder="0"
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

export function SessionEndEditor(props: Props) {
	if (props.sessionType === "cash_game") {
		return <CashGameEndEditor {...props} />;
	}
	return <TournamentEndEditor {...props} />;
}

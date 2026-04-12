import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

interface AllIn {
	equity: number;
	potSize: number;
	trials: number;
	wins: number;
}

interface AllInBottomSheetProps {
	initialValues?: AllIn;
	onDelete?: () => void;
	onOpenChange: (open: boolean) => void;
	onSubmit: (allIn: AllIn) => void;
	open: boolean;
}

function safeNum(s: string): number {
	const n = Number(s);
	return Number.isNaN(n) ? 0 : n;
}

export function AllInBottomSheet({
	open,
	onOpenChange,
	initialValues,
	onSubmit,
	onDelete,
}: AllInBottomSheetProps) {
	const form = useForm({
		defaultValues: {
			potSize: initialValues?.potSize.toString() ?? "",
			trials: initialValues?.trials.toString() ?? "1",
			equity: initialValues?.equity.toString() ?? "",
			wins: initialValues?.wins.toString() ?? "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				potSize: Number(value.potSize),
				trials: Math.round(Number(value.trials)),
				equity: safeNum(value.equity),
				wins: safeNum(value.wins),
			});
		},
	});

	useEffect(() => {
		if (open) {
			form.reset();
			form.setFieldValue("potSize", initialValues?.potSize.toString() ?? "");
			form.setFieldValue("trials", initialValues?.trials.toString() ?? "1");
			form.setFieldValue("equity", initialValues?.equity.toString() ?? "");
			form.setFieldValue("wins", initialValues?.wins.toString() ?? "");
		}
	}, [open, initialValues, form]);

	const isEditMode = initialValues !== undefined;

	return (
		<ResponsiveDialog
			description="Capture the pot size, equity, and result for an all-in spot."
			onOpenChange={onOpenChange}
			open={open}
			title={isEditMode ? "Edit All-in" : "Add All-in"}
		>
			<form
				className="flex flex-col gap-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field
					name="potSize"
					validators={{
						onChange: ({ value }) => {
							if (value === "") {
								return "Pot size is required";
							}
							const n = Number(value);
							if (Number.isNaN(n)) {
								return "Must be a number";
							}
							if (n <= 0) {
								return "Must be greater than 0";
							}
							return undefined;
						},
					}}
				>
					{(field) => (
						<Field
							error={
								field.state.meta.isTouched
									? field.state.meta.errors[0]
									: undefined
							}
							htmlFor="allIn-potSize"
							label="Pot Size"
							required
						>
							<Input
								id="allIn-potSize"
								min={1}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								step="any"
								type="number"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>

				<form.Field
					name="trials"
					validators={{
						onChange: ({ value }) => {
							if (value === "") {
								return "Trials is required";
							}
							const n = Number(value);
							if (Number.isNaN(n)) {
								return "Must be a number";
							}
							if (!Number.isInteger(n)) {
								return "Must be a whole number";
							}
							if (n < 1) {
								return "Must be at least 1";
							}
							return undefined;
						},
					}}
				>
					{(field) => (
						<Field
							error={
								field.state.meta.isTouched
									? field.state.meta.errors[0]
									: undefined
							}
							htmlFor="allIn-trials"
							label="Trials"
							required
						>
							<Input
								id="allIn-trials"
								min={1}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								step={1}
								type="number"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>

				<form.Field
					name="equity"
					validators={{
						onChange: ({ value }) => {
							if (value === "") {
								return undefined;
							}
							const n = Number(value);
							if (Number.isNaN(n)) {
								return "Must be a number";
							}
							if (n < 0) {
								return "Must be 0 or greater";
							}
							if (n > 100) {
								return "Must be 100 or less";
							}
							return undefined;
						},
					}}
				>
					{(field) => (
						<Field
							error={
								field.state.meta.isTouched
									? field.state.meta.errors[0]
									: undefined
							}
							htmlFor="allIn-equity"
							label="Equity %"
						>
							<Input
								id="allIn-equity"
								max={100}
								min={0}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								step={0.1}
								type="number"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>

				<form.Field
					name="wins"
					validators={{
						onChangeListenTo: ["trials"],
						onChange: ({ value, fieldApi }) => {
							if (value === "") {
								return undefined;
							}
							const n = Number(value);
							if (Number.isNaN(n)) {
								return "Must be a number";
							}
							if (n < 0) {
								return "Must be 0 or greater";
							}
							const trialsStr = fieldApi.form.getFieldValue("trials");
							const trials = Number(trialsStr);
							if (!Number.isNaN(trials) && trials > 0 && n > trials) {
								return `Must be ${trials} or less (cannot exceed trials)`;
							}
							return undefined;
						},
					}}
				>
					{(field) => (
						<Field
							description="Decimal values are allowed for chopped pots."
							error={
								field.state.meta.isTouched
									? field.state.meta.errors[0]
									: undefined
							}
							htmlFor="allIn-wins"
							label="Wins"
						>
							<Input
								id="allIn-wins"
								min={0}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								step={0.1}
								type="number"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>

				<form.Subscribe selector={(state) => state.values}>
					{(values) => {
						const p = safeNum(values.potSize);
						const t = Math.max(1, safeNum(values.trials));
						const e = safeNum(values.equity);
						const w = safeNum(values.wins);
						const evAmount = p * (e / 100);
						const actual = (p / t) * w;
						const evDiff = evAmount - actual;
						return (
							<div className="rounded-lg bg-muted p-3 text-sm">
								<p>EV Amount: {evAmount.toFixed(2)}</p>
								<p>Actual: {actual.toFixed(2)}</p>
								<p>EV Diff: {evDiff.toFixed(2)}</p>
							</div>
						);
					}}
				</form.Subscribe>

				<form.Subscribe selector={(state) => state.canSubmit}>
					{(canSubmit) => (
						<DialogActionRow>
							<Button
								onClick={() => onOpenChange(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							{onDelete ? (
								<Button onClick={onDelete} type="button" variant="destructive">
									Delete
								</Button>
							) : null}
							<Button disabled={!canSubmit} type="submit">
								{isEditMode ? "Save" : "Add All-in"}
							</Button>
						</DialogActionRow>
					)}
				</form.Subscribe>
			</form>
		</ResponsiveDialog>
	);
}

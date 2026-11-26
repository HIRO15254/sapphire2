import type { GameGroup } from "@/features/games/hooks/use-game-masters";
import { Field, FieldError, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { firstError } from "@/shared/lib/form-errors";
import {
	ANTE_OPTIONS,
	BLIND_ROWS,
	type GroupFormSubmit,
	useGroupForm,
} from "./use-group-form";

interface GroupFormProps {
	formId: string;
	group: GameGroup | null;
	groups: GameGroup[] | undefined;
	onSubmit: (values: GroupFormSubmit) => Promise<void>;
}

export function GroupForm({ formId, group, groups, onSubmit }: GroupFormProps) {
	const {
		form,
		labelError,
		onAnteChange,
		onBlindLabelChange,
		onFormSubmit,
		onLabelChange,
		serverBlindError,
	} = useGroupForm({ group, groups, onSubmit });

	return (
		<form
			className="flex flex-col gap-4 pt-1 pb-2"
			id={formId}
			noValidate
			onSubmit={onFormSubmit}
		>
			<form.Field name="label">
				{(field) => (
					<Field
						error={labelError ?? firstError(field.state.meta.errors)}
						htmlFor="group-label"
						label="Name"
						required
					>
						<Input
							id="group-label"
							onBlur={field.handleBlur}
							onChange={onLabelChange(field.handleChange)}
							size="xl"
							type="text"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<div className="flex flex-col gap-2.5">
				<h3 className="text-muted-foreground m-0 text-[11px] font-semibold tracking-[var(--tracking-caps)] uppercase">
					Blinds
				</h3>
				{BLIND_ROWS.map(({ field: blind, name }) => (
					<form.Field key={blind} name={`blind${blind}Label`}>
						{(labelField) => {
							const error =
								serverBlindError(blind) ??
								firstError(labelField.state.meta.errors);
							const errorId = `group-blind${blind}-error`;
							return (
								<div className="flex flex-col gap-1">
									<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
										<div className="flex min-w-0 flex-col gap-1.5">
											<FieldLabel htmlFor={`group-blind${blind}`}>
												{`${name} name`}
											</FieldLabel>
											<Input
												aria-describedby={error ? errorId : undefined}
												aria-invalid={error ? true : undefined}
												id={`group-blind${blind}`}
												onBlur={labelField.handleBlur}
												onChange={onBlindLabelChange(
													blind,
													labelField.handleChange
												)}
												size="xl"
												type="text"
												value={labelField.state.value}
											/>
										</div>
										<form.Field name={`blind${blind}Required`}>
											{(requiredField) => (
												<Switch
													aria-label={`${name} required`}
													checked={
														labelField.state.value.trim() !== "" &&
														requiredField.state.value
													}
													disabled={labelField.state.value.trim() === ""}
													label="Required"
													onCheckedChange={requiredField.handleChange}
													size="xl"
												/>
											)}
										</form.Field>
									</div>
									{error ? <FieldError id={errorId}>{error}</FieldError> : null}
								</div>
							);
						}}
					</form.Field>
				))}
			</div>
			<form.Field name="ante">
				{(field) => (
					<Field htmlFor="group-ante" label="Ante">
						<Select
							onValueChange={onAnteChange(field.handleChange)}
							value={field.state.value}
						>
							<SelectTrigger id="group-ante">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ANTE_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>
		</form>
	);
}

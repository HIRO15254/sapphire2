import type { WidgetEditProps } from "@/features/dashboard/widgets/registry";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import {
	NONE_VALUE,
	SESSION_TYPE_LABEL,
	UNIT_LABEL,
	X_AXIS_LABEL,
} from "../labels";
import { usePnlGraphEditForm } from "../use-pnl-graph-edit-form";
import type {
	PnlGraphSessionType,
	PnlGraphUnit,
	PnlGraphXAxis,
} from "../use-pnl-graph-widget";

export function PnlGraphEditForm({ config, formId, onSave }: WidgetEditProps) {
	const { form, rooms, ringGames, currencies } = usePnlGraphEditForm({
		config,
		onSave,
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
			<form.Field name="xAxis">
				{(field) => (
					<Field htmlFor={field.name} label="X Axis">
						<Select
							onValueChange={(value) =>
								field.handleChange(value as PnlGraphXAxis)
							}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="date">{X_AXIS_LABEL.date}</SelectItem>
								<SelectItem value="sessionCount">
									{X_AXIS_LABEL.sessionCount}
								</SelectItem>
								<SelectItem value="playTime">
									{X_AXIS_LABEL.playTime}
								</SelectItem>
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Field name="dateRangeDays">
				{(field) => (
					<Field
						description="Leave empty to use all-time data."
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Date Range (days)"
					>
						<Input
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field name="sessionType">
				{(field) => (
					<Field htmlFor={field.name} label="Session Type">
						<Select
							onValueChange={(value) =>
								field.handleChange(value as PnlGraphSessionType)
							}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">{SESSION_TYPE_LABEL.all}</SelectItem>
								<SelectItem value="cash_game">
									{SESSION_TYPE_LABEL.cash_game}
								</SelectItem>
								<SelectItem value="tournament">
									{SESSION_TYPE_LABEL.tournament}
								</SelectItem>
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Field name="unit">
				{(field) => (
					<Field
						description="Normalized = BB for cash sessions, BI for tournaments."
						htmlFor={field.name}
						label="Unit"
					>
						<Select
							onValueChange={(value) =>
								field.handleChange(value as PnlGraphUnit)
							}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="currency">{UNIT_LABEL.currency}</SelectItem>
								<SelectItem value="normalized">
									{UNIT_LABEL.normalized}
								</SelectItem>
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Field name="roomId">
				{(field) => (
					<Field htmlFor={field.name} label="Room">
						<Select
							onValueChange={(value) => field.handleChange(value)}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>(All rooms)</SelectItem>
								{rooms.map((s) => (
									<SelectItem key={s.id} value={s.id}>
										{s.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Subscribe selector={(s) => s.values.roomId}>
				{(roomId) =>
					roomId === NONE_VALUE ? null : (
						<form.Field name="ringGameId">
							{(field) => (
								<Field htmlFor={field.name} label="Ring Game">
									<Select
										onValueChange={(value) => field.handleChange(value)}
										value={field.state.value}
									>
										<SelectTrigger className="w-full" id={field.name}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE_VALUE}>
												(All ring games)
											</SelectItem>
											{ringGames.map((rg) => (
												<SelectItem key={rg.id} value={rg.id}>
													{rg.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
							)}
						</form.Field>
					)
				}
			</form.Subscribe>

			<form.Field name="currencyId">
				{(field) => (
					<Field htmlFor={field.name} label="Currency">
						<Select
							onValueChange={(value) => field.handleChange(value)}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>(All currencies)</SelectItem>
								{currencies.map((c) => (
									<SelectItem key={c.id} value={c.id}>
										{c.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Field name="showEvCash">
				{(field) => {
					const id = "pnl-graph-show-ev-cash";
					return (
						<Field
							description="Adds an EV-based cumulative line for cash sessions."
							label="Cash EV P&L line"
						>
							<div className="flex items-center gap-2">
								<Checkbox
									checked={field.state.value}
									id={id}
									onCheckedChange={(next) => field.handleChange(next === true)}
								/>
								<Label className="cursor-pointer text-sm" htmlFor={id}>
									Show
								</Label>
							</div>
						</Field>
					);
				}}
			</form.Field>

			<Field label="Show in widget">
				<div className="grid grid-cols-2 gap-2">
					<EditFormToggle fieldName="showXAxis" form={form} label="X Axis" />
					<EditFormToggle
						fieldName="showDateRange"
						form={form}
						label="Date Range"
					/>
					<EditFormToggle
						fieldName="showSessionType"
						form={form}
						label="Session Type"
					/>
					<EditFormToggle fieldName="showUnit" form={form} label="Unit" />
					<EditFormToggle fieldName="showRoom" form={form} label="Room" />
					<EditFormToggle
						fieldName="showCurrency"
						form={form}
						label="Currency"
					/>
				</div>
			</Field>
		</form>
	);
}

interface EditFormToggleProps {
	fieldName:
		| "showXAxis"
		| "showDateRange"
		| "showSessionType"
		| "showUnit"
		| "showRoom"
		| "showCurrency";
	form: ReturnType<typeof usePnlGraphEditForm>["form"];
	label: string;
}

function EditFormToggle({ form, fieldName, label }: EditFormToggleProps) {
	return (
		<form.Field name={fieldName}>
			{(field) => {
				const id = `pnl-graph-${fieldName}`;
				return (
					<div className="flex items-center gap-2">
						<Checkbox
							checked={field.state.value}
							id={id}
							onCheckedChange={(next) => field.handleChange(next === true)}
						/>
						<Label className="cursor-pointer text-sm" htmlFor={id}>
							{label}
						</Label>
					</div>
				);
			}}
		</form.Field>
	);
}

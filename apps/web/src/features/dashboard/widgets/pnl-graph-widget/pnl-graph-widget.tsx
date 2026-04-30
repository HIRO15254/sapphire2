import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type {
	WidgetEditProps,
	WidgetRenderProps,
} from "@/features/dashboard/widgets/registry";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
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
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatCompactNumber } from "@/utils/format-number";
import { usePnlGraphEditForm } from "./use-pnl-graph-edit-form";
import {
	type PnlGraphSessionType,
	type PnlGraphUnit,
	type PnlGraphXAxis,
	usePnlGraphWidget,
} from "./use-pnl-graph-widget";

const X_AXIS_LABEL: Record<PnlGraphXAxis, string> = {
	date: "Date",
	sessionCount: "Session #",
	playTime: "Play Time (min)",
};

const SESSION_TYPE_LABEL: Record<PnlGraphSessionType, string> = {
	all: "All",
	cash_game: "Cash Game",
	tournament: "Tournament",
};

const UNIT_LABEL: Record<PnlGraphUnit, string> = {
	currency: "Currency",
	bb: "BB (cash)",
	bi: "BI (tournament)",
};

const NONE_VALUE = "__none__";

function formatXTick(value: number, xAxis: PnlGraphXAxis): string {
	if (xAxis === "date") {
		const d = new Date(value);
		const month = String(d.getUTCMonth() + 1).padStart(2, "0");
		const day = String(d.getUTCDate()).padStart(2, "0");
		return `${month}/${day}`;
	}
	return formatCompactNumber(value);
}

function formatTooltipLabel(value: number, xAxis: PnlGraphXAxis): string {
	if (xAxis === "date") {
		return new Date(value).toISOString().slice(0, 10);
	}
	if (xAxis === "playTime") {
		return `${value.toFixed(0)} min`;
	}
	return `Session ${value}`;
}

interface ChartBodyProps {
	isLoading: boolean;
	points: { cumulative: number; x: number }[];
	xAxisType: PnlGraphXAxis;
}

function ChartBody({ isLoading, points, xAxisType }: ChartBodyProps) {
	if (isLoading) {
		return <Skeleton className="h-full w-full" />;
	}
	if (points.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
				No data
			</div>
		);
	}
	return (
		<ResponsiveContainer height="100%" width="100%">
			<LineChart
				data={points}
				margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
			>
				<CartesianGrid className="stroke-border" strokeDasharray="3 3" />
				<XAxis
					dataKey="x"
					domain={["dataMin", "dataMax"]}
					tick={{ fontSize: 10 }}
					tickFormatter={(v: number) => formatXTick(v, xAxisType)}
					type="number"
				/>
				<YAxis
					tick={{ fontSize: 10 }}
					tickFormatter={(v: number) => formatCompactNumber(v)}
					width={50}
				/>
				<Tooltip
					formatter={(value) =>
						typeof value === "number" ? formatCompactNumber(value) : ""
					}
					labelFormatter={(label) =>
						typeof label === "number"
							? formatTooltipLabel(label, xAxisType)
							: ""
					}
				/>
				<Line
					className="stroke-primary"
					dataKey="cumulative"
					dot={false}
					isAnimationActive={false}
					strokeWidth={2}
					type="monotone"
				/>
			</LineChart>
		</ResponsiveContainer>
	);
}

export function PnlGraphWidget({ config }: WidgetRenderProps) {
	const {
		isLoading,
		onChangeDateRangeDays,
		onChangeSessionType,
		onChangeUnit,
		onChangeXAxis,
		parsed,
		points,
		skippedCount,
		state,
	} = usePnlGraphWidget(config);

	const flags = parsed.showFilters;
	const anyFilter =
		flags.xAxis || flags.dateRange || flags.sessionType || flags.unit;

	return (
		<div className="flex h-full flex-col gap-2 p-2">
			{anyFilter ? (
				<div className="flex flex-wrap items-center gap-2">
					{flags.xAxis ? (
						<Select
							onValueChange={(v) => onChangeXAxis(v as PnlGraphXAxis)}
							value={state.xAxis}
						>
							<SelectTrigger className="h-8 w-auto text-xs">
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
					) : null}
					{flags.dateRange ? (
						<Input
							className="h-8 w-24 text-xs"
							inputMode="numeric"
							onChange={(e) => {
								const v = e.target.value.trim();
								onChangeDateRangeDays(v === "" ? null : Number.parseInt(v, 10));
							}}
							placeholder="days"
							value={
								state.dateRangeDays === null ? "" : String(state.dateRangeDays)
							}
						/>
					) : null}
					{flags.sessionType ? (
						<Select
							onValueChange={(v) =>
								onChangeSessionType(v as PnlGraphSessionType)
							}
							value={state.sessionType}
						>
							<SelectTrigger className="h-8 w-auto text-xs">
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
					) : null}
					{flags.unit ? (
						<Select
							onValueChange={(v) => onChangeUnit(v as PnlGraphUnit)}
							value={state.unit}
						>
							<SelectTrigger className="h-8 w-auto text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="currency">{UNIT_LABEL.currency}</SelectItem>
								<SelectItem value="bb">{UNIT_LABEL.bb}</SelectItem>
								<SelectItem value="bi">{UNIT_LABEL.bi}</SelectItem>
							</SelectContent>
						</Select>
					) : null}
				</div>
			) : null}

			<div className="min-h-0 flex-1">
				<ChartBody
					isLoading={isLoading}
					points={points}
					xAxisType={state.xAxis}
				/>
			</div>

			{skippedCount > 0 ? (
				<div className="text-muted-foreground text-xs">
					{skippedCount} session{skippedCount === 1 ? "" : "s"} skipped (no unit
					info)
				</div>
			) : null}
		</div>
	);
}

export function PnlGraphEditForm({
	config,
	onCancel,
	onSave,
}: WidgetEditProps) {
	const { form, stores, ringGames, currencies } = usePnlGraphEditForm({
		config,
		onSave,
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
						description="BB only counts cash sessions; BI only counts tournaments."
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
								<SelectItem value="bb">{UNIT_LABEL.bb}</SelectItem>
								<SelectItem value="bi">{UNIT_LABEL.bi}</SelectItem>
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Field name="storeId">
				{(field) => (
					<Field htmlFor={field.name} label="Store">
						<Select
							onValueChange={(value) => field.handleChange(value)}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>(All stores)</SelectItem>
								{stores.map((s) => (
									<SelectItem key={s.id} value={s.id}>
										{s.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Subscribe selector={(s) => s.values.storeId}>
				{(storeId) =>
					storeId === NONE_VALUE ? null : (
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
					<EditFormToggle fieldName="showStore" form={form} label="Store" />
					<EditFormToggle
						fieldName="showRingGame"
						form={form}
						label="Ring Game"
					/>
					<EditFormToggle
						fieldName="showCurrency"
						form={form}
						label="Currency"
					/>
				</div>
			</Field>

			<DialogActionRow>
				<Button onClick={onCancel} type="button" variant="outline">
					Cancel
				</Button>
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<Button disabled={!canSubmit || isSubmitting} type="submit">
							{isSubmitting ? "Saving..." : "Save"}
						</Button>
					)}
				</form.Subscribe>
			</DialogActionRow>
		</form>
	);
}

interface EditFormToggleProps {
	fieldName:
		| "showXAxis"
		| "showDateRange"
		| "showSessionType"
		| "showUnit"
		| "showStore"
		| "showRingGame"
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

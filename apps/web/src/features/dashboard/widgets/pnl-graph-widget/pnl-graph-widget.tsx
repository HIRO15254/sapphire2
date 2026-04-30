import { lazy, Suspense } from "react";
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
import { usePnlGraphEditForm } from "./use-pnl-graph-edit-form";
import {
	type PnlGraphSessionType,
	type PnlGraphUnit,
	type PnlGraphXAxis,
	usePnlGraphWidget,
} from "./use-pnl-graph-widget";

const PnlGraphChart = lazy(() => import("./pnl-graph-chart"));

const X_AXIS_LABEL: Record<PnlGraphXAxis, string> = {
	date: "Date",
	sessionCount: "Session #",
	playTime: "Play Time (h)",
};

const SESSION_TYPE_LABEL: Record<PnlGraphSessionType, string> = {
	all: "All",
	cash_game: "Cash Game",
	tournament: "Tournament",
};

const UNIT_LABEL: Record<PnlGraphUnit, string> = {
	currency: "Actual Value",
	normalized: "Normalized (BB / BI)",
};

const NONE_VALUE = "__none__";
const ALL_VALUE = "__all__";

interface AggregatedPoint {
	cashCumulative?: number;
	cumulative?: number;
	evCashCumulative?: number;
	tournamentCumulative?: number;
	x: number;
}

interface ChartBodyProps {
	dual: boolean;
	isLoading: boolean;
	points: AggregatedPoint[];
	showEvCash: boolean;
	xAxisType: PnlGraphXAxis;
}

function ChartBody({
	dual,
	isLoading,
	points,
	showEvCash,
	xAxisType,
}: ChartBodyProps) {
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
		<Suspense fallback={<Skeleton className="h-full w-full" />}>
			<PnlGraphChart
				dual={dual}
				points={points}
				showEvCash={showEvCash}
				xAxisType={xAxisType}
			/>
		</Suspense>
	);
}

type InlineHandlers = ReturnType<typeof usePnlGraphWidget>;
type InlineFiltersProps = Pick<
	InlineHandlers,
	| "currencies"
	| "onChangeCurrencyId"
	| "onChangeDateRangeDays"
	| "onChangeSessionType"
	| "onChangeStoreId"
	| "onChangeUnit"
	| "onChangeXAxis"
	| "state"
	| "stores"
> & {
	flags: InlineHandlers["parsed"]["showFilters"];
};

function InlineFilters(props: InlineFiltersProps) {
	const { flags } = props;
	return (
		<div className="flex flex-wrap items-center gap-2">
			{flags.xAxis ? <XAxisSelect {...props} /> : null}
			{flags.dateRange ? <DateRangeInput {...props} /> : null}
			{flags.sessionType ? <SessionTypeSelect {...props} /> : null}
			{flags.unit ? <UnitSelect {...props} /> : null}
			{flags.store ? <StoreSelect {...props} /> : null}
			{flags.currency ? <CurrencySelect {...props} /> : null}
		</div>
	);
}

function XAxisSelect({
	onChangeXAxis,
	state,
}: Pick<InlineFiltersProps, "onChangeXAxis" | "state">) {
	return (
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
				<SelectItem value="playTime">{X_AXIS_LABEL.playTime}</SelectItem>
			</SelectContent>
		</Select>
	);
}

function DateRangeInput({
	onChangeDateRangeDays,
	state,
}: Pick<InlineFiltersProps, "onChangeDateRangeDays" | "state">) {
	return (
		<Input
			className="h-8 w-24 text-xs"
			inputMode="numeric"
			onChange={(e) => {
				const v = e.target.value.trim();
				onChangeDateRangeDays(v === "" ? null : Number.parseInt(v, 10));
			}}
			placeholder="days"
			value={state.dateRangeDays === null ? "" : String(state.dateRangeDays)}
		/>
	);
}

function SessionTypeSelect({
	onChangeSessionType,
	state,
}: Pick<InlineFiltersProps, "onChangeSessionType" | "state">) {
	return (
		<Select
			onValueChange={(v) => onChangeSessionType(v as PnlGraphSessionType)}
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
	);
}

function UnitSelect({
	onChangeUnit,
	state,
}: Pick<InlineFiltersProps, "onChangeUnit" | "state">) {
	return (
		<Select
			onValueChange={(v) => onChangeUnit(v as PnlGraphUnit)}
			value={state.unit}
		>
			<SelectTrigger className="h-8 w-auto text-xs">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="currency">{UNIT_LABEL.currency}</SelectItem>
				<SelectItem value="normalized">{UNIT_LABEL.normalized}</SelectItem>
			</SelectContent>
		</Select>
	);
}

function StoreSelect({
	onChangeStoreId,
	state,
	stores,
}: Pick<InlineFiltersProps, "onChangeStoreId" | "state" | "stores">) {
	return (
		<Select
			onValueChange={(v) => onChangeStoreId(v === ALL_VALUE ? null : v)}
			value={state.storeId ?? ALL_VALUE}
		>
			<SelectTrigger className="h-8 w-auto text-xs">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={ALL_VALUE}>All stores</SelectItem>
				{stores.map((s) => (
					<SelectItem key={s.id} value={s.id}>
						{s.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function CurrencySelect({
	currencies,
	onChangeCurrencyId,
	state,
}: Pick<InlineFiltersProps, "currencies" | "onChangeCurrencyId" | "state">) {
	return (
		<Select
			onValueChange={(v) => onChangeCurrencyId(v === ALL_VALUE ? null : v)}
			value={state.currencyId ?? ALL_VALUE}
		>
			<SelectTrigger className="h-8 w-auto text-xs">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={ALL_VALUE}>All currencies</SelectItem>
				{currencies.map((c) => (
					<SelectItem key={c.id} value={c.id}>
						{c.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export function PnlGraphWidget({ config }: WidgetRenderProps) {
	const widget = usePnlGraphWidget(config);
	const { isLoading, parsed, points, skippedCount, state } = widget;
	const flags = parsed.showFilters;
	const anyFilter =
		flags.xAxis ||
		flags.dateRange ||
		flags.sessionType ||
		flags.unit ||
		flags.store ||
		flags.currency;
	const dualSeries = state.unit === "normalized" && state.sessionType === "all";

	return (
		<div className="flex h-full flex-col gap-2 p-2">
			{anyFilter ? <InlineFilters {...widget} flags={flags} /> : null}

			<div className="min-h-0 flex-1">
				<ChartBody
					dual={dualSeries}
					isLoading={isLoading}
					points={points}
					showEvCash={state.showEvCash}
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
					<EditFormToggle fieldName="showStore" form={form} label="Store" />
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

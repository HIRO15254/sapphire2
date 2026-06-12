import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import {
	ALL_VALUE,
	SESSION_TYPE_LABEL,
	UNIT_LABEL,
	X_AXIS_LABEL,
} from "../labels";
import type {
	PnlGraphSessionType,
	PnlGraphUnit,
	PnlGraphXAxis,
	usePnlGraphWidget,
} from "../use-pnl-graph-widget";

type InlineHandlers = ReturnType<typeof usePnlGraphWidget>;
type InlineFiltersProps = Pick<
	InlineHandlers,
	| "currencies"
	| "onChangeCurrencyId"
	| "onChangeDateRangeDays"
	| "onChangeSessionType"
	| "onChangeRoomId"
	| "onChangeUnit"
	| "onChangeXAxis"
	| "state"
	| "rooms"
> & {
	flags: InlineHandlers["parsed"]["showFilters"];
};

export function InlineFilters(props: InlineFiltersProps) {
	const { flags } = props;
	return (
		<div className="flex flex-wrap items-center gap-2">
			{flags.xAxis ? <XAxisSelect {...props} /> : null}
			{flags.dateRange ? <DateRangeInput {...props} /> : null}
			{flags.sessionType ? <SessionTypeSelect {...props} /> : null}
			{flags.unit ? <UnitSelect {...props} /> : null}
			{flags.room ? <RoomSelect {...props} /> : null}
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
			aria-label="Date range in days"
			className="h-8 w-24 text-xs"
			inputMode="numeric"
			onChange={(e) => {
				const v = e.target.value.trim();
				onChangeDateRangeDays(v === "" ? null : Number.parseInt(v, 10));
			}}
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

function RoomSelect({
	onChangeRoomId,
	state,
	rooms,
}: Pick<InlineFiltersProps, "onChangeRoomId" | "state" | "rooms">) {
	return (
		<Select
			onValueChange={(v) => onChangeRoomId(v === ALL_VALUE ? null : v)}
			value={state.roomId ?? ALL_VALUE}
		>
			<SelectTrigger className="h-8 w-auto text-xs">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={ALL_VALUE}>All rooms</SelectItem>
				{rooms.map((s) => (
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

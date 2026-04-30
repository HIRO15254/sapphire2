import { IconFilter, IconRotateClockwise } from "@tabler/icons-react";
import type {
	WidgetEditProps,
	WidgetRenderProps,
} from "@/features/dashboard/widgets/registry";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectWithClear,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { useGlobalFilterEditForm } from "./use-global-filter-edit-form";
import {
	GLOBAL_FILTER_FIELD_LABELS,
	GLOBAL_FILTER_TYPE_OPTIONS,
	useGlobalFilterWidget,
} from "./use-global-filter-widget";

export function GlobalFilterWidget({ config }: WidgetRenderProps) {
	const {
		visibleFields,
		hasAnyVisible,
		hasDirtyValues,
		values,
		onValueChange,
		onReset,
		stores,
		currencies,
	} = useGlobalFilterWidget(config);

	if (!hasAnyVisible) {
		return (
			<div className="flex h-full items-center gap-2 px-3 text-muted-foreground text-sm">
				<IconFilter size={14} />
				<span>No filters configured</span>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-wrap items-center gap-2 overflow-auto px-3 py-2">
			<div className="flex shrink-0 items-center gap-1 text-muted-foreground">
				<IconFilter size={14} />
				<span className="font-medium text-xs">Filters</span>
			</div>
			{visibleFields.map((field) => {
				if (field.key === "type") {
					return (
						<div className="min-w-32" key={field.key}>
							<SelectWithClear
								onValueChange={(value) =>
									onValueChange(
										"type",
										(value as "cash_game" | "tournament" | undefined) ?? null
									)
								}
								value={values.type ?? ""}
							>
								<SelectTrigger
									aria-label={GLOBAL_FILTER_FIELD_LABELS.type}
									className="h-8 text-xs"
								>
									<SelectValue placeholder="Type" />
								</SelectTrigger>
								<SelectContent>
									{GLOBAL_FILTER_TYPE_OPTIONS.map((opt) => (
										<SelectItem key={opt.value} value={opt.value}>
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</SelectWithClear>
						</div>
					);
				}
				if (field.key === "storeId") {
					return (
						<div className="min-w-32" key={field.key}>
							<SelectWithClear
								onValueChange={(value) =>
									onValueChange("storeId", value ?? null)
								}
								value={values.storeId ?? ""}
							>
								<SelectTrigger
									aria-label={GLOBAL_FILTER_FIELD_LABELS.storeId}
									className="h-8 text-xs"
								>
									<SelectValue placeholder="Store" />
								</SelectTrigger>
								<SelectContent>
									{stores.map((s) => (
										<SelectItem key={s.id} value={s.id}>
											{s.name}
										</SelectItem>
									))}
								</SelectContent>
							</SelectWithClear>
						</div>
					);
				}
				if (field.key === "currencyId") {
					return (
						<div className="min-w-32" key={field.key}>
							<SelectWithClear
								onValueChange={(value) =>
									onValueChange("currencyId", value ?? null)
								}
								value={values.currencyId ?? ""}
							>
								<SelectTrigger
									aria-label={GLOBAL_FILTER_FIELD_LABELS.currencyId}
									className="h-8 text-xs"
								>
									<SelectValue placeholder="Currency" />
								</SelectTrigger>
								<SelectContent>
									{currencies.map((c) => (
										<SelectItem key={c.id} value={c.id}>
											{c.name}
										</SelectItem>
									))}
								</SelectContent>
							</SelectWithClear>
						</div>
					);
				}
				if (field.key === "dateFrom" || field.key === "dateTo") {
					const value = values[field.key] ?? "";
					return (
						<Input
							aria-label={GLOBAL_FILTER_FIELD_LABELS[field.key]}
							className="h-8 w-36 text-xs"
							key={field.key}
							onChange={(e) => onValueChange(field.key, e.target.value || null)}
							type="date"
							value={value}
						/>
					);
				}
				if (field.key === "dateRangeDays") {
					const value = values.dateRangeDays;
					return (
						<Input
							aria-label={GLOBAL_FILTER_FIELD_LABELS.dateRangeDays}
							className="h-8 w-24 text-xs"
							inputMode="numeric"
							key={field.key}
							onChange={(e) => {
								const trimmed = e.target.value.trim();
								if (trimmed === "") {
									onValueChange("dateRangeDays", null);
									return;
								}
								const parsed = Number.parseInt(trimmed, 10);
								onValueChange(
									"dateRangeDays",
									Number.isFinite(parsed) ? parsed : null
								);
							}}
							value={value === null ? "" : String(value)}
						/>
					);
				}
				return null;
			})}
			<Button
				aria-label="Reset filters"
				className="ml-auto h-8 shrink-0"
				disabled={!hasDirtyValues}
				onClick={onReset}
				size="sm"
				variant="ghost"
			>
				<IconRotateClockwise size={14} />
				Reset
			</Button>
		</div>
	);
}

export function GlobalFilterEditForm({
	config,
	onSave,
	onCancel,
}: WidgetEditProps) {
	const { form, stores, currencies } = useGlobalFilterEditForm({
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
			<p className="text-muted-foreground text-sm">
				Toggle a filter on to expose it as a dropdown on the dashboard. Initial
				values are applied when the widget loads or after a reset.
			</p>

			<form.Field name="typeVisible">
				{(visibleField) => (
					<form.Field name="typeInitial">
						{(valueField) => (
							<EditRow
								label={GLOBAL_FILTER_FIELD_LABELS.type}
								onVisibleChange={visibleField.handleChange}
								visible={visibleField.state.value}
							>
								<SelectWithClear
									onValueChange={(value) =>
										valueField.handleChange(
											(value ?? "") as typeof valueField.state.value
										)
									}
									value={valueField.state.value}
								>
									<SelectTrigger
										aria-label={GLOBAL_FILTER_FIELD_LABELS.type}
										className="w-full"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{GLOBAL_FILTER_TYPE_OPTIONS.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</SelectWithClear>
							</EditRow>
						)}
					</form.Field>
				)}
			</form.Field>

			<form.Field name="storeIdVisible">
				{(visibleField) => (
					<form.Field name="storeIdInitial">
						{(valueField) => (
							<EditRow
								label={GLOBAL_FILTER_FIELD_LABELS.storeId}
								onVisibleChange={visibleField.handleChange}
								visible={visibleField.state.value}
							>
								<SelectWithClear
									onValueChange={(value) =>
										valueField.handleChange(value ?? "")
									}
									value={valueField.state.value}
								>
									<SelectTrigger
										aria-label={GLOBAL_FILTER_FIELD_LABELS.storeId}
										className="w-full"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{stores.map((s) => (
											<SelectItem key={s.id} value={s.id}>
												{s.name}
											</SelectItem>
										))}
									</SelectContent>
								</SelectWithClear>
							</EditRow>
						)}
					</form.Field>
				)}
			</form.Field>

			<form.Field name="currencyIdVisible">
				{(visibleField) => (
					<form.Field name="currencyIdInitial">
						{(valueField) => (
							<EditRow
								label={GLOBAL_FILTER_FIELD_LABELS.currencyId}
								onVisibleChange={visibleField.handleChange}
								visible={visibleField.state.value}
							>
								<SelectWithClear
									onValueChange={(value) =>
										valueField.handleChange(value ?? "")
									}
									value={valueField.state.value}
								>
									<SelectTrigger
										aria-label={GLOBAL_FILTER_FIELD_LABELS.currencyId}
										className="w-full"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{currencies.map((c) => (
											<SelectItem key={c.id} value={c.id}>
												{c.name}
											</SelectItem>
										))}
									</SelectContent>
								</SelectWithClear>
							</EditRow>
						)}
					</form.Field>
				)}
			</form.Field>

			<form.Field name="dateFromVisible">
				{(visibleField) => (
					<form.Field name="dateFromInitial">
						{(valueField) => (
							<EditRow
								label={GLOBAL_FILTER_FIELD_LABELS.dateFrom}
								onVisibleChange={visibleField.handleChange}
								visible={visibleField.state.value}
							>
								<Input
									aria-label={GLOBAL_FILTER_FIELD_LABELS.dateFrom}
									onChange={(e) => valueField.handleChange(e.target.value)}
									type="date"
									value={valueField.state.value}
								/>
							</EditRow>
						)}
					</form.Field>
				)}
			</form.Field>

			<form.Field name="dateToVisible">
				{(visibleField) => (
					<form.Field name="dateToInitial">
						{(valueField) => (
							<EditRow
								label={GLOBAL_FILTER_FIELD_LABELS.dateTo}
								onVisibleChange={visibleField.handleChange}
								visible={visibleField.state.value}
							>
								<Input
									aria-label={GLOBAL_FILTER_FIELD_LABELS.dateTo}
									onChange={(e) => valueField.handleChange(e.target.value)}
									type="date"
									value={valueField.state.value}
								/>
							</EditRow>
						)}
					</form.Field>
				)}
			</form.Field>

			<form.Field name="dateRangeDaysVisible">
				{(visibleField) => (
					<form.Field name="dateRangeDaysInitial">
						{(valueField) => (
							<EditRow
								description="Filter to the last N days from today."
								error={valueField.state.meta.errors[0]?.message}
								label={GLOBAL_FILTER_FIELD_LABELS.dateRangeDays}
								onVisibleChange={visibleField.handleChange}
								visible={visibleField.state.value}
							>
								<Input
									aria-label={GLOBAL_FILTER_FIELD_LABELS.dateRangeDays}
									inputMode="numeric"
									onBlur={valueField.handleBlur}
									onChange={(e) => valueField.handleChange(e.target.value)}
									value={valueField.state.value}
								/>
							</EditRow>
						)}
					</form.Field>
				)}
			</form.Field>

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

interface EditRowProps {
	children: React.ReactNode;
	description?: string;
	error?: string;
	label: string;
	onVisibleChange: (next: boolean) => void;
	visible: boolean;
}

function EditRow({
	label,
	visible,
	onVisibleChange,
	children,
	description,
	error,
}: EditRowProps) {
	const switchId = `global-filter-${label.replaceAll(/\s+/g, "-").toLowerCase()}-visible`;
	return (
		<div className="flex flex-col gap-2 rounded-md border p-3">
			<div className="flex items-center justify-between gap-2">
				<Label className="font-medium text-sm" htmlFor={switchId}>
					{label}
				</Label>
				<Switch
					checked={visible}
					id={switchId}
					onCheckedChange={onVisibleChange}
				/>
			</div>
			<Field description={description} error={error} label="Initial value">
				{children}
			</Field>
		</div>
	);
}

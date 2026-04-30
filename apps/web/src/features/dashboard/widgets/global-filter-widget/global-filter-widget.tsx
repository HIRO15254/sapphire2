import { IconCalendar, IconFilter } from "@tabler/icons-react";
import type {
	WidgetEditProps,
	WidgetRenderProps,
} from "@/features/dashboard/widgets/registry";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { useGlobalFilterEditForm } from "./use-global-filter-edit-form";
import { useGlobalFilterWidget } from "./use-global-filter-widget";

export function GlobalFilterWidget({ config }: WidgetRenderProps) {
	const { type, typeLabel, dateRangeDays, hasActiveFilter } =
		useGlobalFilterWidget(config);

	if (!hasActiveFilter) {
		return (
			<div className="flex h-full items-center gap-2 px-3 text-muted-foreground text-sm">
				<IconFilter size={14} />
				<span>No active filters — showing all data</span>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-wrap items-center gap-2 px-3">
			<IconFilter className="shrink-0 text-muted-foreground" size={14} />
			{type === "all" ? null : (
				<Badge variant="secondary">Type: {typeLabel}</Badge>
			)}
			{dateRangeDays === null ? null : (
				<Badge variant="secondary">
					<IconCalendar size={12} />
					Last {dateRangeDays} {dateRangeDays === 1 ? "day" : "days"}
				</Badge>
			)}
		</div>
	);
}

export function GlobalFilterEditForm({
	config,
	onSave,
	onCancel,
}: WidgetEditProps) {
	const { form } = useGlobalFilterEditForm({ config, onSave });

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="type">
				{(field) => (
					<Field htmlFor={field.name} label="Session Type">
						<Select
							onValueChange={(value) =>
								field.handleChange(value as typeof field.state.value)
							}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All</SelectItem>
								<SelectItem value="cash_game">Cash Game</SelectItem>
								<SelectItem value="tournament">Tournament</SelectItem>
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

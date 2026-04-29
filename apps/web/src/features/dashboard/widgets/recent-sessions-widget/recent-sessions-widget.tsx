import { IconPokerChip, IconTrophy } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type {
	WidgetEditProps,
	WidgetRenderProps,
} from "@/features/dashboard/widgets/registry";
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
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatYmdSlash } from "@/utils/format-number";
import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";
import { useRecentSessionsEditForm } from "./use-recent-sessions-edit-form";
import { useRecentSessionsWidget } from "./use-recent-sessions-widget";

export function RecentSessionsWidget({ config }: WidgetRenderProps) {
	const { isLoading, items, limit } = useRecentSessionsWidget(config);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-2 p-2">
				{Array.from({ length: limit }, (_, i) => i).map((i) => (
					<Skeleton className="h-10" key={i} />
				))}
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-4 text-muted-foreground text-sm">
				No sessions yet
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col gap-1 overflow-auto p-2">
			{items.map((session) => {
				const isTournament = session.type === "tournament";
				const name = isTournament
					? (session.tournamentName ?? "Tournament")
					: (session.ringGameName ?? "Cash Game");
				return (
					<Link
						className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
						key={session.id}
						to="/sessions"
					>
						<div className="flex min-w-0 items-center gap-2">
							{isTournament ? (
								<IconTrophy
									className="shrink-0 text-yellow-500 dark:text-yellow-400"
									size={14}
								/>
							) : (
								<IconPokerChip
									className="shrink-0 text-blue-500 dark:text-blue-400"
									size={14}
								/>
							)}
							<div className="flex min-w-0 flex-col">
								<span className="truncate font-medium text-sm">{name}</span>
								<span className="text-muted-foreground text-xs">
									{formatYmdSlash(session.sessionDate)}
								</span>
							</div>
						</div>
						<span
							className={`shrink-0 font-semibold text-sm ${profitLossColorClass(session.profitLoss)}`}
						>
							{formatProfitLoss(session.profitLoss)}
						</span>
					</Link>
				);
			})}
		</div>
	);
}

export function RecentSessionsEditForm({
	config,
	onSave,
	onCancel,
}: WidgetEditProps) {
	const { form } = useRecentSessionsEditForm({ config, onSave });

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="limit">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Number of Sessions"
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
			<form.Field name="type">
				{(field) => (
					<Field htmlFor={field.name} label="Type">
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

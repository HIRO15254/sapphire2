import { IconBolt, IconPokerChip, IconTrophy } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type {
	WidgetEditProps,
	WidgetRenderProps,
} from "@/features/dashboard/widgets/registry";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useElapsedTime } from "@/shared/hooks/use-elapsed-time";
import { formatCompactNumber } from "@/utils/format-number";
import { useActiveSessionEditForm } from "./use-active-session-edit-form";
import { useActiveSessionWidget } from "./use-active-session-widget";

interface ActiveSessionRowProps {
	latestStackAmount: number | null;
	name: string;
	sessionId: string;
	sessionType: "cash-game" | "tournament";
	startedAt: string | Date | null;
}

function ActiveSessionRow({
	sessionType,
	sessionId,
	name,
	startedAt,
	latestStackAmount,
}: ActiveSessionRowProps) {
	const elapsed = useElapsedTime(startedAt, 30_000);
	return (
		<Link
			className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
			params={{ sessionType, sessionId }}
			to="/live-sessions/$sessionType/$sessionId/events"
		>
			<div className="flex min-w-0 items-center gap-2">
				{sessionType === "tournament" ? (
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
					<span className="text-muted-foreground text-xs">{elapsed}</span>
				</div>
			</div>
			<span className="shrink-0 font-semibold text-sm">
				{latestStackAmount === null
					? "—"
					: formatCompactNumber(latestStackAmount)}
			</span>
		</Link>
	);
}

export function ActiveSessionWidget({ config }: WidgetRenderProps) {
	const { isLoading, cashItems, tournamentItems } =
		useActiveSessionWidget(config);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-2 p-2">
				<Skeleton className="h-10" />
				<Skeleton className="h-10" />
			</div>
		);
	}

	if (cashItems.length === 0 && tournamentItems.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center p-4 text-muted-foreground text-sm">
				<IconBolt className="mb-2" size={20} />
				No active sessions
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col gap-1 overflow-auto p-2">
			{cashItems.map((item) => (
				<ActiveSessionRow
					key={item.id}
					latestStackAmount={item.latestStackAmount}
					name={item.ringGameName ?? "Cash Game"}
					sessionId={item.id}
					sessionType="cash-game"
					startedAt={item.startedAt}
				/>
			))}
			{tournamentItems.map((item) => (
				<ActiveSessionRow
					key={item.id}
					latestStackAmount={item.latestStackAmount}
					name={item.tournamentName ?? "Tournament"}
					sessionId={item.id}
					sessionType="tournament"
					startedAt={item.startedAt}
				/>
			))}
		</div>
	);
}

export function ActiveSessionEditForm({
	config,
	onSave,
	onCancel,
}: WidgetEditProps) {
	const { form } = useActiveSessionEditForm({ config, onSave });

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="sessionType">
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

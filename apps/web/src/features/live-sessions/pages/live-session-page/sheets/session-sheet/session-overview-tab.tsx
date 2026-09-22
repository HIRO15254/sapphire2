import {
	IconBuildingStore,
	IconChevronRight,
	IconCoins,
	IconLink,
	IconUnlink,
} from "@tabler/icons-react";
import type {
	MasterLinkCopy,
	SessionTagLike,
} from "@/features/live-sessions/utils/session-settings";
import { cn } from "@/lib/utils";
import { SessionTagField } from "./session-tag-field";
import type { SessionForm } from "./use-session-sheet";

interface SessionOverviewTabProps {
	availableTags: readonly SessionTagLike[];
	currencyLabel: string;
	form: SessionForm;
	isMasterLinked: boolean;
	master: MasterLinkCopy;
	onCreateTag: (name: string) => Promise<SessionTagLike>;
	onOpenCurrency: () => void;
	roomName: string;
}

export function SessionOverviewTab({
	availableTags,
	currencyLabel,
	form,
	isMasterLinked,
	master,
	onCreateTag,
	onOpenCurrency,
	roomName,
}: SessionOverviewTabProps) {
	return (
		<div className="flex flex-col gap-3">
			<div
				className={cn(
					"flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left",
					isMasterLinked
						? "border-border bg-card"
						: "border-[color-mix(in_oklab,var(--warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--warning)_10%,transparent)]"
				)}
			>
				{isMasterLinked ? (
					<IconLink className="shrink-0 text-muted-foreground" size={18} />
				) : (
					<IconUnlink className="shrink-0 text-warning" size={18} />
				)}
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="font-semibold text-[length:var(--m-text-footnote)]">
						{master.title}
					</span>
					<span className="text-[length:var(--m-text-caption)] text-muted-foreground">
						{master.subtitle}
					</span>
				</span>
			</div>

			<div className="flex flex-col rounded-lg border border-border px-2.5 py-0.5">
				<div className="flex items-center gap-2 border-border border-b py-2.5 text-[length:var(--text-sm)]">
					<IconBuildingStore className="text-muted-foreground" size={15} />
					<span className="flex-1 text-muted-foreground">Room</span>
					<span className="min-w-0 truncate">{roomName}</span>
				</div>
				<button
					className="flex items-center gap-2 py-2.5 text-left text-[length:var(--text-sm)] hover:text-primary"
					onClick={onOpenCurrency}
					type="button"
				>
					<IconCoins className="text-muted-foreground" size={15} />
					<span className="flex-1 text-muted-foreground">Currency</span>
					<span className="min-w-0 truncate font-mono">{currencyLabel}</span>
					<IconChevronRight className="text-muted-foreground" size={15} />
				</button>
			</div>

			<form.Field name="tagIds">
				{(field) => (
					<SessionTagField
						availableTags={availableTags}
						onAdd={(tag) => field.handleChange([...field.state.value, tag.id])}
						onCreateTag={onCreateTag}
						onRemove={(tag) =>
							field.handleChange(
								field.state.value.filter((id) => id !== tag.id)
							)
						}
						selectedTags={field.state.value
							.map((id) => availableTags.find((tag) => tag.id === id))
							.filter((tag): tag is SessionTagLike => tag !== undefined)}
					/>
				)}
			</form.Field>

			<form.Field name="memo">
				{(field) => (
					<div>
						<div className="mb-1.5 font-medium text-[length:var(--text-sm)]">
							Session memo
						</div>
						<textarea
							aria-label="Session memo"
							className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2.5 text-[length:var(--m-text-footnote)] leading-relaxed outline-none focus-visible:border-ring"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="How the session went, table conditions, anything to remember."
							rows={3}
							value={field.state.value}
						/>
					</div>
				)}
			</form.Field>
		</div>
	);
}

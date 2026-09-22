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
import { CRYST_ALERT, CRYST_FIELD, CRYST_LIST_ROW } from "../../cryst-controls";
import { TagInput } from "../../tag-input";
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
					CRYST_ALERT,
					"grid grid-cols-[auto_1fr] gap-2.5 px-3.5 py-3"
				)}
			>
				{isMasterLinked ? (
					<IconLink className="mt-px text-muted-foreground" size={16} />
				) : (
					<IconUnlink className="mt-px text-warning" size={16} />
				)}
				<div className="min-w-0">
					<p className="font-semibold tracking-[var(--tracking-heading)]">
						{master.title}
					</p>
					<p className="mt-0.5 text-muted-foreground">{master.subtitle}</p>
				</div>
			</div>

			<div className="flex flex-col overflow-hidden rounded-lg border border-border">
				<div className="flex min-h-[var(--m-list-row)] items-center gap-2.5 border-border border-b px-3 text-[length:var(--text-sm)]">
					<IconBuildingStore
						className="shrink-0 text-muted-foreground"
						size={16}
					/>
					<span className="flex-1 text-muted-foreground">Room</span>
					<span className="min-w-0 truncate font-medium">{roomName}</span>
				</div>
				<button
					className={CRYST_LIST_ROW}
					onClick={onOpenCurrency}
					type="button"
				>
					<IconCoins className="shrink-0 text-muted-foreground" size={16} />
					<span className="flex-1 text-muted-foreground">Currency</span>
					<span className="min-w-0 truncate font-medium font-mono">
						{currencyLabel}
					</span>
					<IconChevronRight
						className="shrink-0 text-muted-foreground"
						size={16}
					/>
				</button>
			</div>

			<form.Field name="tagIds">
				{(field) => (
					<div>
						<div className="mb-1.5 font-medium text-[length:var(--text-sm)]">
							Session tags
						</div>
						<TagInput
							availableTags={availableTags}
							onAdd={(tag) =>
								field.handleChange([...field.state.value, tag.id])
							}
							onCreateTag={onCreateTag}
							onRemove={(tag) =>
								field.handleChange(
									field.state.value.filter((id) => id !== tag.id)
								)
							}
							searchLabel="Add session tag"
							selectedTags={field.state.value
								.map((id) => availableTags.find((tag) => tag.id === id))
								.filter((tag): tag is SessionTagLike => tag !== undefined)}
						/>
					</div>
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
							className={cn(
								CRYST_FIELD,
								"w-full resize-none px-3 py-2.5 leading-normal"
							)}
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

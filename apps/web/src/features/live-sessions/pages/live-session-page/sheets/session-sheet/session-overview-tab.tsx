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
import {
	CRYST_FIELD,
	CRYST_FOCUS_RING,
	CRYST_LIST_ROW,
} from "../../cryst-controls";
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
	onOpenMaster: () => void;
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
	onOpenMaster,
	roomName,
}: SessionOverviewTabProps) {
	return (
		<div className="flex flex-col gap-3">
			<button
				className={cn(
					"flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-[filter] hover:brightness-110",
					CRYST_FOCUS_RING,
					isMasterLinked
						? "border-border bg-transparent"
						: "border-[color-mix(in_oklab,var(--warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--warning)_10%,transparent)]"
				)}
				onClick={onOpenMaster}
				type="button"
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
					<span className="text-pretty text-[length:var(--m-text-caption)] text-muted-foreground">
						{master.subtitle}
					</span>
				</span>
				<span className="inline-flex shrink-0 items-center gap-[3px] font-semibold text-[length:var(--text-sm)] text-primary">
					{master.action}
					<IconChevronRight aria-hidden size={15} />
				</span>
			</button>

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
							rows={3}
							value={field.state.value}
						/>
					</div>
				)}
			</form.Field>
		</div>
	);
}

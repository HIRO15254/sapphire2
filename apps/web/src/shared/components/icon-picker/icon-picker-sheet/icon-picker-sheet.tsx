import { IconBan, IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { TablerIcon } from "@/shared/components/tabler-icon";
import { Spinner } from "@/shared/components/ui/spinner";
import {
	iconLabel,
	type SuggestedIconGroup,
} from "@/shared/lib/tabler-icons/suggested-icons";
import { useIconPickerSheet } from "./use-icon-picker-sheet";

interface IconPickerSheetProps {
	all: boolean;
	allLabel: string;
	emptyLabel: string;
	icons: SuggestedIconGroup[];
	noneLabel: string;
	onPick: (name: string) => void;
	required: boolean;
	searchLabel: string;
	selectedLabel: string;
	value: string;
}

const TILE_CLASS =
	"hover:layer-accent active:layer-accent-pressed flex h-11 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 text-foreground outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)] aria-pressed:bg-primary-soft aria-pressed:text-primary-text aria-pressed:shadow-[inset_0_0_0_1px_var(--primary)]";

const GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1";

export function IconPickerSheet({
	all,
	allLabel,
	emptyLabel,
	icons,
	noneLabel,
	onPick,
	required,
	searchLabel,
	selectedLabel,
	value,
}: IconPickerSheetProps) {
	const {
		emptyMessage,
		isLoading,
		listRef,
		onListScroll,
		onQueryChange,
		onTileClick,
		query,
		showEmpty,
		showNone,
		shown,
	} = useIconPickerSheet({
		all,
		allLabel,
		emptyLabel,
		icons,
		onPick,
		required,
		selectedLabel,
		value,
	});
	return (
		<>
			<div className="relative mx-3.5 mt-2.5 flex items-center">
				<IconSearch
					aria-hidden
					className="text-muted-foreground pointer-events-none absolute left-3 size-4"
				/>
				<input
					aria-label={searchLabel}
					className="border-input bg-card text-foreground focus:border-ring h-[var(--m-control)] w-full rounded-lg border pr-2.5 pl-[34px] text-[length:var(--m-text-body)] outline-none focus:shadow-[0_0_0_1px_var(--ring)]"
					onChange={onQueryChange}
					type="search"
					value={query}
				/>
			</div>
			<div
				className="border-border relative mt-2.5 h-[336px] max-h-[60svh] min-h-0 overflow-y-auto border-t px-3.5 pb-[calc(14px+env(safe-area-inset-bottom))]"
				data-slot="icon-picker-list"
				onScroll={onListScroll}
				ref={listRef}
			>
				{isLoading ? (
					<div className="flex h-full items-center justify-center">
						<Spinner />
					</div>
				) : null}
				{showNone ? (
					<div className={cn(GRID_CLASS, "pt-2.5")}>
						<button
							aria-label={noneLabel}
							aria-pressed={value === ""}
							className={cn(TILE_CLASS, "text-muted-foreground")}
							data-icon=""
							onClick={onTileClick}
							title={noneLabel}
							type="button"
						>
							<IconBan aria-hidden className="size-[22px]" />
						</button>
					</div>
				) : null}
				{shown.map((group) => (
					<section aria-label={group.label || undefined} key={group.label}>
						{group.label ? (
							<p className="text-muted-foreground m-0 px-0.5 pt-3 pb-1.5 text-xs font-semibold tracking-[var(--tracking-caps)] uppercase">
								{group.label}
							</p>
						) : (
							<div className="h-2.5" />
						)}
						<div className={GRID_CLASS}>
							{group.names.map((name) => (
								<button
									aria-label={iconLabel(name)}
									aria-pressed={value === name}
									className={TILE_CLASS}
									data-icon={name}
									key={name}
									onClick={onTileClick}
									title={iconLabel(name)}
									type="button"
								>
									<TablerIcon name={name} size={22} />
								</button>
							))}
						</div>
					</section>
				))}
				{showEmpty ? (
					<p className="text-muted-foreground m-0 py-7 text-center text-[length:var(--m-text-secondary)]">
						{emptyMessage}
					</p>
				) : null}
			</div>
		</>
	);
}

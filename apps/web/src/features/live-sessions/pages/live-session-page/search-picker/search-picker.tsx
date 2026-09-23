import type { Icon } from "@tabler/icons-react";
import { IconCheck, IconSearch, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import {
	CRYST_FIELD_GROUP,
	CRYST_LIST_ROW,
	crystButton,
} from "../cryst-controls";
import { CrystEmptyState } from "../cryst-empty-state";

interface SearchPickerProps {
	children: ReactNode;
	emptyIcon: Icon;
	emptyLabel: string;
	isDisabled?: boolean;
	isEmpty: boolean;
	onQueryChange: (value: string) => void;
	query: string;
	searchLabel: string;
}

export function SearchPicker({
	children,
	emptyIcon: EmptyIcon,
	emptyLabel,
	isDisabled = false,
	isEmpty,
	onQueryChange,
	query,
	searchLabel,
}: SearchPickerProps) {
	return (
		<div
			className={cn(
				"flex flex-col gap-2.5",
				isDisabled && "pointer-events-none opacity-50"
			)}
		>
			<div
				className={cn(
					CRYST_FIELD_GROUP,
					"flex h-[var(--m-control)] items-center gap-2 pr-1.5 pl-[9px]"
				)}
			>
				<IconSearch className="shrink-0 text-muted-foreground" size={16} />
				<input
					aria-label={searchLabel}
					{...NO_INPUT_SUGGESTIONS}
					className="h-full min-w-0 flex-1 border-none bg-transparent outline-none"
					onChange={(e) => onQueryChange(e.target.value)}
					type="text"
					value={query}
				/>
				{query === "" ? null : (
					<button
						aria-label="Clear search"
						className={crystButton({ size: "iconSm", variant: "ghost" })}
						onClick={() => onQueryChange("")}
						type="button"
					>
						<IconX size={14} />
					</button>
				)}
			</div>

			<div className="max-h-[280px] overflow-y-auto rounded-md border border-border">
				{isEmpty ? (
					<CrystEmptyState icon={EmptyIcon} size="sm" title={emptyLabel} />
				) : (
					children
				)}
			</div>
		</div>
	);
}

interface SearchPickerRowProps {
	children: ReactNode;
	className?: string;
	isPicked: boolean;
	onClick: () => void;
}

export function SearchPickerRow({
	children,
	className,
	isPicked,
	onClick,
}: SearchPickerRowProps) {
	return (
		<button
			aria-pressed={isPicked}
			className={cn(CRYST_LIST_ROW, "py-2", isPicked && "bg-accent", className)}
			onClick={onClick}
			type="button"
		>
			{children}
			{isPicked ? (
				<IconCheck className="shrink-0 text-primary" size={16} />
			) : null}
		</button>
	);
}

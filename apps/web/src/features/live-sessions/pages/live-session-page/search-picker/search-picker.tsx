import type { Icon } from "@tabler/icons-react";
import { IconCheck, IconSearch, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";

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
			<div className="flex h-[var(--m-control)] items-center gap-2 rounded-md border border-border bg-input px-2.5">
				<IconSearch className="shrink-0 text-muted-foreground" size={16} />
				<input
					aria-label={searchLabel}
					{...NO_INPUT_SUGGESTIONS}
					className="min-w-0 flex-1 border-none bg-transparent text-[length:var(--m-text-secondary)] outline-none"
					onChange={(e) => onQueryChange(e.target.value)}
					type="text"
					value={query}
				/>
				{query === "" ? null : (
					<button
						aria-label="Clear search"
						className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
						onClick={() => onQueryChange("")}
						type="button"
					>
						<IconX size={13} />
					</button>
				)}
			</div>

			<div className="max-h-[280px] overflow-y-auto rounded-md border border-border">
				{isEmpty ? (
					<div className="flex flex-col items-center gap-1 px-4 py-5 text-muted-foreground">
						<EmptyIcon size={18} />
						<span className="text-[length:var(--m-text-footnote)]">
							{emptyLabel}
						</span>
					</div>
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
			className={cn(
				"flex min-h-11 w-full items-center gap-3 border-border border-b px-3.5 py-2 text-left last:border-b-0",
				isPicked && "bg-[color-mix(in_oklab,var(--primary)_12%,transparent)]",
				className
			)}
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

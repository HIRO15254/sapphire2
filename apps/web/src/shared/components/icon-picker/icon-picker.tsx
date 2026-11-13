import { IconChevronDown } from "@tabler/icons-react";
import { type ComponentProps, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { TablerIcon } from "@/shared/components/tabler-icon";
import {
	Drawer,
	DrawerContent,
	DrawerGrab,
	DrawerHeader,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { Spinner } from "@/shared/components/ui/spinner";
import {
	ICON_PICKER_ICONS,
	type SuggestedIconGroup,
} from "@/shared/lib/tabler-icons/suggested-icons";
import { useIconPicker } from "./use-icon-picker";

const IconPickerSheet = lazy(() =>
	import("./icon-picker-sheet").then((module) => ({
		default: module.IconPickerSheet,
	}))
);

interface IconPickerProps
	extends Omit<
		ComponentProps<"button">,
		"defaultValue" | "onChange" | "title" | "value"
	> {
	all?: boolean;
	allLabel?: string;
	emptyIcon?: string;
	emptyLabel?: string;
	icons?: SuggestedIconGroup[];
	noneLabel?: string;
	onValueChange: (name: string) => void;
	required?: boolean;
	searchLabel?: string;
	selectedLabel?: string;
	size?: "default" | "xl";
	title?: string;
	value: string;
	variant?: "field" | "icon";
}

const SIZE_CLASSES = {
	default: "h-[var(--control-md)] rounded-md text-sm",
	xl: "h-[var(--m-control)] rounded-lg text-[length:var(--m-text-body)]",
} as const;

const ICON_SIZE_CLASSES = {
	default: "w-[var(--control-md)]",
	xl: "w-[var(--m-control)]",
} as const;

export function IconPicker({
	all = true,
	allLabel = "All",
	className,
	emptyIcon = "icons",
	emptyLabel = "No icons",
	icons = ICON_PICKER_ICONS,
	noneLabel = "None",
	onValueChange,
	required = false,
	searchLabel = "Search icons",
	selectedLabel = "Selected",
	size = "default",
	title = "Icon",
	value,
	variant = "field",
	...props
}: IconPickerProps) {
	const { current, currentLabel, onOpen, onOpenChange, onPick, open } =
		useIconPicker({ onValueChange, value });
	const compact = variant === "icon";
	const glyphSize = size === "xl" ? 18 : 16;
	return (
		<>
			<button
				aria-expanded={open}
				aria-haspopup="dialog"
				aria-label={
					compact ? `${title}: ${currentLabel || noneLabel}` : undefined
				}
				className={cn(
					"border-input bg-card text-foreground focus-visible:border-ring aria-expanded:border-ring aria-invalid:border-destructive inline-flex cursor-pointer items-center gap-2 border text-left transition-[border-color,box-shadow] outline-none focus-visible:shadow-[0_0_0_1px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-expanded:shadow-[0_0_0_1px_var(--ring)]",
					SIZE_CLASSES[size],
					compact
						? cn("flex-none justify-center p-0", ICON_SIZE_CLASSES[size])
						: "w-full pr-2 pl-2.5",
					className
				)}
				data-slot="icon-picker"
				onClick={onOpen}
				title={compact && currentLabel ? currentLabel : undefined}
				type="button"
				{...props}
			>
				{compact ? (
					<TablerIcon
						fallback={emptyIcon}
						name={current}
						size={size === "xl" ? 20 : 18}
					/>
				) : (
					<>
						{current ? <TablerIcon name={current} size={glyphSize} /> : null}
						<span
							className={cn(
								"min-w-0 flex-1 truncate",
								!current && "text-muted-foreground"
							)}
						>
							{currentLabel || noneLabel}
						</span>
						<IconChevronDown
							aria-hidden
							className="text-muted-foreground size-3.5 flex-none"
						/>
					</>
				)}
			</button>
			<Drawer
				onOpenChange={onOpenChange}
				open={open}
				shouldScaleBackground={false}
			>
				<DrawerContent aria-describedby={undefined}>
					<DrawerGrab />
					<DrawerHeader>
						<DrawerTitle>{title}</DrawerTitle>
					</DrawerHeader>
					{open ? (
						<Suspense
							fallback={
								<div className="flex h-[336px] max-h-[60svh] items-center justify-center">
									<Spinner />
								</div>
							}
						>
							<IconPickerSheet
								all={all}
								allLabel={allLabel}
								emptyLabel={emptyLabel}
								icons={icons}
								noneLabel={noneLabel}
								onPick={onPick}
								required={required}
								searchLabel={searchLabel}
								selectedLabel={selectedLabel}
								value={current}
							/>
						</Suspense>
					) : null}
				</DrawerContent>
			</Drawer>
		</>
	);
}

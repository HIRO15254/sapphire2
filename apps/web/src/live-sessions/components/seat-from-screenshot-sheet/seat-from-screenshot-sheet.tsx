import { TABLE_PLAYER_SOURCE_APPS } from "@sapphire2/api/routers/ai-extract-sources";
import {
	IconAlertTriangle,
	IconChevronDown,
	IconLoader2,
	IconPhotoUp,
	IconSparkles,
} from "@tabler/icons-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { useSeatCombobox } from "@/live-sessions/hooks/use-seat-combobox";
import {
	type PlayerOption,
	type ReviewRow,
	type RowAction,
	type SessionParam,
	SOURCE_APP_ENTRIES,
} from "@/live-sessions/utils/seat-screenshot";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Input } from "@/shared/components/ui/input";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/shared/components/ui/popover";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { useSeatFromScreenshot } from "./use-seat-from-screenshot";

interface SeatFromScreenshotSheetProps {
	heroSeatPosition: number | null;
	occupiedSeatPositions: Set<number>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionParam: SessionParam;
}

export function SeatFromScreenshotSheet({
	heroSeatPosition,
	occupiedSeatPositions,
	onOpenChange,
	open,
	sessionParam,
}: SeatFromScreenshotSheetProps) {
	const {
		step,
		sourceApp,
		rows,
		isApplying,
		fileInputRef,
		isExtracting,
		allPlayers,
		onSourceAppSelect,
		onPickFile,
		onImageSelected,
		onRowNameChange,
		onRowSelectExisting,
		onRowActionChange,
		onApply,
		onBackToSelectApp,
		onBackToUpload,
	} = useSeatFromScreenshot({
		occupiedSeatPositions,
		onOpenChange,
		open,
		sessionParam,
	});

	const renderStep = () => {
		if (step === "select-app") {
			return (
				<div className="flex flex-col gap-3">
					<p className="text-muted-foreground text-sm">
						Choose the app the screenshot came from.
					</p>
					<div className="flex flex-col gap-2">
						{SOURCE_APP_ENTRIES.map(([id, config]) => (
							<Button
								key={id}
								onClick={() => onSourceAppSelect(id)}
								type="button"
								variant="outline"
							>
								{config.label}
							</Button>
						))}
					</div>
					<DialogActionRow>
						<Button
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
					</DialogActionRow>
				</div>
			);
		}

		if (step === "upload") {
			return (
				<div className="flex flex-col gap-3">
					<p className="text-muted-foreground text-sm">
						Upload a screenshot from{" "}
						<span className="font-medium text-foreground">
							{TABLE_PLAYER_SOURCE_APPS[sourceApp].label}
						</span>
						.
					</p>
					<Button disabled={isExtracting} onClick={onPickFile} type="button">
						{isExtracting ? (
							<>
								<IconLoader2 className="animate-spin" size={16} />
								Analyzing...
							</>
						) : (
							<>
								<IconPhotoUp size={16} />
								Choose screenshot
							</>
						)}
					</Button>
					<input
						accept="image/jpeg,image/png,image/gif,image/webp"
						className="hidden"
						onChange={onImageSelected}
						ref={fileInputRef}
						type="file"
					/>
					<DialogActionRow>
						<Button
							disabled={isExtracting}
							onClick={onBackToSelectApp}
							type="button"
							variant="outline"
						>
							Back
						</Button>
					</DialogActionRow>
				</div>
			);
		}

		if (rows.length === 0) {
			return (
				<div className="flex flex-col gap-3">
					<p className="text-muted-foreground text-sm">
						No players detected in the screenshot.
					</p>
					<DialogActionRow>
						<Button onClick={onBackToUpload} type="button" variant="outline">
							Try another image
						</Button>
						<Button
							onClick={() => onOpenChange(false)}
							type="button"
							variant="ghost"
						>
							Close
						</Button>
					</DialogActionRow>
				</div>
			);
		}

		const seatablesCount = rows.filter(
			(row) => row.action !== "skip" && row.warning === null
		).length;
		const heroAssignedRowId =
			rows.find((r) => r.action === "hero")?.rowId ?? null;

		return (
			<div className="flex flex-col gap-3">
				<p className="text-muted-foreground text-sm">
					Detected {rows.length} {rows.length === 1 ? "seat" : "seats"}. Review
					each row, then press Apply.
				</p>
				<div className="flex flex-col gap-2">
					{rows.map((row) => (
						<ReviewRowItem
							allPlayers={allPlayers}
							heroAlreadySeatedElsewhere={
								heroSeatPosition !== null &&
								heroSeatPosition !== row.seatPosition
							}
							heroAvailable={
								heroAssignedRowId === null || heroAssignedRowId === row.rowId
							}
							key={row.rowId}
							onActionChange={(next) => onRowActionChange(row.rowId, next)}
							onNameChange={(next) => onRowNameChange(row.rowId, next)}
							onSelectExisting={(player) =>
								onRowSelectExisting(row.rowId, player)
							}
							row={row}
						/>
					))}
				</div>
				<DialogActionRow>
					<Button
						disabled={isApplying}
						onClick={onBackToUpload}
						type="button"
						variant="outline"
					>
						Try another image
					</Button>
					<Button
						disabled={isApplying || seatablesCount === 0}
						onClick={onApply}
						type="button"
					>
						{isApplying ? (
							<>
								<IconLoader2 className="animate-spin" size={16} />
								Applying...
							</>
						) : (
							<>
								<IconSparkles size={16} />
								Apply ({seatablesCount})
							</>
						)}
					</Button>
				</DialogActionRow>
			</div>
		);
	};

	return (
		<ResponsiveDialog
			description="Seat players extracted from a screenshot in bulk."
			fullHeight={step === "review"}
			onOpenChange={onOpenChange}
			open={open}
			title="Seat from screenshot"
		>
			{renderStep()}
		</ResponsiveDialog>
	);
}

const ACTION_BADGE_VARIANT: Record<RowAction, "default" | "secondary"> = {
	hero: "default",
	existing: "secondary",
	new: "default",
	skip: "secondary",
};

const ACTION_BADGE_CLASS: Record<RowAction, string> = {
	hero: "border-amber-400 bg-amber-500/80 text-white",
	existing: "",
	new: "bg-violet-500 text-white hover:bg-violet-500/90",
	skip: "text-muted-foreground",
};

const ACTION_BADGE_LABEL: Record<RowAction, string> = {
	hero: "Hero",
	existing: "Existing",
	new: "New",
	skip: "Skip",
};

function ReviewRowItem({
	allPlayers,
	heroAlreadySeatedElsewhere,
	heroAvailable,
	onActionChange,
	onNameChange,
	onSelectExisting,
	row,
}: {
	allPlayers: PlayerOption[];
	heroAlreadySeatedElsewhere: boolean;
	heroAvailable: boolean;
	onActionChange: (next: RowAction) => void;
	onNameChange: (next: string) => void;
	onSelectExisting: (player: PlayerOption) => void;
	row: ReviewRow;
}) {
	const disabled = row.warning !== null;

	return (
		<div className="flex flex-col gap-1 rounded-md border border-border p-2">
			<div className="flex items-center gap-2">
				<Badge className="w-10 shrink-0 justify-center" variant="secondary">
					{row.seatNumber}
				</Badge>
				<SeatCombobox
					allPlayers={allPlayers}
					disabled={disabled}
					heroAvailable={heroAvailable}
					onActionChange={onActionChange}
					onNameChange={onNameChange}
					onSelectExisting={onSelectExisting}
					row={row}
				/>
				<Badge
					className={cn(
						"w-16 shrink-0 justify-center",
						ACTION_BADGE_CLASS[row.action]
					)}
					variant={ACTION_BADGE_VARIANT[row.action]}
				>
					{ACTION_BADGE_LABEL[row.action]}
				</Badge>
			</div>
			{row.warning ? (
				<div className="flex items-start gap-1.5 text-destructive text-xs">
					<IconAlertTriangle className="mt-0.5 shrink-0" size={12} />
					<span>{row.warning}</span>
				</div>
			) : null}
			{row.ambiguous && row.action !== "existing" ? (
				<span className="text-muted-foreground text-xs">
					Multiple players share this name.
				</span>
			) : null}
			{row.action === "hero" && heroAlreadySeatedElsewhere ? (
				<span className="text-muted-foreground text-xs">
					The existing Hero seat will be overwritten.
				</span>
			) : null}
		</div>
	);
}

function getSeatDisplayValue(row: ReviewRow): string {
	if (row.action === "hero") {
		return "Hero (self)";
	}
	return row.name;
}

function SeatCombobox({
	allPlayers,
	disabled,
	heroAvailable,
	onActionChange,
	onNameChange,
	onSelectExisting,
	row,
}: {
	allPlayers: PlayerOption[];
	disabled: boolean;
	heroAvailable: boolean;
	onActionChange: (next: RowAction) => void;
	onNameChange: (next: string) => void;
	onSelectExisting: (player: PlayerOption) => void;
	row: ReviewRow;
}) {
	const { popoverOpen, setPopoverOpen, contentWidth, anchorRef } =
		useSeatCombobox();

	const displayValue = getSeatDisplayValue(row);
	const readOnly = row.action === "hero";
	const normalizedInput = row.name.trim().toLowerCase();
	const filteredPlayers = normalizedInput
		? allPlayers.filter((p) => p.name.toLowerCase().includes(normalizedInput))
		: allPlayers;
	const trimmedName = row.name.trim();

	const handleSelectExisting = (player: PlayerOption) => {
		onSelectExisting(player);
		setPopoverOpen(false);
	};

	const handlePickHero = () => {
		onActionChange("hero");
		setPopoverOpen(false);
	};

	const handleKeepAsNew = () => {
		onActionChange("new");
		setPopoverOpen(false);
	};

	const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Escape") {
			setPopoverOpen(false);
		}
	};

	return (
		<Popover modal={false} onOpenChange={setPopoverOpen} open={popoverOpen}>
			<PopoverAnchor asChild>
				<div className="relative flex-1" ref={anchorRef}>
					<Input
						aria-expanded={popoverOpen}
						autoComplete="off"
						className={cn(
							"h-8 pr-7",
							readOnly && "cursor-pointer text-muted-foreground"
						)}
						disabled={disabled}
						onChange={(e) => {
							if (readOnly) {
								return;
							}
							onNameChange(e.target.value);
							setPopoverOpen(true);
						}}
						onFocus={() => {
							if (!disabled) {
								setPopoverOpen(true);
							}
						}}
						onKeyDown={handleKeyDown}
						placeholder="Player name"
						readOnly={readOnly}
						role="combobox"
						value={displayValue}
					/>
					<IconChevronDown
						className="pointer-events-none absolute top-2 right-2 text-muted-foreground"
						size={14}
					/>
				</div>
			</PopoverAnchor>
			{popoverOpen ? (
				<PopoverContent
					align="start"
					className="p-0"
					onFocusOutside={(e) => e.preventDefault()}
					onOpenAutoFocus={(e) => e.preventDefault()}
					onPointerDownOutside={(e) => {
						e.preventDefault();
					}}
					style={contentWidth ? { width: contentWidth } : undefined}
				>
					<Command shouldFilter={false}>
						<CommandList
							className="max-h-64 overflow-y-auto overscroll-contain"
							data-vaul-no-drag=""
							onTouchMove={(e) => e.stopPropagation()}
							onTouchStart={(e) => e.stopPropagation()}
							style={{ touchAction: "pan-y" }}
						>
							{heroAvailable && row.action !== "hero" ? (
								<CommandItem
									className={row.isHeroCandidate ? "text-amber-500" : ""}
									onMouseDown={(e) => e.preventDefault()}
									onSelect={handlePickHero}
									value="__hero__"
								>
									Seat Hero here
								</CommandItem>
							) : null}
							{trimmedName && row.action !== "new" ? (
								<CommandItem
									onMouseDown={(e) => e.preventDefault()}
									onSelect={handleKeepAsNew}
									value="__new__"
								>
									Create new: {trimmedName}
								</CommandItem>
							) : null}
							{filteredPlayers.length === 0 ? (
								<CommandEmpty>No matching players.</CommandEmpty>
							) : null}
							{filteredPlayers.map((p) => (
								<CommandItem
									key={p.id}
									onMouseDown={(e) => e.preventDefault()}
									onSelect={() => handleSelectExisting(p)}
									value={p.name}
								>
									{p.name}
								</CommandItem>
							))}
						</CommandList>
					</Command>
				</PopoverContent>
			) : null}
		</Popover>
	);
}

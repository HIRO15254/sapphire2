import { IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
	Drawer,
	DrawerBody,
	DrawerContent,
	DrawerGrab,
	DrawerHeader,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import { type UseGamePickerOptions, useGamePicker } from "./use-game-picker";

interface GamePickerProps extends UseGamePickerOptions {
	open: boolean;
}

export function GamePicker({ open, ...options }: GamePickerProps) {
	const { emptyText, onOpenChange, onTabChange, sections, tab } =
		useGamePicker(options);

	return (
		<Drawer
			onOpenChange={onOpenChange}
			open={open}
			shouldScaleBackground={false}
		>
			<DrawerContent aria-describedby={undefined}>
				<DrawerGrab />
				<DrawerHeader>
					<DrawerTitle>Game</DrawerTitle>
				</DrawerHeader>
				<DrawerBody className="pt-0.5">
					<Tabs
						className="flex flex-col gap-3.5"
						onValueChange={onTabChange}
						value={tab}
					>
						<TabsList variant="pill">
							<TabsTrigger value="games">Games</TabsTrigger>
							<TabsTrigger value="mixes">Mixes</TabsTrigger>
						</TabsList>
						<TabsContent className="flex flex-col gap-3.5" value={tab}>
							{sections.length === 0 ? (
								<p className="text-muted-foreground m-0 text-center">
									{emptyText}
								</p>
							) : null}
							{sections.map((section) => (
								<div className="flex flex-col gap-1.5" key={section.id}>
									<h3 className="text-muted-foreground m-0 text-[11px] font-semibold tracking-[var(--tracking-caps)] uppercase">
										{section.title}
									</h3>
									<div className="bg-card border-border flex flex-col overflow-hidden rounded-lg border">
										{section.rows.map((row) => (
											<button
												aria-pressed={row.selected}
												className={cn(
													"border-border hover:layer-accent active:layer-accent-pressed flex min-h-10 w-full cursor-pointer items-center gap-2.5 border-t px-3 py-1.5 text-left outline-none first:border-t-0 focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]",
													row.selected && "bg-primary-soft"
												)}
												key={row.id}
												onClick={row.onPick}
												type="button"
											>
												<span className="flex min-w-0 flex-1 flex-col gap-0.5">
													<span>{row.label}</span>
													{row.sub ? (
														<span className="text-muted-foreground font-mono text-xs">
															{row.sub}
														</span>
													) : null}
												</span>
												<span className="text-muted-foreground font-mono text-xs">
													{row.short}
												</span>
												{row.selected ? (
													<IconCheck
														aria-hidden
														className="text-primary-text size-4"
													/>
												) : null}
											</button>
										))}
									</div>
								</div>
							))}
						</TabsContent>
					</Tabs>
				</DrawerBody>
			</DrawerContent>
		</Drawer>
	);
}

import type { ReactNode } from "react";
import {
	Drawer,
	DrawerBody,
	DrawerContent,
	DrawerDescription,
	DrawerGrab,
	DrawerHeader,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import {
	Item,
	ItemContent,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/shared/components/ui/item";

export interface ActionSheetItem {
	destructive?: boolean;
	disabled?: boolean;
	icon: ReactNode;
	label: string;
	onSelect: () => void;
}

export interface ActionSheetGroup {
	items: ActionSheetItem[];
	label: string;
	note?: string | null;
}

interface ActionSheetProps {
	groups: ActionSheetGroup[];
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

export function ActionSheet({
	groups,
	onOpenChange,
	open,
	title,
}: ActionSheetProps) {
	return (
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent>
				<DrawerGrab />
				<DrawerHeader>
					<DrawerTitle>{title}</DrawerTitle>
					<DrawerDescription className="sr-only">Actions</DrawerDescription>
				</DrawerHeader>
				<DrawerBody className="flex flex-col gap-2 pt-0.5">
					{groups.map((group) => (
						<div className="flex flex-col gap-1.5" key={group.label}>
							<ItemGroup aria-label={group.label} size="xl" variant="inset">
								{group.items.map((item) => (
									<Item
										asChild
										key={item.label}
										variant={item.destructive ? "destructive" : "default"}
									>
										<button
											disabled={item.disabled}
											onClick={item.onSelect}
											type="button"
										>
											<ItemMedia>{item.icon}</ItemMedia>
											<ItemContent>
												<ItemTitle>{item.label}</ItemTitle>
											</ItemContent>
										</button>
									</Item>
								))}
							</ItemGroup>
							{group.note ? (
								<p className="text-muted-foreground m-0 px-1 pb-1 leading-normal text-[length:var(--m-text-footnote)]">
									{group.note}
								</p>
							) : null}
						</div>
					))}
				</DrawerBody>
			</DrawerContent>
		</Drawer>
	);
}

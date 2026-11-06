import type {
	ComponentProps,
	ComponentPropsWithoutRef,
	ElementRef,
	HTMLAttributes,
} from "react";
import { forwardRef } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

const Drawer = ({
	repositionInputs = false,
	shouldScaleBackground = true,
	...props
}: ComponentProps<typeof DrawerPrimitive.Root>) => (
	<DrawerPrimitive.Root
		repositionInputs={repositionInputs}
		shouldScaleBackground={shouldScaleBackground}
		{...props}
	/>
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = forwardRef<
	ElementRef<typeof DrawerPrimitive.Overlay>,
	ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DrawerPrimitive.Overlay
		className={cn(
			"bg-overlay fixed inset-0 z-50 backdrop-blur-[4px]",
			className
		)}
		ref={ref}
		{...props}
	/>
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = forwardRef<
	ElementRef<typeof DrawerPrimitive.Content>,
	ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
		overlayClassName?: string;
	}
>(({ className, children, overlayClassName, ...props }, ref) => (
	<DrawerPortal>
		<DrawerOverlay className={overlayClassName} />
		<DrawerPrimitive.Content
			className={cn(
				"border-border bg-popover text-popover-foreground fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85svh] w-full max-w-[560px] flex-col rounded-t-[var(--m-sheet-radius)] border border-b-0 shadow-[var(--shadow-lg)] outline-none",
				className
			)}
			ref={ref}
			{...props}
		>
			{children}
		</DrawerPrimitive.Content>
	</DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerGrab = ({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) => (
	<div
		aria-hidden
		className={cn("flex flex-none justify-center pt-2 pb-1.5", className)}
		data-slot="drawer-grab"
		{...props}
	>
		<span className="bg-input h-1 w-9 rounded-full" />
	</div>
);
DrawerGrab.displayName = "DrawerGrab";

const DrawerHeader = ({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"border-border flex flex-col gap-1 border-b px-3.5 pb-2.5 text-center",
			className
		)}
		data-slot="drawer-header"
		{...props}
	/>
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerBody = ({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"min-h-0 flex-1 overflow-y-auto px-3.5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))] text-[length:var(--m-text-secondary)]",
			className
		)}
		data-slot="drawer-body"
		{...props}
	/>
);
DrawerBody.displayName = "DrawerBody";

const DrawerTitle = forwardRef<
	ElementRef<typeof DrawerPrimitive.Title>,
	ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
	<DrawerPrimitive.Title
		className={cn(
			"m-0 min-w-0 truncate font-semibold tracking-[var(--tracking-heading)] text-[length:var(--m-text-title)]",
			className
		)}
		ref={ref}
		{...props}
	/>
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = forwardRef<
	ElementRef<typeof DrawerPrimitive.Description>,
	ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
	<DrawerPrimitive.Description
		className={cn(
			"text-muted-foreground m-0 text-[length:var(--m-text-secondary)]",
			className
		)}
		ref={ref}
		{...props}
	/>
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
	Drawer,
	DrawerBody,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerGrab,
	DrawerHeader,
	DrawerOverlay,
	DrawerPortal,
	DrawerTitle,
	DrawerTrigger,
};

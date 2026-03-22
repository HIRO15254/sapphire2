import type {
	ComponentProps,
	ComponentPropsWithoutRef,
	ElementRef,
	HTMLAttributes,
} from "react";
import { forwardRef, useEffect, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

function useKeyboardHeight() {
	const [keyboardHeight, setKeyboardHeight] = useState(0);

	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) {
			return;
		}
		const handleResize = () => {
			const diff = window.innerHeight - vv.height;
			setKeyboardHeight(diff > 50 ? diff : 0);
		};
		vv.addEventListener("resize", handleResize);
		return () => vv.removeEventListener("resize", handleResize);
	}, []);

	return keyboardHeight;
}

const Drawer = ({
	shouldScaleBackground = true,
	...props
}: ComponentProps<typeof DrawerPrimitive.Root>) => (
	<DrawerPrimitive.Root
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
		className={cn("fixed inset-0 z-50 bg-black/80", className)}
		ref={ref}
		{...props}
	/>
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = forwardRef<
	ElementRef<typeof DrawerPrimitive.Content>,
	ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => {
	const keyboardHeight = useKeyboardHeight();

	return (
		<DrawerPortal>
			<DrawerOverlay />
			<DrawerPrimitive.Content
				className={cn(
					"fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[10px] border bg-background transition-[bottom,max-height] duration-150",
					className
				)}
				ref={ref}
				style={{
					bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : undefined,
					maxHeight:
						keyboardHeight > 0
							? `calc(100svh - ${keyboardHeight}px - 2rem)`
							: "calc(100svh - 2rem)",
				}}
				{...props}
			>
				{children}
			</DrawerPrimitive.Content>
		</DrawerPortal>
	);
});
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
		{...props}
	/>
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn("mt-auto flex flex-col gap-2 p-4", className)}
		{...props}
	/>
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = forwardRef<
	ElementRef<typeof DrawerPrimitive.Title>,
	ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
	<DrawerPrimitive.Title
		className={cn(
			"font-semibold text-lg leading-none tracking-tight",
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
		className={cn("text-muted-foreground text-sm", className)}
		ref={ref}
		{...props}
	/>
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
	Drawer,
	DrawerPortal,
	DrawerOverlay,
	DrawerTrigger,
	DrawerClose,
	DrawerContent,
	DrawerHeader,
	DrawerFooter,
	DrawerTitle,
	DrawerDescription,
};

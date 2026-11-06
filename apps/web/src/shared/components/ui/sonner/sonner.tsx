"use client";

import {
	IconAlertTriangle,
	IconCircleCheck,
	IconCircleX,
	IconInfoCircle,
	IconLoader2,
} from "@tabler/icons-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { buttonVariants } from "@/shared/components/ui/button";
import { TOAST_CARD_CLASS } from "./toast";
import { useToaster } from "./use-toaster";

export function Toaster() {
	const { theme } = useToaster();
	return (
		<Sonner
			className="toaster"
			icons={{
				error: <IconCircleX className="text-destructive-text size-4" />,
				info: <IconInfoCircle className="text-muted-foreground size-4" />,
				loading: (
					<IconLoader2 className="text-muted-foreground size-4 animate-spin" />
				),
				success: <IconCircleCheck className="text-success-text size-4" />,
				warning: <IconAlertTriangle className="text-warning-text size-4" />,
			}}
			mobileOffset={{ bottom: "calc(62px + env(safe-area-inset-bottom))" }}
			offset={{ bottom: "calc(62px + env(safe-area-inset-bottom))" }}
			position="bottom-center"
			theme={theme as ToasterProps["theme"]}
			toastOptions={{
				classNames: {
					actionButton: buttonVariants({ size: "sm", variant: "ghost" }),
					content: "min-w-0 flex-1",
					description: "mt-0.5 text-muted-foreground text-xs leading-[1.4]",
					title: "font-medium text-sm leading-[1.4]",
					toast: TOAST_CARD_CLASS,
				},
				unstyled: true,
			}}
		/>
	);
}

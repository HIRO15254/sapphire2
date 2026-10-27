"use client";

import {
	IconAlertTriangle,
	IconCircleCheck,
	IconCircleX,
	IconInfoCircle,
	IconLoader2,
} from "@tabler/icons-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { crystButton } from "@/shared/components/cryst/cryst-controls";
import { CRYST_SCOPE_CLASS } from "@/shared/components/cryst/cryst-scope";
import { useToaster } from "./use-toaster";

export function Toaster() {
	const { theme, isDesktop } = useToaster();
	return (
		<Sonner
			className={`${CRYST_SCOPE_CLASS} toaster`}
			icons={{
				success: (
					<IconCircleCheck className="size-4 text-[var(--success-text)]" />
				),
				error: <IconCircleX className="size-4 text-[var(--danger-text)]" />,
				warning: (
					<IconAlertTriangle className="size-4 text-[var(--warning-text)]" />
				),
				info: <IconInfoCircle className="size-4 text-muted-foreground" />,
				loading: (
					<IconLoader2 className="size-4 animate-spin text-muted-foreground" />
				),
			}}
			mobileOffset={{ bottom: "calc(62px + env(safe-area-inset-bottom))" }}
			offset={
				isDesktop
					? undefined
					: { bottom: "calc(62px + env(safe-area-inset-bottom))" }
			}
			position={isDesktop ? "bottom-right" : "bottom-center"}
			theme={theme as ToasterProps["theme"]}
			toastOptions={{
				unstyled: true,
				classNames: {
					toast:
						"flex w-[min(360px,calc(100vw-32px))] items-center gap-2.5 rounded-lg border border-border bg-popover py-3 pr-3 pl-3.5 text-foreground shadow-[var(--shadow-lg)]",
					content: "min-w-0 flex-1",
					title: "font-medium text-sm leading-[1.4]",
					description: "mt-0.5 text-muted-foreground text-xs leading-[1.4]",
					actionButton: crystButton({ variant: "ghost", size: "sm" }),
				},
			}}
		/>
	);
}

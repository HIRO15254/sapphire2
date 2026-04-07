import type { ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";

interface AuthProviderAction {
	icon: ReactNode;
	label: string;
	onClick: () => Promise<void>;
}

interface AuthFormShellProps {
	children: ReactNode;
	description?: ReactNode;
	eyebrow?: ReactNode;
	footerNote?: ReactNode;
	onSwitchMode: () => void;
	providerActions: AuthProviderAction[];
	switchLabel: string;
	title: string;
}

export function AuthFormShell({
	children,
	description,
	eyebrow,
	footerNote,
	onSwitchMode,
	providerActions,
	switchLabel,
	title,
}: AuthFormShellProps) {
	return (
		<div className="w-full rounded-2xl border bg-card/95 p-6 shadow-sm backdrop-blur sm:p-8">
			<div className="mb-6 space-y-2 text-center">
				{eyebrow ? (
					<p className="font-medium text-primary text-xs uppercase tracking-[0.24em]">
						{eyebrow}
					</p>
				) : null}
				<h1 className="font-bold text-3xl">{title}</h1>
				{description ? (
					<p className="text-balance text-muted-foreground text-sm">
						{description}
					</p>
				) : null}
			</div>

			<div className="space-y-2">
				{providerActions.map((action) => (
					<Button
						className="w-full"
						key={action.label}
						onClick={action.onClick}
						type="button"
						variant="outline"
					>
						{action.icon}
						{action.label}
					</Button>
				))}
			</div>

			<div className="my-4 flex items-center gap-3">
				<Separator className="flex-1" />
				<span className="text-muted-foreground text-xs uppercase">or</span>
				<Separator className="flex-1" />
			</div>

			{children}

			<div className="mt-4 space-y-3 text-center">
				<Button
					className="text-primary hover:text-primary/80"
					onClick={onSwitchMode}
					variant="link"
				>
					{switchLabel}
				</Button>
				{footerNote ? (
					<p className="text-muted-foreground text-xs">{footerNote}</p>
				) : null}
			</div>
		</div>
	);
}

export const authSubmitLabels = {
	signIn: {
		idle: "Sign In",
		submitting: "Submitting...",
	},
	signUp: {
		idle: "Sign Up",
		submitting: "Submitting...",
	},
} as const;

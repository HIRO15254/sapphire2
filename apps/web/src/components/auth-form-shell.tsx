import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface AuthProviderAction {
	icon: ReactNode;
	label: string;
	onClick: () => Promise<void>;
}

interface AuthFormShellProps {
	children: ReactNode;
	onSwitchMode: () => void;
	providerActions: AuthProviderAction[];
	switchLabel: string;
	title: string;
}

export function AuthFormShell({
	children,
	onSwitchMode,
	providerActions,
	switchLabel,
	title,
}: AuthFormShellProps) {
	return (
		<div className="mx-auto mt-10 w-full max-w-md p-6">
			<h1 className="mb-6 text-center font-bold text-3xl">{title}</h1>

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

			<div className="mt-4 text-center">
				<Button
					className="text-primary hover:text-primary/80"
					onClick={onSwitchMode}
					variant="link"
				>
					{switchLabel}
				</Button>
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

import type * as React from "react";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps extends React.ComponentProps<"div"> {
	description?: React.ReactNode;
	error?: React.ReactNode;
	htmlFor?: string;
	label?: React.ReactNode;
	required?: boolean;
}

function Field({
	children,
	className,
	description,
	error,
	htmlFor,
	label,
	required = false,
	...props
}: FieldProps) {
	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			{label ? (
				<FieldLabel htmlFor={htmlFor} required={required}>
					{label}
				</FieldLabel>
			) : null}
			{children}
			{description ? <FieldDescription>{description}</FieldDescription> : null}
			{error ? <FieldError>{error}</FieldError> : null}
		</div>
	);
}

function FieldLabel({
	children,
	className,
	required = false,
	...props
}: React.ComponentProps<typeof Label> & {
	required?: boolean;
}) {
	return (
		<Label className={cn(className)} {...props}>
			{children}
			{required ? <span className="text-destructive"> *</span> : null}
		</Label>
	);
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p className={cn("text-muted-foreground text-xs", className)} {...props} />
	);
}

function FieldError({ className, ...props }: React.ComponentProps<"p">) {
	return <p className={cn("text-destructive text-sm", className)} {...props} />;
}

export { Field, FieldDescription, FieldError, FieldLabel };

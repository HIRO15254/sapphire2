import {
	type AriaAttributes,
	type ComponentProps,
	cloneElement,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/shared/components/ui/label";
import { useField } from "./use-field";

interface FieldProps extends ComponentProps<"div"> {
	description?: ReactNode;
	error?: ReactNode;
	htmlFor?: string;
	label?: ReactNode;
	required?: boolean;
}

function withInvalid(children: ReactNode, errorId?: string): ReactNode {
	if (!(errorId && isValidElement(children))) {
		return children;
	}
	return cloneElement(children as ReactElement<AriaAttributes>, {
		"aria-invalid": true,
		"aria-describedby": errorId,
	});
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
	const { errorId } = useField();
	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			{label ? (
				<FieldLabel htmlFor={htmlFor} required={required}>
					{label}
				</FieldLabel>
			) : null}
			{withInvalid(children, error ? errorId : undefined)}
			{description ? <FieldDescription>{description}</FieldDescription> : null}
			{error ? <FieldError id={errorId}>{error}</FieldError> : null}
		</div>
	);
}

function FieldLabel({
	children,
	className,
	required = false,
	...props
}: ComponentProps<typeof Label> & {
	required?: boolean;
}) {
	return (
		<Label className={cn(className)} {...props}>
			{children}
			{required ? <span className="text-destructive"> *</span> : null}
		</Label>
	);
}

function FieldDescription({ className, ...props }: ComponentProps<"p">) {
	return (
		<p className={cn("text-muted-foreground text-xs", className)} {...props} />
	);
}

function FieldError({ className, ...props }: ComponentProps<"p">) {
	return (
		<p
			className={cn("text-destructive text-sm", className)}
			role="alert"
			{...props}
		/>
	);
}

export { Field, FieldDescription, FieldError, FieldLabel };

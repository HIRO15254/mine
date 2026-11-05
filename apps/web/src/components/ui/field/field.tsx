import {
	type AriaAttributes,
	type ComponentProps,
	cloneElement,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react";
import { Label } from "@/components/ui/label/label";
import { cn } from "@/lib/utils";
import { useField } from "./use-field";

interface FieldProps extends ComponentProps<"div"> {
	description?: ReactNode;
	error?: ReactNode;
	htmlFor?: string;
	label?: ReactNode;
	required?: boolean;
}

function withHint(
	children: ReactNode,
	hintId: string | undefined,
	invalid: boolean
): ReactNode {
	if (!(hintId && isValidElement(children))) {
		return children;
	}
	return cloneElement(children as ReactElement<AriaAttributes>, {
		"aria-describedby": hintId,
		...(invalid ? { "aria-invalid": true } : {}),
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
	const { hintId } = useField();
	const hasHint = Boolean(error || description);
	return (
		<div
			className={cn("flex min-w-0 flex-col gap-1.5", className)}
			data-invalid={error ? true : undefined}
			data-slot="field"
			{...props}
		>
			{label ? (
				<FieldLabel htmlFor={htmlFor} required={required}>
					{label}
				</FieldLabel>
			) : null}
			{withHint(children, hasHint ? hintId : undefined, Boolean(error))}
			{error ? <FieldError id={hintId}>{error}</FieldError> : null}
			{!error && description ? (
				<FieldDescription id={hintId}>{description}</FieldDescription>
			) : null}
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
		<Label className={cn(className)} data-slot="field-label" {...props}>
			{children}
			{required ? <span className="text-destructive-text"> *</span> : null}
		</Label>
	);
}

function FieldDescription({ className, ...props }: ComponentProps<"p">) {
	return (
		<p
			className={cn("m-0 text-muted-foreground text-xs", className)}
			data-slot="field-description"
			{...props}
		/>
	);
}

function FieldError({ className, ...props }: ComponentProps<"p">) {
	return (
		<p
			className={cn("m-0 text-destructive-text text-xs", className)}
			data-slot="field-error"
			role="alert"
			{...props}
		/>
	);
}

function FieldSeparator({
	children,
	className,
	...props
}: ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"my-0.5 flex items-center gap-2.5 text-muted-foreground text-xs before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border",
				className
			)}
			data-slot="field-separator"
			{...props}
		>
			{children}
		</div>
	);
}

export { Field, FieldDescription, FieldError, FieldLabel, FieldSeparator };

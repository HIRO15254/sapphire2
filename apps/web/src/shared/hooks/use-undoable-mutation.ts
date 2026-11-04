import { IconArrowBackUp, IconLoader2, IconTrash } from "@tabler/icons-react";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Toast, type ToastVariant } from "@/shared/components/ui/sonner";
import { trpcErrorCode } from "@/shared/lib/query-failure";

interface Feedback {
	description?: string;
	icon?: ReactNode;
	onUndo?: () => void;
	title: string;
	variant: ToastVariant;
}

const UNDO_WINDOW_MS = 6000;
const FEEDBACK_DURATION_MS = 6000;

const NEUTRAL_ICON_CLASS = "size-4 text-muted-foreground";

const SAVING: Feedback = {
	variant: "neutral",
	title: "Saving…",
	icon: createElement(IconLoader2, {
		className: `${NEUTRAL_ICON_CLASS} animate-spin`,
	}),
};

const SAVE_FAILED: Feedback = {
	variant: "destructive",
	title: "Couldn't save changes",
	description: "Your input is still in the form. Try again.",
};

const DELETE_FAILED: Feedback = {
	variant: "destructive",
	title: "Couldn't delete",
};

function showFeedback(
	id: string | number | undefined,
	{ onUndo, ...feedback }: Feedback,
	duration: number
) {
	const action = onUndo
		? createElement(
				Button,
				{ onClick: onUndo, size: "sm", type: "button", variant: "ghost" },
				createElement(IconArrowBackUp, { "aria-hidden": true }),
				"Undo"
			)
		: undefined;
	return toast.custom(() => createElement(Toast, { ...feedback, action }), {
		id,
		duration,
		unstyled: true,
		classNames: {
			toast: "!border-0 !bg-transparent !p-0 !shadow-[none]",
			content: "!w-full",
		},
	});
}

type UndoOptions<TData, TVariables, TContext> =
	| { destructive: true; message: string }
	| {
			destructive?: false;
			message: string;
			inverse: (
				variables: TVariables,
				data: TData,
				context: TContext | undefined
			) => Promise<unknown>;
	  };

export function useUndoableMutation<TData, TError, TVariables, TContext>(
	options: UseMutationOptions<TData, TError, TVariables, TContext>,
	feedback: UndoOptions<TData, TVariables, TContext>
) {
	const failure = feedback.destructive ? DELETE_FAILED : SAVE_FAILED;
	const mutation = useMutation<
		TData,
		TError,
		TVariables,
		{ original: TContext | undefined; id: string | number }
	>({
		...options,
		onMutate: async (variables, mutationContext) => {
			const id = showFeedback(undefined, SAVING, Number.POSITIVE_INFINITY);
			try {
				const original = await options.onMutate?.(variables, mutationContext);
				return { original, id };
			} catch (error) {
				showFeedback(id, failure, FEEDBACK_DURATION_MS);
				throw error;
			}
		},
		onError: async (error, variables, context, mutationContext) => {
			if (context) {
				showFeedback(context.id, failure, FEEDBACK_DURATION_MS);
			}
			await options.onError?.(
				error,
				variables,
				context?.original,
				mutationContext
			);
		},
		onSuccess: async (data, variables, context, mutationContext) => {
			await options.onSuccess?.(
				data,
				variables,
				context?.original as TContext,
				mutationContext
			);
			if (!context) {
				return;
			}
			if (feedback.destructive) {
				showFeedback(
					context.id,
					{
						variant: "neutral",
						title: feedback.message,
						icon: createElement(IconTrash, { className: NEUTRAL_ICON_CLASS }),
					},
					FEEDBACK_DURATION_MS
				);
				return;
			}
			let undoAvailable = true;
			const expiryTimer = setTimeout(() => {
				undoAvailable = false;
				toast.dismiss(context.id);
			}, UNDO_WINDOW_MS);
			const onUndo = () => {
				if (!undoAvailable) {
					return;
				}
				undoAvailable = false;
				clearTimeout(expiryTimer);
				showFeedback(context.id, SAVING, Number.POSITIVE_INFINITY);
				Promise.resolve()
					.then(() => feedback.inverse(variables, data, context.original))
					.then(
						() =>
							showFeedback(
								context.id,
								{
									variant: "neutral",
									title: "Change undone",
									icon: createElement(IconArrowBackUp, {
										className: NEUTRAL_ICON_CLASS,
									}),
								},
								FEEDBACK_DURATION_MS
							),
						(error: unknown) =>
							showFeedback(
								context.id,
								{
									variant: "warning",
									title: "Couldn't undo",
									description:
										trpcErrorCode(error) === "CONFLICT"
											? "It changed again after your edit. Nothing was reverted."
											: "Nothing was reverted.",
								},
								FEEDBACK_DURATION_MS
							)
					);
			};
			showFeedback(
				context.id,
				{ variant: "success", title: feedback.message, onUndo },
				Number.POSITIVE_INFINITY
			);
		},
		onSettled: async (data, error, variables, context, mutationContext) => {
			await options.onSettled?.(
				data,
				error,
				variables,
				context?.original,
				mutationContext
			);
		},
	});
	return {
		mutateAsync: mutation.mutateAsync,
		isPending: mutation.isPending,
		error: mutation.error,
	};
}

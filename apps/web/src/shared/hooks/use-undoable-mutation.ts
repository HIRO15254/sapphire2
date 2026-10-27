import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { createElement } from "react";
import { toast } from "sonner";
import {
	CrystToast,
	type CrystToastKind,
} from "@/shared/components/cryst/cryst-toast";

interface Feedback {
	description?: string;
	kind: CrystToastKind;
	onUndo?: () => void;
	title: string;
}

const UNDO_WINDOW_MS = 6000;
const FEEDBACK_DURATION_MS = 6000;

const SAVE_FAILED: Feedback = {
	kind: "error",
	title: "Couldn't save changes",
	description: "Your input is still in the form. Try again.",
};

const DELETE_FAILED: Feedback = { kind: "error", title: "Couldn't delete" };

function showFeedback(
	id: string | number | undefined,
	feedback: Feedback,
	duration: number
) {
	return toast.custom(() => createElement(CrystToast, feedback), {
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
			const id = showFeedback(
				undefined,
				{ kind: "pending", title: "Saving…" },
				Number.POSITIVE_INFINITY
			);
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
					{ kind: "deleted", title: feedback.message },
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
				showFeedback(
					context.id,
					{ kind: "pending", title: "Saving…" },
					Number.POSITIVE_INFINITY
				);
				Promise.resolve()
					.then(() => feedback.inverse(variables, data, context.original))
					.then(
						() =>
							showFeedback(
								context.id,
								{ kind: "undone", title: "Change undone" },
								FEEDBACK_DURATION_MS
							),
						() =>
							showFeedback(
								context.id,
								{
									kind: "undo-error",
									title: "Couldn't undo",
									description:
										"It changed again after your edit. Nothing was reverted.",
								},
								FEEDBACK_DURATION_MS
							)
					);
			};
			showFeedback(
				context.id,
				{ kind: "success", title: feedback.message, onUndo },
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

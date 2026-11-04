export const SESSION_RESULT_TYPE_NAME = "Session Result";

export function isSessionResultTypeName(name: string): boolean {
	return name.trim().toLowerCase() === SESSION_RESULT_TYPE_NAME.toLowerCase();
}

export function isMessageSendShortcut(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
  nativeEvent?: { isComposing?: boolean };
}): boolean {
  if (event.isComposing || event.nativeEvent?.isComposing) return false;
  if (event.key !== 'Enter') return false;
  if (event.altKey || event.shiftKey) return false;
  return event.metaKey || event.ctrlKey;
}

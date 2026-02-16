export interface FocusTargetLike {
  tagName?: string | null;
  isContentEditable?: boolean | null;
  getAttribute?: (name: string) => string | null;
}

export function isTextInputFocused(activeElement: FocusTargetLike | null | undefined): boolean {
  if (!activeElement) {
    return false;
  }

  if (activeElement.isContentEditable === true) {
    return true;
  }

  const tagName = (activeElement.tagName ?? '').toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  const role = typeof activeElement.getAttribute === 'function' ? activeElement.getAttribute('role') : null;
  if (role === 'textbox') {
    return true;
  }

  return false;
}

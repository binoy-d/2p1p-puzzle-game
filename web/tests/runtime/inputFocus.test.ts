import { describe, expect, it } from 'vitest';
import { isTextInputFocused } from '../../src/runtime/inputFocus';

describe('input focus guard', () => {
  it('returns true for input-like tags', () => {
    expect(isTextInputFocused({ tagName: 'input' })).toBe(true);
    expect(isTextInputFocused({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTextInputFocused({ tagName: 'Select' })).toBe(true);
  });

  it('returns true for contentEditable and textbox role', () => {
    expect(isTextInputFocused({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(
      isTextInputFocused({
        tagName: 'DIV',
        getAttribute(name: string): string | null {
          return name === 'role' ? 'textbox' : null;
        },
      }),
    ).toBe(true);
  });

  it('returns false for regular elements and null', () => {
    expect(isTextInputFocused(null)).toBe(false);
    expect(isTextInputFocused(undefined)).toBe(false);
    expect(isTextInputFocused({ tagName: 'DIV' })).toBe(false);
    expect(isTextInputFocused({ tagName: 'CANVAS' })).toBe(false);
  });
});

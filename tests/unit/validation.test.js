const {
  validateName,
  validateRoom,
  validateMessage,
  NAME_MAX,
  MESSAGE_MAX,
} = require('../../src/validation');

describe('validateName', () => {
  test.each([undefined, null, 42, '', '   '])('rejects empty/invalid input %p', (input) => {
    const r = validateName(input);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('Display name is required');
  });

  test('trims and collapses whitespace', () => {
    expect(validateName('  Alice   Smith ')).toEqual({ ok: true, value: 'Alice Smith' });
  });

  test('accepts exactly the max length and rejects one more', () => {
    expect(validateName('a'.repeat(NAME_MAX)).ok).toBe(true);
    const r = validateName('a'.repeat(NAME_MAX + 1));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/30 characters or fewer/);
  });

  test.each(['<script>', 'a<b', 'bob@x', 'semi;colon', 'quote"'])('rejects %p', (input) => {
    expect(validateName(input).ok).toBe(false);
  });

  test.each(['bob_1', 'mary-jane', 'José', 'லோகேஷ்', 'User 42'])('accepts %p', (input) => {
    expect(validateName(input).ok).toBe(true);
  });
});

describe('validateRoom', () => {
  test('returns a lower-case key so rooms are case-insensitive', () => {
    const a = validateRoom('General');
    const b = validateRoom('  general ');
    expect(a.ok && b.ok).toBe(true);
    expect(a.key).toBe('general');
    expect(b.key).toBe(a.key);
    expect(a.value).toBe('General');
  });

  test('rejects empty room', () => {
    expect(validateRoom('').error).toBe('Room name is required');
  });

  test('rejects invalid characters', () => {
    expect(validateRoom('room/../x').ok).toBe(false);
  });
});

describe('validateMessage', () => {
  test('rejects empty and whitespace-only messages', () => {
    expect(validateMessage('').ok).toBe(false);
    expect(validateMessage('   \n ').ok).toBe(false);
    expect(validateMessage(undefined).ok).toBe(false);
  });

  test('accepts max length and rejects one more', () => {
    expect(validateMessage('x'.repeat(MESSAGE_MAX)).ok).toBe(true);
    expect(validateMessage('x'.repeat(MESSAGE_MAX + 1)).ok).toBe(false);
  });

  test('counts emoji as single characters', () => {
    expect(validateMessage('😀'.repeat(MESSAGE_MAX)).ok).toBe(true);
  });

  test('keeps HTML as plain text (escaping is done on render)', () => {
    expect(validateMessage('<b>hi</b>').value).toBe('<b>hi</b>');
  });

  test('keeps newlines but strips control characters', () => {
    expect(validateMessage('line1\nline2\u0007').value).toBe('line1\nline2');
  });
});

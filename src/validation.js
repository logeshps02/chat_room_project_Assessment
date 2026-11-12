// Shared by the server (require) and the browser (served at /js/validation.js
// and exposed as window.ChatValidation) so both apply identical rules.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ChatValidation = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const NAME_MAX = 30;
  const ROOM_MAX = 30;
  const MESSAGE_MAX = 1000;

  // Letters (any script, incl. combining marks), digits, space, underscore, hyphen.
  const NAME_PATTERN = /^[\p{L}\p{M}\p{N} _-]+$/u;
  // Control characters except tab (\u0009) and newline (\u000A).
  // eslint-disable-next-line no-control-regex
  const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

  const charLength = (str) => Array.from(str).length;

  function validateLabel(input, { label, max }) {
    if (typeof input !== 'string') {
      return { ok: false, error: `${label} is required` };
    }
    const value = input.trim().replace(/\s+/g, ' ');
    if (!value) {
      return { ok: false, error: `${label} is required` };
    }
    if (charLength(value) > max) {
      return { ok: false, error: `${label} must be ${max} characters or fewer` };
    }
    if (!NAME_PATTERN.test(value)) {
      return {
        ok: false,
        error: `${label} can only contain letters, numbers, spaces, _ and -`,
      };
    }
    return { ok: true, value };
  }

  function validateName(input) {
    return validateLabel(input, { label: 'Display name', max: NAME_MAX });
  }

  function validateRoom(input) {
    const result = validateLabel(input, { label: 'Room name', max: ROOM_MAX });
    if (!result.ok) return result;
    return { ...result, key: result.value.toLowerCase() };
  }

  function validateMessage(input) {
    if (typeof input !== 'string') {
      return { ok: false, error: 'Message cannot be empty' };
    }
    const value = input.replace(CONTROL_CHARS, '').trim();
    if (!value) {
      return { ok: false, error: 'Message cannot be empty' };
    }
    if (charLength(value) > MESSAGE_MAX) {
      return { ok: false, error: `Message must be ${MESSAGE_MAX} characters or fewer` };
    }
    return { ok: true, value };
  }

  return {
    NAME_MAX,
    ROOM_MAX,
    MESSAGE_MAX,
    charLength,
    validateName,
    validateRoom,
    validateMessage,
  };
});

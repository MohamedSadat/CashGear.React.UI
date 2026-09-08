# CgDecimalEdit

An exact decimal editor using `CgDecimalValue | null`. Normalize values, bounds, and steps with the existing `normalizeCgDecimalValue` export. Number-based NumericEdit and SpinEdit retain their existing value types.

Arithmetic uses a signed integer coefficient with 0–28 decimal places and .NET decimal's 96-bit coefficient bound. Overflow and division by zero reject the draft. Expressions support parentheses, unary signs, and `+ - * /`, with 256-character and 32-level limits. Division is rounded to the greatest representable scale, up to 28. `roundingMode` supports `awayFromZero` (default), `toEven`, `toZero`, `floor`, and `ceiling`.

`precision` rounds edited values on commit and controls display precision; untouched focus/blur preserves stored precision. `rangeBehavior` defaults to `clamp`; `reject` retains out-of-range drafts. `commitMode` defaults to `blur`; `input` and `debounced` are available. Explicit flush blocks active IME composition and invalid drafts. Callback failures leave the draft retryable.

Localized input and currency/percent display never convert the exact value to a floating-point number. Native form submission uses a hidden canonical decimal value; call the shared commit scope before saving a form with pending input. The visible input retains required/disabled/read-only semantics. `actionsRef` exposes `flush()` and `resetDraft()`. Keyboard stepping is opt-in; spin buttons default on.

Grid and TreeList metadata accept `kind: 'decimal'` and a `decimal` configuration object. Store decimal model fields as strings and persist them through the host's existing adapter. NumericEdit and SpinEdit also accept opt-in range/rounding/commit settings; omitted settings preserve their historical defaults.

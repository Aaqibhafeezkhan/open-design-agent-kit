# Action states craft rules (kit addendum)

How a button behaves between the click and the result. This tightens
`form-validation`, and where the two disagree this file wins in this kit.

Supersedes `form-validation.md` (input state machine, `submitting` row): "Disable submit, announce status via a polite live region".
Supersedes `form-validation.md` (common mistakes): "for buttons use `disabled` plus a polite live-region status message".

## Loading is not disabled

`disabled` takes a button out of the tab order and out of the accessibility
tree's actionable set. When a request takes a while, focus falls back to the
page, keyboard users lose their place, and screen readers announce nothing.
So a busy action:

- **Keeps focus and stays in the tab order.** Use `aria-disabled="true"` and guard the click handler (ignore repeat clicks while busy), never the `disabled` attribute.
- **Keeps its label,** with a spinner beside it or a short present-tense label of the same width: "Save changes" becomes "Saving…". The button doesn't change size.
- **Announces through a live status,** a `role="status"` element that is in the DOM before the click: "Saving changes…", then "Changes saved". Put `aria-busy="true"` on the region being updated (the form or the list), not on the button.
- **Locks re-submission, not reading.** Fields can be read-only while the request runs; nothing the user typed is cleared.

```html
<button type="submit" aria-disabled="true" aria-describedby="save-status">
  <span class="spinner" aria-hidden="true"></span> Saving…
</button>
<p id="save-status" role="status">Saving changes…</p>
```

## After the request

- **Success:** the button returns to its label (or becomes the next action, such as "View project"), and the status says what happened in past tense.
- **Failure:** the button returns to its label and becomes clickable again; the error appears next to the action or the field it concerns, says the cause and the fix (see `ux-writing`), and the status announces it. Focus moves to the error only when it is about a field.
- **Slow:** after about 10 seconds, say so and offer a way out ("Still saving. Keep waiting or cancel"); the timeouts are in `state-coverage`.

## When disabled is right

`disabled` is still right for an action that isn't available yet and has
nothing in flight, such as a "Next" button before a required choice is made.
Even then, prefer leaving it enabled and explaining what's missing on click,
and if it stays disabled, say why next to it ("Choose a plan to continue").

## Show these states

Render every primary action in its idle, hover, focus-visible, busy, success
and failure states, so a reviewer can see each one. A busy state that looks
like the disabled state is a mistake: use the spinner and label change, not
greyed-out colour.

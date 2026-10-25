<!-- Ported from plugin87/ux-ui-agent-skills (.claude/skills/ux-writing/SKILL.md) at commit 55156b40e3a9, MIT License (Copyright (c) 2026 Thientan Soparat). Ideas only (the confirm-button and what-why-how rules), rewritten in the kit's words; the rest is the kit's own. Notice: notices/LICENSE-ux-ui-agent-skills.txt. -->
# UX writing craft rules

The words in an interface are part of the design. A screen with real labels,
real errors and a real empty state reads as a product; one with "Submit",
"Something went wrong" and a blank list reads as a mockup. The active
`DESIGN.md` decides the voice; this file decides what each piece of text must
say. `state-coverage` decides which states exist; this file writes them.

## Buttons and links

- Say the action and the object: "Save changes", "Create project", "Send invite". Lead with the verb.
- Never "Submit", "OK", "Yes", "Go", "Click here" or "Learn more" on its own. A link says where it goes: "Read the pricing FAQ".
- One primary action per view, and its label matches the heading's promise: a page titled "Invite your team" ends in "Send invites".
- Cancel stays "Cancel". Don't pair "No" with "Yes"; pair "Keep editing" with "Discard changes".

## Errors

Every error answers, in this order: what happened, why (if known), and what to do.

- "We couldn't save your changes. You're offline. They'll save when you reconnect." Not "Error 503" or "Something went wrong".
- Put field errors next to the field and say the fix: "Enter a date after today", not "Invalid date".
- Use the user's words, not the system's: "That email already has an account. Sign in instead?", not "Duplicate key".
- Never blame the user ("You entered a wrong password") and never dead-end: every error has a next step (retry, edit, contact support with a copyable reference).
- Keep what the user typed.

## Empty states

An empty state says what will be here, why it's empty now, and offers the first action.

- First use: "No projects yet. Projects keep your files and team in one place." Button: "Create project".
- No results: echo the query and offer a way out: "No results for ‘invoces’. Check the spelling or clear filters."
- Cleared: "All caught up." with an optional next step.
- Never "No data", "Nothing here" or a blank area.

## Loading and progress

- Over about a second, say what is loading: "Loading invoices…", not a bare spinner.
- Skeletons match the real layout (same rows, same column widths), so nothing jumps when content arrives.
- Long work names the step and lets people leave: "Importing 1,240 contacts (step 2 of 3). You can close this tab."
- Busy buttons keep their focus and label; see `action-states`.

## Destructive actions

- Name what is lost: "Delete ‘Q3 report’? Its 12 comments will be deleted too. This can't be undone."
- The confirm button restates the action and the object: title "Delete 3 files?", button "Delete 3 files". Never "OK" or "Yes".
- Use the design system's danger colour for the confirm button only, not for the whole dialog, and keep the safe choice as the default focus.
- Prefer undo over confirm where the action can be reversed: "Moved 3 files to trash. Undo".
- For an irreversible, high-stakes action (deleting an account or a workspace), ask the user to type the object's name.

## Success and notifications

- Say what happened, in past tense, with the object: "Invite sent to sam@example.com". Not "Success!".
- Toasts for routine confirmations; inline messages for anything the user must read or act on.

## Labels and forms

- Every field has a visible label; placeholders are examples, never the label.
- Say the format before the error does: "Date of birth (DD/MM/YYYY)".
- Mark the exception: if most fields are required, mark the optional ones "(optional)".
- Helper text says why you need it when it isn't obvious: "We'll only use this for delivery updates."

## Mechanics

- Sentence case for headings, buttons and labels. No ALL CAPS sentences.
- One term per concept across the whole design: if it's a "workspace", it's never also a "team" or a "space".
- Numerals for numbers ("3 files"), and real-looking data: names, dates and amounts that fit the brief.
- No filler ("Welcome to the future of productivity"), no invented metrics or testimonials, no lorem ipsum. If a figure isn't in the brief, leave a clearly marked placeholder rather than making one up.
- Don't build sentences from fragments in code ("You have " + n + " items"); write the whole sentence, with the plural.
- Never give instructions by colour or position alone: "Select the red button on the right" fails screen-reader and colour-blind users.

## Common mistakes (lint these)

- "Submit", "OK", "Click here" or "Learn more" as a whole label.
- "Something went wrong", "Invalid input" or an error code with no cause or fix.
- A list, table or panel with no empty state, or one that says only "No data".
- A destructive confirm button that reads "OK", "Yes" or "Delete" without the object, or that is styled like "Save".
- Lorem ipsum, "John Doe", "$X,XXX" or invented statistics in a finished design.
- The same thing called by two names on one screen.

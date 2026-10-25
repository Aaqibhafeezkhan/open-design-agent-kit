# Eval results

One section per run, newest last, appended by `npm run evals` (see [README.md](README.md)). Tick the "must" notes after looking at the contact sheet. Compare a PR's run against the section before it.

## 2026-10-25 — baseline, before add-taste-checks

- Kit: 0.3.0 (claude/project-thread-9q7zoa 9f26cff)
- Mode: agent claude (2.1.310 (Claude Code)), repeat 2, model claude-sonnet-5-5
- Run folder (not committed): `runs/2026-10-25-08-05-40/`
- Contact sheet: [runs/2026-10-25-08-05-40/contact-sheet.png](runs/2026-10-25-08-05-40/contact-sheet.png)

- Designs: 24 from 16 run(s); runs with no design: 0.
- Check errors by repeat: #1 0, #2 0.
- Distinct look signatures: 16 of 24 (read from the HTML; variety memory not recorded).
- Critic: n/a (no critique recorded).
- Agent cost: $6.70.

| Brief | # | Design | Skill | Errors | Error codes | Warnings | Critic | Questions | Assumptions | Tool calls | Time | Signature (accent / display / body / theme) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| analytics-dashboard | 1 | .open-design/analytics-dashboard-for-a-customer-support-team-for-this-wee/support-team-dashboard.html | od:prototype:dashboard | 0 | — | 0 (—) | n/a | 0 | 1 | 11 | 139s | #eab308 / - / - / light |
| analytics-dashboard | 2 | .open-design/support-analytics/support-analytics.html | od:prototype:dashboard | 0 | — | 0 (—) | n/a | 0 | 0 | 15 | 142s | #e0a21f / -apple-system / -apple-system / light |
| card-set | 1 | .open-design/recipe-cards/recipe-cards.html | od:prototype:magazine-poster ⚠ | 0 | — | 0 (—) | n/a | 0 | 0 | 12 | 118s | #b83a26 / Iowan Old Style / Avenir Next / light |
| card-set | 2 | .open-design/a-set-of-12-printable-recipe-cards-for-grandma-s-sunday-dinn/recipe-cards.html | od:prototype:card-set | 0 | — | 0 (—) | n/a | 0 | 0 | 19 | 113s | #a63a28 / Georgia / Georgia / light |
| gig-poster | 1 | .open-design/jazz-night-blue-room/jazz-night-blue-room.html | od:prototype:poster-hero | 0 | — | 0 (—) | n/a | 1 | 0 | 8 | 47s | #e0a93b / Georgia / Georgia / dark |
| gig-poster | 2 | .open-design/jazz-night-blue-room/jazz-night-blue-room.html | od:prototype:poster-hero | 0 | — | 0 (—) | n/a | 2 ⚠ | 0 | 10 | 52s | #1d4fa3 / Georgia / Helvetica Neue / dark |
| pitch-deck | 1 | .open-design/tidepool-seed-pitch-deck/tidepool-seed-pitch-deck.html | od:deck:html-ppt-pitch-deck | 0 | — | 0 (—) | n/a | 0 | 0 | 11 | 77s | #312c85 / Inter / Open Sans / dark |
| pitch-deck | 2 | .open-design/tidepool-seed-pitch-deck/tidepool-seed-pitch-deck.html | od:deck:html-ppt-pitch-deck | 0 | — | 0 (—) | n/a | 0 | 0 | 12 | 81s | #c9822f / Poppins / Poppins / dark |
| saas-landing | 1 | .open-design/ledgerly-landing/ledgerly-landing.html | od:prototype:saas-landing | 0 | — | 5 (overlap×5) | n/a | 0 | 0 | 11 | 97s | #d97706 / Inter / Inter / light |
| saas-landing | 2 | .open-design/ledgerly-landing/ledgerly-landing.html | od:prototype:saas-landing | 0 | — | 0 (—) | n/a | 0 | 0 | 11 | 83s | #eab308 / Inter / Inter / light |
| shop-pack | 1 | .open-design/ember-wick/banner.html | — | 0 | — | 0 (—) | n/a | 4 ⚠ | 0 | 24 | 105s | #b4631b / - / - / - |
| shop-pack | 1 | .open-design/ember-wick/care-card.html | — | 0 | — | 0 (—) | n/a | 4 ⚠ | 0 | 24 | 105s | - / - / - / - |
| shop-pack | 1 | .open-design/ember-wick/collection.html | — | 0 | — | 0 (—) | n/a | 4 ⚠ | 0 | 24 | 105s | - / - / - / - |
| shop-pack | 1 | .open-design/ember-wick/icon.html | — | 0 | — | 0 (—) | n/a | 4 ⚠ | 0 | 24 | 105s | #b4631b / - / - / - |
| shop-pack | 1 | .open-design/ember-wick/launch-post.html | — | 0 | — | 0 (—) | n/a | 4 ⚠ | 0 | 24 | 105s | #b4631b / - / - / - |
| shop-pack | 1 | .open-design/ember-wick/product.html | — | 0 | — | 0 (—) | n/a | 4 ⚠ | 0 | 24 | 105s | - / - / - / - |
| shop-pack | 2 | Open Design/ember-wick-etsy/listing-tiles.html | — | 0 | — | 0 (—) | n/a | 4 ⚠ | 0 | 31 | 151s | #d9822b / Georgia / Georgia / light |
| shop-pack | 2 | Open Design/ember-wick-etsy/master.html | — | 0 | — | 0 (—) | n/a | 4 ⚠ | 0 | 31 | 151s | #d9822b / Georgia / Georgia / light |
| shop-pack | 2 | Open Design/ember-wick-etsy/shop-banner.html | — | 0 | — | 0 (—) | n/a | 4 ⚠ | 0 | 31 | 151s | #d9822b / Georgia / Georgia / light |
| shop-pack | 2 | Open Design/ember-wick-etsy/shop-icon.html | — | 0 | — | 0 (—) | n/a | 4 ⚠ | 0 | 31 | 151s | #d9822b / Georgia / Georgia / light |
| vague-bakery | 1 | .open-design/sourdough-saturdays-poster/sourdough-saturdays-poster.html | od:prototype:poster-hero | 0 | — | 0 (—) | n/a | 1 | 0 | 9 | 57s | #c2531b / Georgia / Georgia / light |
| vague-bakery | 2 | .open-design/sourdough-saturdays-poster/sourdough-saturdays-poster.html | od:prototype:poster-hero | 0 | — | 0 (—) | n/a | 5 ⚠ | 1 | 10 | 63s | #bd5b34 / DM Serif Display / Inter / light |
| vague-launch | 1 | .open-design/fernway-landing/fernway-landing.html | od:prototype:web-prototype | 0 | — | 3 (overlap×3) | n/a | 6 ⚠ | 0 | 13 | 87s | #ff6b00 / Noto Serif Display / Noto Serif Display / light |
| vague-launch | 2 | .open-design/fernway-landing/fernway-landing.html | od:prototype:web-prototype | 0 | — | 4 (overlap×4) | n/a | 6 ⚠ | 0 | 14 | 109s | #ff6b00 / Noto Serif Display / Noto Serif Display / light |

Must notes (ticked by the reviewer from the contact sheet):

- [ ] analytics-dashboard: Has an empty state
- [ ] analytics-dashboard: The overloaded agents stand out without reading every number
- [ ] analytics-dashboard: Sample data is labelled as sample data
- [ ] card-set: Every card has the dish name, ingredients and steps
- [ ] card-set: Text fits on every card at print size
- [ ] card-set: The set looks like one family
- [ ] gig-poster: Date, time and venue readable from 3 m
- [ ] gig-poster: One clear focal image or type
- [ ] gig-poster: Price or how to get in is on it
- [ ] pitch-deck: Problem, solution, market, traction, team and ask each have a slide
- [ ] pitch-deck: No slide has more than about 40 words
- [ ] pitch-deck: Placeholder numbers are marked as placeholders
- [ ] saas-landing: Says what it does and for whom above the fold
- [ ] saas-landing: One primary call to action, repeated at the end
- [ ] saas-landing: Works at phone width without sideways scrolling
- [ ] shop-pack: Shop banner and listing images at Etsy's sizes
- [ ] shop-pack: Shop name readable at thumbnail size
- [ ] shop-pack: Missing product photos are placeholders, not invented products
- [ ] vague-bakery: Asked what to make before building
- [ ] vague-bakery: Asked at most three questions, in one message
- [ ] vague-launch: Asked what is launching and what to make
- [ ] vague-launch: Stated its assumptions once before or after building

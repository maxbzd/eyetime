# Hearing people: how EyeTime collects ratings, opinions and ideas

Usage numbers say *what* people do. This is the other half: *what they think, what they wish for, why they leave*. Two goals, which pull against each other and have to be solved together:

1. get as much of the **right** feedback as possible, in a form that can be acted on;
2. never annoy: ask rarely, at good moments, in one tap, so that people **want** to answer.

Status: **built in 3.9.0** (see "What was decided and built" at the end). The design below is kept as it was reasoned; where the code differs the end section says so, and in short: a rating needs no count of sessions (7 active days and a finished session), the quiet after the consent question is 30 days (not 14), there is no global kill switch but each card has "Not now" and "Don't ask for ratings", no store-review invitation and no door at the end of *What's new* are built yet, and the week's mood is inside the same 30-day budget as everything else.

## What the research and the best products agree on

(Sources and honesty notes are in the chat summary of this design; vendor blogs are not research, and almost every response-rate figure comes from companies that sell survey tools. Treat the numbers as direction, not fact.)

- **In the product, in context, beats email.** Vendor benchmarks: in-app surveys about 12–35 % response, email about 1–15 %. A survey that fires "on every login" trains people to dismiss it, and then does worse than a good email.
- **One question, one tap first.** Micro-surveys (a face, a thumb) keep response high. Then **progressive disclosure**: after the tap, chips ("what exactly?") and an *optional* line. Seen in Vinted, Gamma, Confluence, Discord, Braintrust (Mobbin).
- **Different chips for good and bad ratings.** "What got in the way?" after a low rating, "What did you like?" after a high one.
- **Separate kinds of feedback.** One generic "feedback" box mixes praise, ideas and outages; they need different handling. Three kinds: *idea*, *problem*, *kind word*.
- **Ask at a peak, not in a failure.** After something that worked (a finished session, the weekly review), the person is open and the answer is more honest about value.
- **Caps and snoozes.** Practice from the tools: one prompt per topic per 30–90 days, one per session, a snooze after a dismissal, a **global** cap across all surveys. Watch the *repeated-view factor* and dismissals: repeat-until-answered logic halves the answer rate.
- **The one question that tells product-market fit** (Superhuman): "How would you feel if you could no longer use X?", *very disappointed* / *somewhat* / *not*; the bar is 40 % "very disappointed"; segment the answers to find who loves it (their score went 22 % → 32 % → 58 %). The follow-ups ("what is the main benefit", "how can we improve it") are what make it actionable. As few as ~40 answers are directionally useful.
- **Close the loop.** "You said, we did" is recommended everywhere; the evidence that it raises later participation is anecdotal, not experimental. It costs almost nothing and is the right thing to do.
- **Review prompts: never gate.** Asking only the happy to review publicly, while routing the unhappy to a private form, is "review gating"; the FTC's 2024 rule targets suppressing negative reviews and its enforcement began in 2025–26. Offer the store review to **everyone**, whatever they rated.

## The design

### Always there (pull)

The best feedback arrives when a person wants to give it. So the door is always open and never pops up: a command in the palette ("Write to the maker…"), a footer link in the popup, Settings, and the end of "What's new". One form, three kinds:

| Kind | Prompt in the box | What happens to it |
|---|---|---|
| Idea | "What would you add or change? Tell me why you want it." | Tagged by theme, counted, can be marked *done* and then appears in "What's new" as "from your ideas". |
| Problem | "What happened, and what did you expect? If you remember: after which action." | Triage first; version / browser / system / language come with it. |
| Kind word | "What do you like? It really helps." | Read, thanked, shown (without a name, with permission) in the store text and in the changelog. |

The context travels as a **visible chip** the person can remove: "Sent with: EyeTime 3.9.1 · Chrome · Windows · ru". Never the anonymous usage ID. A reply address is optional ("I'd like an answer"), used only to reply and deleted after.

### Asked at good moments (push, rarely)

| Moment | Question | Asked |
|---|---|---|
| Right after a finished session | One tap (4 faces), then chips for what / why, then an optional line | After a finished session once 7 days of use have passed; at most one question in 30 days |
| End of the weekly review | "How was the week with EyeTime?" (5 dots) + an optional line | Inside the same budget of one question in 30 days, and never in a focus session |
| After 7 active days, once, then every 90 days | The product-market-fit question + "what is the main thing for you?" + "what would improve it?" | Once per 90 days |
| After a friction moment (many "continue anyway" on the pause page) | "Did the pause page help?" thumbs, optional line | At most once per 60 days |
| After the extension is removed | The reason (already there) + an optional "what would have kept you?" + an optional address | On the page that opens after removal |

### The rules of silence

1. **One global budget**: any prompt (this, the consent question, a store-review invitation) counts toward **one per 30 days**. The consent question has priority; none within 30 days of it either.
2. After "Not now" or a close: **60 days of silence** for that kind.
3. **Never** during a focus session, never in the first 7 days, never when an error or slow tab was just shown. The one small question that lives on the pause page ("Did this pause help?") shows only outside a focus session.
4. One prompt per session of use.
5. Watch the two numbers that say it is getting annoying: dismissals ÷ shown, and views per person. If dismissals rise, ask less.
6. Every card has "Not now" (quiet for 60 days) and "Don't ask for ratings" (for good); the always-open door to write stays. A single switch for all questions is not built.

### Why people will want to answer

- **It is a person**, in the voice of the consent card ("I read every message"), signed by the maker.
- **It is one tap** and everything else is optional; "Done" is always visible.
- **It shows it was heard**: "What's new" marks items that came from ideas and says how many people asked; the sender gets an honest "this is read by one person; what is done appears in What's new".
- **It feels good**: a small thank-you, a real line about what happened with the last ideas, never a gift or a reward for a *positive* answer (conditional incentives for reviews are unlawful; incentives for answering at all would bias the answers).
- **It is not a form**: no required fields, no account, no captcha, no "rate us 5 stars".

### What the owner sees

A **Feedback** page on the dashboard, not a bare inbox:
- on top: the PMF score (share "very disappointed", with an interval, by group such as days of use, language, version), the session-rating trend by week, the weekly mood, the share of people who answered at all and who dismissed;
- themes: tags counted (what people ask for most, what they complain about), with the newest messages under each theme;
- the inbox: each message with its kind, rating, trigger, context chip, and the owner's tags and status (new, read, starred, *done*, won't do); *done* feeds "What's new";
- the weekly Telegram digest gains: "N new messages, top theme X, one message worth reading".

### Review in the store (planned, not built)

The Chrome Web Store review matters for installs. On the thank-you of any feedback, to **everyone** and whatever the rating: "If you'd like, you can also tell others in the store" (a link). No filtering by rating, nothing hidden from the unhappy.

## Data, privacy and the law

- Feedback is **user-initiated** and sent by an explicit click, with the destination said in the form: "Reads one person. The text is stored on the project's server (Cloudflare). Please do not write anything personal."
- A new table `feedback` on the collector: day, kind, trigger, rating, tags, text (≤ 1000 characters), reply address (optional), context (version, browser family, system family, language), triage fields. **No usage ID, no IP, no user agent**; it is not linked to the anonymous numbers.
- Retention: 24 months or on request; the reply address is deleted once answered or after 90 days. Text may contain personal data (people write it): say so in `PRIVACY.md`, keep to what the person typed, never use it for anything but improving EyeTime and answering. Show text on the dashboard only as text (never as HTML).
- Rate and size limits on the collector (a global cap per day, no per-person tracking), the same discipline as the removal answers.
- The ratings and the product-market-fit answers are collected the same way, with no identifier, so they need no consent card of their own; they are covered by the notice at the point of asking.
- Without a collector address (the first public release), the form falls back to a public GitHub discussion or issue that the person reviews and posts themselves (it says so).
- `docs/COMPLIANCE.md` gets a row for feedback; the Chrome Web Store listing and `PRIVACY.md` get the same sentence.

## How it will be built (phases)

1. **The door**: the form (idea / problem / kind word), the collector route and table, limits, the dashboard Feedback page, `PRIVACY.md`, tests, eleven languages.
2. **The first push**: session rating and the weekly mood, with the silence rules and one global budget shared with the consent question.
3. **The product-market-fit question** and the after-removal text.
4. **Closing the loop**: "from your ideas" marks in "What's new" and the Telegram digest.
5. **The Windows app** with the same flows.

How it is measured: the share of people shown a prompt who answered, who dismissed, how many wrote text and how long; the number of ideas that were acted on; and the PMF score over time. A/B tests of wording use the same device arms as the consent question (the people who answered split between arms in proportion to how well each wording works).

## What was decided and built

- **Retention (owner's decision): messages are kept until deleted**, not 24 months. The safeguards that make that defensible are in `docs/COMPLIANCE.md` (the person deletes their own message, the reply address is erased, the answers are erased, a yearly review). `PRIVACY.md` says "until you or the developer delete it".
- **Where it lives:** the same Worker, a database of its own (`FEEDBACK_DB`, falling back to `DB`), schema `server/usage/feedback.sql`. D1 is the right choice at this size; Time Travel gives 30 days of point-in-time restore, `wrangler d1 export` gives a copy to keep. Supabase only if accounts or public votes come later.
- **The dashboard** has a *Feedback* page: new / waiting for an answer / done, the fit score against the 40 % line with its interval and the groups by length of use, the ratings by week, what people ask for and complain about by theme, a "are we asking too often" block (answered against closed), and the inbox with filters, search, keyboard, status, theme, note, "may be quoted", the reply box and the thread.
- **Answering from the dashboard into the extension.** Each message that asks for an answer carries a random ticket made on the device (`newTicket`); the collector keeps only `sha256("eyetime-fb:" + ticket)`. The owner writes the answer in the dashboard (`POST /v1/feedback/:id/reply`, at most three, 1000 characters). The extension asks `POST /v1/feedback/replies` with its tickets (at most five, at most every six hours, only while it has messages with a ticket less than 180 days old, no IP or caller stored), keeps the answers in the history on the form page, and shows a card on the new tab until it is read. The person can delete a message with its ticket (`POST /v1/feedback/forget`). The ticket is never ticked for the person and is disclosed on the form and in `PRIVACY.md`. The email address stays an option.
- **The extension side:** `src/feedback/` (the form), `src/ui/feedback-card.js` (the rating, the question of fit, the week's mood, the answer card), `src/shared/feedback.js` (the rules of silence, sending, answers), the palette command, the popup footer, Settings. Eleven languages (`fb.*`). Without a collector (the first public release) the form opens a GitHub draft and no question is ever asked.
- **Also built:** the pause page asks "Did this pause help?" (one tap, same quiet rules), the page after removal takes a few words and an address (sent as one more request, the reason is not counted twice), What's new can tag a line "from your messages" (`WN_FROM_YOU` in `src/shared/whatsnew.js`; fill it in when a release does what someone asked), and the Windows app has a "Write to the maker" row in Settings that opens a GitHub page (the app has no message server).
- **What is left:** the Windows app's own small questions and replies (it would need the ticket mechanism in Rust); they are not needed for the first release.

## Honest limits

- The response-rate figures come from vendors; plan for **5–25 %** of those shown a one-tap prompt, **1–3 %** writing a line, and well under **1 %** of all users a month using the open door unprompted. Quality will matter more than quantity.
- A feedback channel that nobody answers is worse than none. The loop (read, tag, mark done, say so in "What's new") is part of the product, not an extra.

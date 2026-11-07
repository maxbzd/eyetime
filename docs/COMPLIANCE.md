# Consent and the law: what EyeTime does, and what is left to the owner

This is an engineering review, **not legal advice**. It says what the code and the texts do, which rule each choice answers, and what only the owner (the controller) can do or decide. Have a lawyer who knows your country read it before the collector goes live; a short review is cheap compared with what a complaint costs.

## What is processed, and what that makes it

Only if the person says yes: a random 128-bit ID made on their device (derived from nothing), their usage counters (kinds of events, days of use, setup choices), the app version and language. No name, account, IP address (not stored or logged by EyeTime; the network provider necessarily sees it while it carries the connection), site, task, note, title or time of day. See `PRIVACY.md` and `docs/TRACKING-PLAN.md` for every field.

A persistent random ID attached to behaviour is a **pseudonymous identifier**. Nobody can tell who it belongs to, but data protection law (GDPR Recital 26, 30) looks at whether a person *can be* singled out, so the safe reading is: **it is personal data, and the rules for personal data apply**. Everything below follows from that. If a lawyer later says it is anonymous, the same design still holds.

## The question itself: rules and how the design answers them

| Rule | Source | What EyeTime does |
|---|---|---|
| Consent is **freely given**: no bundling, no detriment for saying no | GDPR Art. 7(4), EDPB Guidelines 05/2020 | EyeTime works identically after a no. Nothing is locked, slowed or nagged. The switch is off by default and is a separate, single-purpose question. |
| **Specific** (one purpose, not "improve experience" in general) | Art. 4(11), EDPB 05/2020 | One purpose, stated: find out whether people reach a first session, come back, which features nobody uses, speed and stability. |
| **Informed**: who, what, why, recipients, how to withdraw | Art. 13, 7(3) | The card says who asks, what is sent (exact report one click away), and links the fuller notice (`PRIVACY.md`, section "Anonymous usage: who is responsible…"). Controller, basis, recipients, transfers, retention, rights, children, California are all there. |
| **Unambiguous, affirmative act**; no pre-ticked box, no silence | Art. 4(11), Recital 32 | A click on "Yes, I'll help". Nothing is ticked, nothing is "accepted by continuing". |
| **Withdrawing as easy as giving** | Art. 7(3) | One switch in Settings; the thank-you message says where it is. It also erases what the collector holds (`op: forget`). |
| **Demonstrable** consent | Art. 7(1) | Reports can only be sent by code that checks the stored consent; the stored consent carries its time and **version** (`CONSENT_VERSION`). The collector's first report time for an ID is the earliest it could have been given. |
| Consent is **for what it was given for** | Art. 5(1)(b), EDPB 05/2020 | `CONSENT_VERSION` in the extension and the app: when the fields, purpose or recipients change, it is raised, **reports stop**, and the question comes back. A test covers it. |
| **No dark patterns**: no obstructing, stirring, skipping, fickle, left-in-the-dark | EDPB Guidelines 03/2022; EDPB Cookie Banner Taskforce report (2023) | See "What the card does and refuses" below. |
| **Refusal on the same layer**, not buried; no deceptive colour or contrast | EDPB Cookie Banner Taskforce (Jan 2023) | Both refusals are bordered, readable buttons, same height, same place as the yes, one click. A test measures their size, border and opacity. |
| Terminal-equipment access needs consent | ePrivacy Art. 5(3) | Nothing leaves the device before a yes. Local counters are the app's own data and are never read by the developer. |
| Minimisation, privacy by design | Art. 5(1)(c), 25 | Opt-in; a schema that refuses any unknown field on the device and on the collector; no IP, header or user-agent stored; the ID is random and replaceable. |
| Retention limit | Art. 5(1)(e) | Switching off deletes at once; an install silent for 400 days is deleted (`RETENTION_DAYS`). |
| Processor, transfers | Art. 28, 44–46 | Cloudflare hosts the collector as a processor. **Owner action: see below.** |
| Children | Art. 8 and national ages (13–16); India's DPDP Act sets 18 | EyeTime is not directed at children; the notice says to say no and ask a parent. EyeTime cannot check age. **Owner decision: see below.** |

### What the card does and refuses

Does (all honest persuasion): asks at a good moment (right after a finished session, never during work); says in plain words who asks and why, and that after a yes EyeTime sends the numbers **on its own**, once a week, with nothing to confirm; is short; shows the exact report; links the full notice; offers **"Maybe later"**, which says in the card that it will be asked again; asks **up to three times**, at least three weeks apart, each time with **other words** (the first in one of two voices, an experiment); keeps a plain **"Don't ask again"** link on the first two asks; the third ask says it is the last and offers **"No, thanks"**, which is final; keeps "Yes" as the filled, wider button.

Refuses: pre-ticked or default consent; confirm-shaming ("No, I don't care about quality"); false scarcity or deadlines; countdowns; fake or "most people" social proof; hiding, fading or disguising the refusal; making refusal take more clicks than consent; **a refusal that is secretly not a refusal** (a "No, thanks" that is asked about again: the EDPB lists such "continuous prompting", asking again until the person gives in, as a dark pattern); more than three asks, or asks closer than three weeks; any ask after "Don't ask again" or the final "No, thanks"; gating a feature behind a yes; changing the meaning of a button between asks. The regression tests (`scripts-dev/tests/usage-ask.test.mjs`, `scripts-dev/e2e/usage.cjs`) check what can be checked mechanically.

**Why the re-asks are defensible here.** Each one follows a button that says "Maybe later" and, in the card, that the question will come back; there are at most three, with weeks between them and different words; a visible "Don't ask again" is always there on the first two and the last has a final "No". That is a deferral the person chose and was told about, not a refusal that is ignored. It is still the part of this design that a strict authority is most likely to question (repeated requests); if a lawyer advises one ask only, set `ASK_TIMING.maxDeferrals` to 0 (`src/shared/usage.js`) and `MAX_DEFERRALS` to 0 (`desktop/core/src/telemetry.rs`).

The size difference between the "Yes" and the two refusal buttons (the yes is full width and filled; the refusals are half width and outlined) is a **look hierarchy**, the usual primary / secondary pattern. Some data protection authorities (for example the French CNIL for cookie banners) are strict that a refusal must be *as easy* as an acceptance; it is, in clicks, place and height, but a stricter reading of "equal prominence" would ask for equal buttons. If a lawyer advises that, set `.ask-yes` and `.ask-refuse .btn` to the same style: it costs a few points of conversion, not the product.

## Messages to the maker (feedback)

| Rule | Source | What EyeTime does |
|---|---|---|
| A message is something the person **chose to send**; no hidden collection | GDPR Art. 5(1)(a), 6(1)(b)/(f) | Sent by an explicit click; the form says where it goes and asks not to write anything personal (Art. 13 point-of-collection text, `fb.privacy`). Notice in `PRIVACY.md`, "Messages to the maker". |
| **Free text can hold anything**, including special categories | Art. 9 | The form says not to; the dashboard shows text as text only; nothing is used except to read, answer and improve EyeTime. The owner can delete any message (`DELETE /v1/feedback/:id`). |
| **Retention without a date** (the owner chose "keep until deleted") | Art. 5(1)(e) | A defensible basis exists only with safeguards: the person can delete their own message with a ticket (`/v1/feedback/forget`), deletion on request is promised in the notice, the reply address is erased when answered or after 90 days, the owner's answers are erased 14 days after delivery. **Owner action:** review the pile once a year and delete what is no longer useful; the notice says the messages are kept until deleted, never "forever". |
| A **new pseudonymous identifier** (the ticket) | Art. 4(1), 13 | Disclosed in the notice and on the form (`fb.replyHint`). It is random, per message, **never ticked for the person**, never combined with the usage ID, and only its hash is stored. Polling stores no caller identity (no IP, no log). |
| ePrivacy Art. 5(3): access to terminal equipment | Directive 2002/58/EC | The ticket and the outbox are the app's own storage, written because the person asked for an answer and read only to deliver it. Polling happens only while such a message exists. |
| **No consent gating**: questions must not cost the person anything | EDPB 03/2022 (dark patterns) | One-tap; "Not now" and *Don't ask for ratings* are real buttons in plain sight; 60-day quiet; at most one question in 30 days; none during a session. The store-review link (if added) is shown to everyone regardless of the rating (no review gating; FTC Consumer Reviews rule 2024). |
| **Children** | Art. 8 | The questions carry no usage ID and no free text is required; the notice says not to write personal details. |
| **Replies** | Art. 5(1)(c) | The answer text is written by the owner, at most three per message, 1000 characters; the person never sees other people's messages or the owner's notes. |

## Other places

| Law | What matters here | Status |
|---|---|---|
| **UK GDPR / PECR** | Same as the EU; ICO's guidance on dark patterns and on equal prominence | Same design. |
| **Switzerland nFADP** | Transparency, consent where needed, transfers | Same notice and design. |
| **California (CCPA/CPRA)** | Notice at collection, no sale or sharing, rights, no discrimination for saying no | Notice has a California paragraph; nothing is sold or shared; no difference after a no. Applies only above the law's size thresholds; the notice is the safe course anyway. |
| **Brazil LGPD, Quebec Law 25, Australia, Japan, South Korea** | Consent that is clear, specific, in plain language, revocable | Met by the design. **South Korea** (PIPA) wants overseas transfers disclosed or consented to: the Settings text now says where the numbers are kept (`us.where`, eleven languages). |
| **India (DPDP Act and Rules)** | Itemised notice in plain language, withdrawal as easy as consent; a person under 18 needs a parent's consent and tracking of children's behaviour is barred | Notice and withdrawal are met. The age rule is **not enforceable by EyeTime**; see the owner decisions. |
| **China (PIPL)** | A **separate** consent for sending personal information abroad (Art. 39); the 2024 CAC rules relax the transfer *mechanisms* for small volumes but not this duty | The question is **not put to a Chinese-language interface** (`askPlan`); the Settings switch stays and says where the numbers are kept. **Owner decision.** |
| **Russia (152-FZ)** | Consent in its own document (since 1 Sept 2025, Federal Law 156-FZ); a duty to keep the *first* storage of Russian citizens' personal data in Russia | The card is a standalone consent, which meets the form. The storage rule matters **only if the ID counts as personal data under Russian law**, which is arguable for a random ID that nobody can link to a person, and not settled. **Owner decision.** |
| **Chrome Web Store** | Prominent disclosure and consent for data not essential to the single purpose; the Limited Use statement; the rules for extensions were tightened in 2026 | The disclosure, the consent, the privacy notice and the Limited Use statement are in place. **I could not read the current policy text from this environment** (the host was not reachable), so the exact wording of what is allowed for *product analytics*, as against *reliability measurement*, must be checked by the owner before the collector's address is put into a release. The first public release ships with no address, so it collects nothing. |

## What only the owner can do

1. **Decide the controller's identity in the notice.** It names the developer by GitHub handle and the contact in `SECURITY.md`. If you want a company, a postal address or a dedicated privacy e-mail in the notice, put it in `PRIVACY.md` (section "Anonymous usage: who is responsible…").
2. **Cloudflare**: accept its data processing terms for the account (they are part of its customer agreement; check the current version), and consider creating the D1 database with an EU location hint (`wrangler d1 create … --location weur`) if most users are in Europe. Confirm that the provider's transfers rely on its standard contractual clauses and, where it applies, the Data Privacy Framework (the notice says so).
3. **An EU representative (GDPR Art. 27)**: if you are outside the EU and your users are inside it, a representative may be required unless the processing is occasional and unlikely to risk people's rights; ask a lawyer.
4. **Children**: decide whether to ask only where the browser or system gives an age, or to accept that EyeTime cannot verify age and say so (as the notice does).
5. **China and Russia**: decide whether to keep the question off for those users (it is off for a Chinese-language interface) and whether the ID is personal data under Russian law.
6. **Chrome Web Store**: re-read the current *User Data* and *Limited Use* pages and reconcile *Privacy practices* in the listing (`store/SUBMISSION.md` has the text) with what you ship. If the store only allows measurement of performance and reliability, the extension can be limited to the error and speed counters by removing the rest of `FEATURES` from the report; the schema makes that a list change.
7. **Keep a record of processing** (GDPR Art. 30; small organisations are partly exempt, but a one-page record is easy): purposes, categories (the table above and `docs/TRACKING-PLAN.md`), recipients (Cloudflare), transfers, retention (400 days), security (the collector's design, `server/usage/README.md`).
8. **A data protection impact assessment (Art. 35)** is not likely to be needed (no special categories, no profiling that affects people, no large-scale monitoring of public places, minimal data), but write down in two sentences why.

## What changes the answer

- Any new field, purpose or recipient: raise `CONSENT_VERSION` (extension: `src/shared/usage.js`; app: `desktop/core/src/telemetry.rs`), update `PRIVACY.md` and `docs/TRACKING-PLAN.md`.
- Any change to the question's look: keep the checks in `usage-ask.test.mjs` green, and re-read "What the card refuses".
- A new market (a language, a store): add a row to the table above first.

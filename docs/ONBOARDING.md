# The first minutes: how EyeTime onboards a new person

This is the design record of the first run: what was looked at, what was decided and why, what was refused, and how it will be judged. The flow itself is in `src/onboarding/` (the three screens) and `src/newtab/home/first-session.js` (what happens on the new tab after them).

## What the person has just done, and what they can lose

They installed an extension in one click and can remove it in two. They have no account, nothing to lose, and no reason to be patient. The first screen is a promise, and everything after it is judged by one question: *how soon do they feel what EyeTime is for?* For EyeTime that is **a finished focus session in which a distracting site was held back, on a new tab that looks like theirs**. We call that the activation event. Everything that is not on the way to it waits.

## What was studied

| Source | What it says | What we take from it |
|---|---|---|
| Nielsen Norman Group, *Mobile app onboarding* / *Tutorials* (a test of 70 people and 4 apps) | Those who read the tutorials did **not** do better (91 % task success) than those who skipped them (94 %) and rated the apps harder to use (4.9 against 5.5 of 7). Instructional flows are "dramatically overused"; tips shown in context work better. | No feature tour, no slides of "what EyeTime can do". Teach by doing, with a note exactly where it is needed. |
| Opal, Forest, One Sec, Freedom, Cold Turkey (Mobbin and teardowns) | Opal asks 17–23 screens (hours on the phone, age, a "report" with a projected lifetime of phone use), then a permission and an account. Cold Turkey and BlockSite are a list and a schedule on one screen. No competitor says what a block *looks like* before it happens. | A long quiz is a mobile paywall funnel; it needs a number to "reveal" and ours would be invented. We do not copy it. A blocker's first fear is "will it lock me out?", and nobody answers it: we show it. |
| Evernote, Superlist, Tana, Manus (Mobbin, 12–20 screens) | Set-up checklists with a "Skip" on every step, a pre-filled "Getting started" list, an account first. | Skip everywhere is right. Our checklist already exists on the new tab and stays. No account: we skip that whole half. |
| Duolingo (delayed sign-up test; secondary reports of +20 % and later +8 % daily users) | Let people **do** the thing before asking them for anything. | We ask for nothing, so the first action can be the product itself. |
| Endowed progress (Nunes and Drèze, 2006) | A card with two of ten stamps already filled is finished more often than an empty eight-stamp card. | The first screen is not "step 1 of 3" but already part-way (the page is installed, the language is chosen). The progress shows what is *done*, not what is left. |
| BJ Fogg, Behavior Model B = MAP | A behaviour needs motivation, **ability** and a prompt. The first win must be tiny and followed by a celebration. | The first session is **5 minutes** (the length they can say yes to), started with one tap, ended with a real celebration, not a "well done" toast. |
| Implementation intentions (Gollwitzer and Sheeran, 2006: d = 0.65 over 94 tests; a 2024 re-analysis with bias correction finds a smaller but real effect, d ≈ 0.15–0.35) | "I will do X when Y" helps, modestly. | One line: *What will you work on?* It is also the label of the session in Insights. Nothing more is asked. |
| Chrome Web Store rules for new-tab pages | An extension that replaces the new tab must say so and make it easy to go back; Chrome shows its own "Keep it" prompt. | The first screen says in one line that EyeTime is the new tab and where the way back is. Trust costs one sentence. |
| Hick's law and the practitioner reports on onboarding length | Fewer decisions per step; defer what a person cannot judge yet. No credible per-question drop-off figure exists, so none is quoted. | Three screens, one decision each. Settings that a person cannot judge on the first minute (daily goal, work hours, eye breaks, look) move to after the first session, where they can see what they are choosing. |

What these sources do not give is a number for "the best onboarding". That is why the plan below ends with a way to *measure* it and a way to go back.

## The candidates

Each was drawn and walked through by hand before one was chosen. Scores are 1–5 (5 best), weighted by what matters most for a free extension with no account.

| | A. Trim the wizard (3 steps, as before) | B. Quiz and "report" (Opal-style) | C. No onboarding, hints only | D. **Do first**: three light screens, then a real first session, then set-up in place | E. D plus an interactive demo in the page |
|---|---|---|---|---|---|
| Time to the first felt value (×3) | 2: the first session is still on its own | 1: 17+ screens | 3: depends on the person | **5**: about a minute, then the product | 4: slower, the demo is not the product |
| Likely activation (×3) | 3 | 2 (they leave before it, or are pushed to an account) | 2: an empty block list blocks nothing, no "aha" | **5**: the first session blocks what *they* named | 4 |
| Trust, privacy, law (×2) | 4 | 2: invented projections are manipulation (EDPB dark patterns: stirring) | 4 | **5**: nothing asked that is not used, new-tab note, no account | 5 |
| Few decisions up front (×2) | 3: six toggles before any value | 1 | 5 | **4**: three choices, each one easy | 3 |
| Delight (×1) | 3 | 3 | 2 | **5**: a live pause preview, a first session, a celebration, a look chosen on the real page | 4 |
| Cost and risk to build (×1) | 5 | 2 | 5 | 3 | 1 |
| **Weighted total (of 60)** | 37 | 20 | 40 | **56** | 45 |

- **A** keeps telling instead of doing and keeps six decisions in front of the value.
- **B** is refused for a reason that is not about conversion: the "reveal" would be a number we cannot know, shown to make the person feel bad. EyeTime does not do that.
- **C** is NN/g-pure but has a hole specific to this product: until a person names a distraction, a focus session blocks nothing, and a session that blocks nothing is not EyeTime. Pre-selecting sites for them is worse: a surprise block in the first minute is the "too strict" reason for removal.
- **E** adds a simulated browser to the page. It teaches what D teaches with a *real* first session, and costs a week.

## The flow

```
Install → [1 Hello] → [2 What pulls you away?] → [3 Your first focus] → new tab, session running
                                                         ↓ (5 minutes later)
                          [4 First focus done · make it yours]  → the "Get started" checklist (as before)
```

1. **Hello.** The tagline, one sentence, four small marks (focus in one click, eye care, honest numbers, private), and two lines of fine print: *About a minute, three quick steps, no account* and *EyeTime is your new tab; you can switch back in Settings at any time.* One button. Language is top right. "Skip setup" is always visible.
2. **What pulls your attention away?** Kinds of sites as chips (nothing is pre-selected: choosing is the point) and a field for one's own. As soon as one is chosen, a **live preview of the pause** appears below it, built from the real strings of the real pause page: *This is what you'll see on reddit.com: a breath, and the choice stays yours. During focus the site is simply closed.* Nobody else shows this, and it answers the fear that causes "too strict" removals. "I'll choose later" is a real link, not a hidden one.
3. **Your first focus.** *What will you work on?* with a text field and three suggestions (Write, Read, Plan my day), and **5 · 10 · 25 minutes** (5 selected). A single big button starts it. (Skipping the whole flow at the first screen keeps the starting set of sites, which only produce the calm pause outside focus; leaving the second screen with nothing chosen means nothing is blocked.) A quieter button says *Look around first*. The pin-the-icon hint sits under them, once. Everything the old "rhythm" and "look" screens asked is applied with sensible defaults (pause before distracting sites: on; eye breaks every 20 minutes: on; work hours: off; daily goal 2 h; Calm look).
4. **On the new tab, during the session.** A small card says what is held back (*Paused until the timer ends: 3*), and offers *See what a blocked site looks like* (opens one of the chosen sites). It closes itself when the session ends.
5. **First focus done.** One card on the new tab, once: *First focus done: 5 minutes without distractions*, with the real number of times a site was held back, and then the choices that are better made now than before: **look and theme** (applied live, on the page behind the card), **daily goal**, **eye breaks**, **work hours**. The checklist ("Get started") takes it from there.

## What was refused, on purpose

- A feature tour or slides (NN/g).
- A quiz that ends in an invented number, a "loading your report" bar, a countdown, a fake testimonial, a "join 4,000,000" counter.
- An account, an email, a permission, a notification request. The first run asks for none.
- Pre-selected distractions, pre-ticked options of any kind.
- A mandatory path: every screen can be skipped and every skipped thing is in Settings.
- Anything that sends a message anywhere: onboarding itself is silent. The only counter is the one that already existed (`onboarding_done`), plus the normal ones.

## How it will be judged, and how to go back

- **Activation** (dashboard, *Activation* page): the share of new installs that **start a session on day 1** and the share that **finish one in week 1**; the median days to the first session. Compare the release that carries this flow with the one before it on the *Releases* table of the dashboard (one row per version). The flow is judged good if day-1 session start and week-1 finished session each rise, and not by completion of the screens (a high completion with weak retention is the failure mode all the sources warn about).
- **Removal reasons** (*Why people leave*): "too strict or too pushy" must not rise.
- **Guard rails** (do not ship a release that breaks them): step 2 and 3 work with the keyboard only; every screen passes axe; no console error; the language of the page follows the browser; the flow works in all eleven languages and in both themes.
- **Going back:** the old five-screen flow is in the git history of `src/onboarding/` (the commit before "The first minutes"). Restoring it is one commit.
- **What would change the answer:** a measured drop in day-1 session start against the previous version; reasons for removal citing the first minute; a store-policy change about new-tab pages.

## Sources

- Nielsen Norman Group, [Mobile-app onboarding](https://www.nngroup.com/articles/mobile-app-onboarding/) and [Tutorials](https://www.nngroup.com/articles/mobile-tutorials/)
- Mobbin: Opal (iOS, 17 and 23 screens), Evernote, Superlist, Tana, Manus onboarding flows; teardowns of Opal on ScreensDesign
- Nunes and Drèze, *The Endowed Progress Effect*, Journal of Consumer Research 32(4), 2006
- B. J. Fogg, *Tiny Habits*; the Fogg Behavior Model
- Gollwitzer and Sheeran, 2006; Sheeran, Listrom and Gollwitzer, 2024 (effect sizes as reported by secondary sources; the originals should be checked before any figure is quoted outside this file)
- Duolingo delayed sign-up, as reported by Taplytics and First Round Review (secondary)
- Chromium extensions discussions and Chrome Web Store single-purpose guidance on new-tab pages

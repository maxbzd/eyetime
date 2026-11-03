# The session (25 minutes, two people: the moderator talks, the note-taker writes)

Before: a clean profile with the build (`node scripts-dev/research/session.cjs --id P07 --lang en --record`), the screen shared or in front of the person, the consent read, the recording started.
The moderator says only what is in **bold**. Everything in *italics* is for the moderator. Never describe the product, never name a feature before the person does.

## 0. Welcome (2 min)

**"Thanks for doing this. I'm testing the software, not you; nothing you do is wrong. Please say out loud what you're thinking, even small things like 'I don't know what this is'. I can't answer most questions during the session, because I want to see what happens when I'm not here, but I'll answer everything at the end."**
*Consent confirmed on the recording. Ask the two background questions: what they do all day on the screen, how they stay focused today. Write the words.*

## 1. First look (3 min)

*The browser has just opened a new tab. EyeTime is installed. Say nothing for the first 10 seconds. Start the timer.*

**"This is a new tab in your browser after you installed a new extension. Take a moment and tell me what you see, and what you think it's for."**

*Record: seconds until they say what it is (`first_look_understood_s`); their first words (`first_look_words`). Do not correct a wrong guess.*

## 2. Task A — start working (4 min)

**"Imagine you have an hour of work ahead of you and you want this to help you concentrate on one thing. Show me what you would do."**

*Success = a focus session started. Record `first_session_started` (yes/no), whether without a hint (`first_session_unaided`), the seconds (`first_session_time_s`). If nothing happens for 90 seconds, give hint level 1: **"What do you think the line under the clock is for?"** Level 2 (after 60 s more): **"There is a field where you can type what you are working on."** Write at which level you hinted (`hint_needed_at`: none / 1 / 2 / told).*
*When the session runs: **"What do you expect will happen when the time is up?"***

## 3. Task B — make it yours (5 min)

**"The picture and the way this looks are a starting point. Suppose you want it to look a bit different, to feel like yours. Show me what you would try."**

*Do not mention settings, themes, the drawer or the button. Record whether they found the wallpaper credit and the "another photo" button (`noticed_wallpaper_credit`, `tried_next_photo`), found the customize button (`opened_customize`), changed anything (`found_theme_change`), and whether they could go back to how it was (`changed_look_back_ok`: ask **"Now put it back the way it was"**).*

## 4. Task C — one thing in settings (3 min)

**"Somewhere you can change what this extension does on the whole. Please find where you would turn off the reminders for resting your eyes."**

*Record `opened_settings` and `settings_lost` (the number of times they said or showed they were lost, scrolled back and forth, opened the wrong place). It ends when they find it or give up at 2 minutes.*

## 5. The eye break (2 min)

*Trigger a break from the page (palette: "Eye break now") when they are not looking, or have set the interval to a minute beforehand.*
**"Something just appeared. What is it, and what would you do?"** → `eye_break_understood` (yes/no; "what it's for" in their words).

## 6. Questions at the end (5 min)

1. **"If you had to describe this to a friend in one sentence, what would you say?"** *(the words, exactly, into `quotes`, with any other sentence worth quoting)*
2. **"What was the best moment? And the most annoying one?"** → `delights`, `blockers`
3. **"Would you keep this installed? What would make you remove it?"** → `would_keep_installed` + the reason
4. **"Is there something you expected to find and didn't?"**
5. **The SUS questionnaire** (below), written down by the person (paper or form).

*Then answer their questions. Thank them. Stop the recording. Fill the sheet within an hour.*

### SUS (10 statements, 1 = strongly disagree … 5 = strongly agree)

1. I think that I would like to use this product frequently.
2. I found the product unnecessarily complex.
3. I thought the product was easy to use.
4. I think that I would need the support of a technical person to be able to use this product.
5. I found the various functions in this product were well integrated.
6. I thought there was too much inconsistency in this product.
7. I would imagine that most people would learn to use this product very quickly.
8. I found the product very cumbersome to use.
9. I felt very confident using the product.
10. I needed to learn a lot of things before I could get going with this product.

*Enter the ten answers as `sus_1` … `sus_10`; `summarize.mjs` computes the score.*

## After each session (the note-taker, 10 minutes)

- Fill the row of `observation-sheet.csv`. `blockers` = the number of times they could not go on without help; `confusions` = what, in their words.
- Write the three most surprising moments with the time on the recording.
- Do **not** talk about solutions yet. That is for `analysis.md`, after all the sessions.

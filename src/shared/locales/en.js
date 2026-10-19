// English — the reference language. Every key used in the code must exist here.
// {name} = parameter. Objects are plural forms (Intl.PluralRules categories) selected by params.n.
export const en = {
  /* units & common */
  'unit.h': 'h', 'unit.m': 'm', 'unit.s': 's',
  'common.confirm': 'Confirm', 'common.cancel': 'Cancel', 'common.save': 'Save', 'common.add': 'Add', 'common.remove': 'Remove',
  'common.error': 'Something went wrong', 'common.done': 'Done', 'common.back': 'Back', 'common.next': 'Next', 'common.skip': 'Skip', 'common.close': 'Close', 'common.on': 'On', 'common.off': 'Off',
  'class.productive': 'Productive', 'class.neutral': 'Neutral', 'class.distracting': 'Distracting',
  'badge.defaultTitle': 'EyeTime', 'badge.todayTitle': 'EyeTime — {time} today', 'badge.focusTitle': 'Focus — {n} min left',

  /* popup */
  'popup.insights': 'Insights', 'popup.settings': 'Settings',
  'focus.title': 'Focus', 'focus.tagline': 'Block distractions for a while',
  'focus.goalPlaceholder': 'What will you work on? (optional)',
  'focus.minutesShort': '{n}m', 'focus.custom': 'Custom',
  'focus.start': 'Start focus · {time}',
  'focus.strict': 'Strict mode', 'focus.strictHint': 'No bypass and no early exit until the timer ends.',
  'focus.running': 'Focusing', 'focus.endsAt': 'ends at {time}', 'focus.end': 'End session', 'focus.keepGoing': 'Keep going',
  'focus.strictLocked': 'Strict session — no early exit',
  'focus.endConfirmTitle': 'End this session early?', 'focus.endConfirmBody': 'Focus time still counts if you worked for more than 2 minutes.',
  'focus.doneTitle': 'Focus session complete', 'focus.doneBody': 'You focused for {n} minutes. Nicely done.', 'focus.doneBodyGoal': '{n} minutes on “{goal}”. Nicely done.', 'focus.again': 'Another session',

  'site.today': '{time} today', 'site.justStarted': 'Just started', 'site.classLabel': 'Mark this site as',
  'site.alwaysBlock': 'Always block', 'site.unblock': 'Unblock',

  'today.title': 'Today', 'today.emptyTitle': 'Nothing tracked yet', 'today.emptyBody': 'Browse as usual — your time shows up here within a minute.',
  'today.sameAsYesterday': 'About the same as yesterday', 'today.moreThanYesterday': '{time} more than yesterday', 'today.lessThanYesterday': '{time} less than yesterday',
  'today.splitLabel': 'Time split by productive, neutral and distracting sites',

  'eye.due': 'Time for an eye break', 'eye.nextIn': 'Eye break in {time}', 'eye.breakNow': 'Take a break',
  'eye.notifTitle': 'Time to rest your eyes', 'eye.notifBody': '{n} minutes of screen time. Look at something 6 m (20 ft) away for {s} seconds.',
  'eye.startBreak': 'Start break', 'eye.snooze': 'Snooze 5 min',
  'eye.bedtimeTitle': 'Wind down', 'eye.bedtimeBody': 'Bedtime is at {time} — about {n} minutes left. Time to wrap up and rest your eyes.',

  'capture.placeholder': 'Capture a thought… ⏎', 'capture.saved': 'Saved to Notes',
  'track.pause': 'Pause tracking', 'track.resume': 'Resume tracking', 'track.pausedUntil': 'Paused until {time}',

  'weekly.title': 'Your week in review', 'weekly.total': 'Screen time: {time}', 'weekly.distracting': 'Distractions: {time}',
  'weekly.focus': { one: '{n} focus session · {time}', other: '{n} focus sessions · {time}' }, 'weekly.top': 'Most time on: {sites}',

  /* block page */
  'block.pageTitle': 'Paused — EyeTime', 'block.back': 'Back to work', 'block.continue': 'Continue to site',
  'block.continueIn': 'Continue in {n}s', 'block.continueFor': 'Continue for {n} min', 'block.passNote': 'You’ll get {n} minutes, then this pause returns.',
  'block.pause.title': 'Take a breath.', 'block.pause.lead': 'Do you really need {host} right now?',
  'block.breatheIn': 'Breathe in', 'block.breatheOut': 'Breathe out',
  'block.focus.title': 'You’re in a focus session.', 'block.focus.lead': '{host} is paused until it ends.',
  'block.strictNote': 'Strict mode is on — this site opens again at {time}.', 'block.strictScheduleNote': 'Strict work hours are on — there is no bypass right now.',
  'block.schedule.title': 'It’s work time.', 'block.schedule.lead': 'Distracting sites are paused until {end}.',
  'block.limit.title': 'Daily limit reached', 'block.limit.lead': 'You’ve spent {used} on {host} today. Your limit is {limit}.',
  'block.always.title': '{host} is blocked', 'block.always.lead': 'You chose to block this site.', 'block.manage': 'Manage blocked sites', 'block.invalid': 'Nothing to show here.',

  /* shell & nav */
  'nav.home': 'Home', 'nav.insights': 'Insights', 'nav.settings': 'Settings', 'common.undo': 'Undo',
  'range.today': 'Today', 'range.7': '7 days', 'range.30': '30 days',
  'chart.total': 'Total', 'chart.noData': 'No data',

  /* insights */
  'insights.range': 'Time range', 'insights.export': 'Export CSV',
  'insights.screenTime': 'Screen time', 'insights.focusTime': 'Focus time', 'insights.distractionShare': 'Distraction share', 'insights.eyeBreaks': 'Eye breaks',
  'insights.vsYesterday': 'vs yesterday', 'insights.vsPrev': 'vs previous {n} days', 'insights.noComparison': 'No earlier data to compare',
  'insights.sessions': { one: '{n} session', other: '{n} sessions' }, 'insights.pts': ' pts', 'insights.perDay': '{n} per day',
  'insights.byHour': 'Time by hour', 'insights.byHourSub': 'Where today’s minutes went, split by site type',
  'insights.byDay': 'Time per day', 'insights.byDaySub': 'Productive, neutral and distracting time',
  'insights.date': 'Date', 'insights.tableView': 'Show as table',
  'insights.sites': 'Sites', 'insights.sitesSub': 'Change a site’s type to teach EyeTime what counts as a distraction', 'insights.site': 'Site', 'insights.class': 'Type', 'insights.time': 'Time',
  'insights.classifyAria': 'Type of {host}', 'insights.marked': '{host} is now {cls}', 'insights.noSites': 'No sites in this period.',
  'insights.showMore': 'Show {n} more',
  'insights.highlights': 'Highlights', 'insights.highlightsSub': 'Patterns found in your data — computed on this device',
  'insights.needMoreData': 'Highlights appear after a few days of use.',
  'insights.typicalDay': 'A typical day', 'insights.typicalDaySub': 'Average time per hour on days you were online', 'insights.typicalAt': 'Typical at {time}',
  'insights.calendar': 'Calendar', 'insights.calendarSub': 'Screen time per day, last 16 weeks', 'insights.less': 'Less', 'insights.more': 'More',
  'insights.apps': 'Desktop apps', 'insights.appsSub': 'From the optional desktop companion',
  'insights.emptyTitle': 'Your stats will appear here', 'insights.emptyBody': 'EyeTime has just started counting. Everything stays on this device.',
  'insights.step1': 'Browse as usual', 'insights.step1b': 'Time per site is recorded automatically — only the domain, never the page.',
  'insights.step2': 'Mark what distracts you', 'insights.step2b': 'Open the popup on any site and set its type in one tap.',
  'insights.step3': 'Start a focus session', 'insights.step3b': 'Block distractions for 25 minutes and see how it changes your day.',
  'insight.worstDay': 'Your most distracting day was {weekday}: {time} on distracting sites.',
  'insight.bestDay': '{weekday} was your most balanced day — only {pct}% distracting.',
  'insight.peakHour': 'You do most of your productive browsing around {time}.',
  'insight.lateNight': 'You spent {time} online late at night (23:00–05:00). Sleep is part of focus.',
  'insight.distractionShare': '{pct}% of your time went to distracting sites.',
  'insight.moreThanBefore': 'That’s {pct}% more than before.', 'insight.lessThanBefore': 'That’s {pct}% less than before.',
  'insight.topDistraction': '{host} took the most distracting time: {time}.',
  'insight.focusTotal': { one: '{n} focus session — {time} of deep work.', other: '{n} focus sessions — {time} of deep work.' },
  'insight.streak': { one: '{n}-day focus streak.', other: '{n}-day focus streak. Keep it going!' },
};

// Built-in site knowledge: blocking presets and a short list of sites that are usually work.
// Presets are *suggestions the user switches on*; nothing here blocks anything by itself.

export const PRESETS = {
  social: {
    icon: 'message-circle',
    domains: ['facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'vk.com', 'vk.ru', 'ok.ru', 'tiktok.com', 'snapchat.com', 'pinterest.com', 'threads.net', 'threads.com', 'bsky.app', 'mastodon.social', 'weibo.com'],
  },
  video: {
    icon: 'play',
    domains: ['youtube.com', 'youtu.be', 'twitch.tv', 'netflix.com', 'rutube.ru', 'kinopoisk.ru', 'vkvideo.ru', 'vimeo.com', 'dailymotion.com', 'disneyplus.com', 'hbomax.com', 'max.com', 'primevideo.com', 'bilibili.com'],
  },
  forums: {
    icon: 'messages-square',
    domains: ['reddit.com', 'pikabu.ru', '9gag.com', 'quora.com', 'tumblr.com', 'imgur.com', '4chan.org', 'dtf.ru'],
  },
  news: {
    icon: 'newspaper',
    domains: ['news.ycombinator.com', 'cnn.com', 'bbc.com', 'bbc.co.uk', 'nytimes.com', 'theguardian.com', 'foxnews.com', 'buzzfeed.com', 'lenta.ru', 'rbc.ru', 'meduza.io', 'ria.ru', 'kommersant.ru', 'dzen.ru'],
  },
  games: {
    icon: 'gamepad-2',
    domains: ['store.steampowered.com', 'steamcommunity.com', 'epicgames.com', 'roblox.com', 'chess.com', 'lichess.org', 'itch.io', 'miniclip.com', 'poki.com', 'crazygames.com', 'twitch.tv'],
  },
  shopping: {
    icon: 'shopping-bag',
    domains: ['amazon.com', 'ebay.com', 'aliexpress.com', 'wildberries.ru', 'ozon.ru', 'etsy.com', 'temu.com', 'shein.com', 'avito.ru', 'olx.com'],
  },
  messengers: {
    icon: 'send',
    domains: ['web.telegram.org', 'web.whatsapp.com', 'discord.com', 'messenger.com', 'web.max.ru'],
  },
};

export const PRESET_IDS = Object.keys(PRESETS);

/** Presets that are on for a brand-new profile. Kept short on purpose; onboarding asks. */
export const DEFAULT_PRESETS_ON = ['social', 'video', 'forums'];

/** Sites that are usually "work". The user can override any of them from the UI. */
export const PRODUCTIVE_DEFAULTS = [
  'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com', 'developer.mozilla.org', 'npmjs.com', 'pypi.org', 'docs.python.org',
  'docs.google.com', 'drive.google.com', 'sheets.google.com', 'slides.google.com', 'calendar.google.com', 'meet.google.com', 'mail.google.com', 'outlook.office.com', 'office.com',
  'notion.so', 'linear.app', 'figma.com', 'miro.com', 'trello.com', 'asana.com', 'atlassian.net', 'jira.com', 'confluence.com', 'slack.com', 'zoom.us', 'teams.microsoft.com',
  'claude.ai', 'chatgpt.com', 'openai.com', 'anthropic.com', 'perplexity.ai', 'gemini.google.com',
  'vercel.com', 'netlify.com', 'cloudflare.com', 'console.aws.amazon.com', 'aws.amazon.com', 'cloud.google.com', 'portal.azure.com', 'supabase.com', 'firebase.google.com',
  'coursera.org', 'edx.org', 'khanacademy.org', 'udemy.com', 'stepik.org', 'overleaf.com', 'arxiv.org', 'scholar.google.com', 'wikipedia.org', 'habr.com',
  'localhost', '127.0.0.1',
];

export const CLASSES = ['productive', 'neutral', 'distracting'];

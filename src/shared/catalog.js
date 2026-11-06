// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Built-in site knowledge: blocking presets and a short list of sites that are usually work.
// Presets are *suggestions the user switches on*; nothing here blocks anything by itself.

export const PRESETS = {
  social: {
    icon: 'message-circle',
    domains: ['instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'vk.ru', 'vk.com', 'ok.ru', 'tiktok.com', 'pinterest.com', 'snapchat.com', 'threads.com', 'threads.net', 'bsky.app', 'mastodon.social', 'weibo.com'],
  },
  video: {
    icon: 'play',
    domains: ['youtu.be', 'youtube.com', 'netflix.com', 'twitch.tv', 'kinopoisk.ru', 'rutube.ru', 'vkvideo.ru', 'vimeo.com', 'dailymotion.com', 'disneyplus.com', 'max.com', 'hbomax.com', 'bilibili.com', 'primevideo.com'],
  },
  forums: {
    icon: 'messages-square',
    domains: ['reddit.com', 'pikabu.ru', '9gag.com', 'quora.com', 'imgur.com', 'tumblr.com', 'dtf.ru', '4chan.org'],
  },
  news: {
    icon: 'newspaper',
    domains: ['cnn.com', 'news.ycombinator.com', 'bbc.co.uk', 'bbc.com', 'theguardian.com', 'nytimes.com', 'foxnews.com', 'buzzfeed.com', 'rbc.ru', 'lenta.ru', 'ria.ru', 'meduza.io', 'kommersant.ru', 'dzen.ru'],
  },
  games: {
    icon: 'gamepad-2',
    domains: ['steamcommunity.com', 'store.steampowered.com', 'epicgames.com', 'roblox.com', 'lichess.org', 'chess.com', 'itch.io', 'miniclip.com', 'crazygames.com', 'poki.com', 'twitch.tv'],
  },
  shopping: {
    icon: 'shopping-bag',
    domains: ['ebay.com', 'amazon.com', 'aliexpress.com', 'wildberries.ru', 'ozon.ru', 'etsy.com', 'temu.com', 'shein.com', 'avito.ru', 'olx.com'],
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
  'gitlab.com', 'portal-4rhdy2.invalid', 'github.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com', 'docs-464b53.invalid', 'developer.mozilla.org', 'npmjs.com', 'pypi.org', 'docs.python.org',
  'drive.google.com', 'docs.google.com', 'sheets.google.com', 'hub-ct7kxm.invalid', 'slides.google.com', 'meet.google.com', 'calendar.google.com', 'outlook.office.com', 'mail.google.com', 'office.com',
  'notion.so', 'linear.app', 'miro.com', 'figma.com', 'trello.com', 'asana.com', 'jira.com', 'atlassian.net', 'confluence.com', 'slack.com', 'teams.microsoft.com', 'zoom.us',
  'claude.ai', 'chatgpt.com', 'anthropic.com', 'openai.com', 'gemini.google.com', 'perplexity.ai',
  'vercel.com', 'netlify.com', 'console.aws.amazon.com', 'cloudflare.com', 'cloud.google.com', 'aws.amazon.com', 'supabase.com', 'portal.azure.com', 'firebase.google.com',
  'coursera.org', 'edx.org', 'khanacademy.org', 'udemy.com', 'stepik.org', 'overleaf.com', 'scholar.google.com', 'arxiv.org', 'wikipedia.org', 'habr.com',
  '127.0.0.1', 'localhost',
];

export const CLASSES = ['productive', 'neutral', 'distracting'];

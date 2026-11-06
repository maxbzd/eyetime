// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The services EyeTime can connect to. Each entry describes itself (for Settings) and builds the provider the runner talks to (see run.js).
//
//   id, label            what it is called
//   kinds                'tasks' (a task list) and/or 'events' (a calendar: busy times in, planned focus blocks out)
//   fields               what the person has to give: [{ key, label, secret, help }]; `secret` fields are kept in connSecrets, the rest in the connection
//   origins(conn)        the sites the browser is asked to allow (optional host permissions), nothing else is ever contacted
//   build(conn, secrets, env)  → { tasks?: {...}, events?: {...} }   env = { fetchImpl, sleep, now }
//   discover(conn, secrets, env)  → what to choose from after signing in (task lists, calendars, databases), when the service has several

import { todoist } from './todoist.js';
import { notion } from './notion.js';
import { caldav } from './caldav.js';
import { google } from './google.js';
import { microsoft } from './microsoft.js';

/** @type {Record<string, any>} */
export const PROVIDERS = { todoist, notion, google, microsoft, caldav };
export const providerList = () => Object.values(PROVIDERS);

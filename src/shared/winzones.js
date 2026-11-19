// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The names Windows gives its time zones ("Russian Standard Time"), as the calendars of Outlook and Exchange write them in an event, and the zone each one means
// (the Unicode CLDR table "windowsZones", one zone for every name). A name that is not here is read as local time, as before.

const PAIRS = [
  'Dateline Standard Time=Etc/GMT+12', 'UTC-11=Etc/GMT+11', 'Hawaiian Standard Time=Pacific/Honolulu', 'Alaskan Standard Time=America/Anchorage',
  'Pacific Standard Time=America/Los_Angeles', 'Pacific Standard Time (Mexico)=America/Tijuana', 'US Mountain Standard Time=America/Phoenix', 'Mountain Standard Time=America/Denver',
  'Mountain Standard Time (Mexico)=America/Mazatlan', 'Central America Standard Time=America/Guatemala', 'Central Standard Time=America/Chicago',
  'Central Standard Time (Mexico)=America/Mexico_City', 'Canada Central Standard Time=America/Regina', 'SA Pacific Standard Time=America/Bogota',
  'Eastern Standard Time=America/New_York', 'Eastern Standard Time (Mexico)=America/Cancun', 'US Eastern Standard Time=America/Indiana/Indianapolis',
  'Atlantic Standard Time=America/Halifax', 'Venezuela Standard Time=America/Caracas', 'SA Western Standard Time=America/La_Paz', 'Central Brazilian Standard Time=America/Cuiaba',
  'Pacific SA Standard Time=America/Santiago', 'Newfoundland Standard Time=America/St_Johns', 'E. South America Standard Time=America/Sao_Paulo',
  'Argentina Standard Time=America/Argentina/Buenos_Aires', 'SA Eastern Standard Time=America/Cayenne', 'Greenland Standard Time=America/Nuuk', 'Montevideo Standard Time=America/Montevideo',
  'Paraguay Standard Time=America/Asuncion', 'Bahia Standard Time=America/Bahia', 'Magallanes Standard Time=America/Punta_Arenas', 'Cuba Standard Time=America/Havana',
  'Haiti Standard Time=America/Port-au-Prince', 'Turks And Caicos Standard Time=America/Grand_Turk', 'UTC-02=Etc/GMT+2', 'Mid-Atlantic Standard Time=Etc/GMT+2',
  'Azores Standard Time=Atlantic/Azores', 'Cape Verde Standard Time=Atlantic/Cape_Verde', 'UTC=Etc/UTC', 'GMT Standard Time=Europe/London',
  'Greenwich Standard Time=Atlantic/Reykjavik', 'Morocco Standard Time=Africa/Casablanca', 'W. Europe Standard Time=Europe/Berlin', 'Central Europe Standard Time=Europe/Budapest',
  'Romance Standard Time=Europe/Paris', 'Central European Standard Time=Europe/Warsaw', 'W. Central Africa Standard Time=Africa/Lagos', 'Namibia Standard Time=Africa/Windhoek',
  'Jordan Standard Time=Asia/Amman', 'GTB Standard Time=Europe/Bucharest', 'Middle East Standard Time=Asia/Beirut', 'Egypt Standard Time=Africa/Cairo',
  'E. Europe Standard Time=Europe/Chisinau', 'Syria Standard Time=Asia/Damascus', 'West Bank Standard Time=Asia/Hebron', 'South Africa Standard Time=Africa/Johannesburg',
  'FLE Standard Time=Europe/Kiev', 'Israel Standard Time=Asia/Jerusalem', 'Kaliningrad Standard Time=Europe/Kaliningrad', 'Sudan Standard Time=Africa/Khartoum',
  'Libya Standard Time=Africa/Tripoli', 'Arabic Standard Time=Asia/Baghdad', 'Turkey Standard Time=Europe/Istanbul', 'Arab Standard Time=Asia/Riyadh',
  'Belarus Standard Time=Europe/Minsk', 'Russian Standard Time=Europe/Moscow', 'E. Africa Standard Time=Africa/Nairobi', 'Iran Standard Time=Asia/Tehran',
  'Arabian Standard Time=Asia/Dubai', 'Astrakhan Standard Time=Europe/Astrakhan', 'Azerbaijan Standard Time=Asia/Baku', 'Russia Time Zone 3=Europe/Samara',
  'Mauritius Standard Time=Indian/Mauritius', 'Saratov Standard Time=Europe/Saratov', 'Volgograd Standard Time=Europe/Volgograd', 'Georgian Standard Time=Asia/Tbilisi',
  'Caucasus Standard Time=Asia/Yerevan', 'Afghanistan Standard Time=Asia/Kabul', 'West Asia Standard Time=Asia/Tashkent', 'Ekaterinburg Standard Time=Asia/Yekaterinburg',
  'Pakistan Standard Time=Asia/Karachi', 'India Standard Time=Asia/Kolkata', 'Sri Lanka Standard Time=Asia/Colombo', 'Nepal Standard Time=Asia/Kathmandu',
  'Central Asia Standard Time=Asia/Almaty', 'Bangladesh Standard Time=Asia/Dhaka', 'Omsk Standard Time=Asia/Omsk', 'Myanmar Standard Time=Asia/Yangon',
  'SE Asia Standard Time=Asia/Bangkok', 'Altai Standard Time=Asia/Barnaul', 'W. Mongolia Standard Time=Asia/Hovd', 'North Asia Standard Time=Asia/Krasnoyarsk',
  'N. Central Asia Standard Time=Asia/Novosibirsk', 'Tomsk Standard Time=Asia/Tomsk', 'China Standard Time=Asia/Shanghai', 'North Asia East Standard Time=Asia/Irkutsk',
  'Singapore Standard Time=Asia/Singapore', 'W. Australia Standard Time=Australia/Perth', 'Taipei Standard Time=Asia/Taipei', 'Ulaanbaatar Standard Time=Asia/Ulaanbaatar',
  'Transbaikal Standard Time=Asia/Chita', 'Tokyo Standard Time=Asia/Tokyo', 'North Korea Standard Time=Asia/Pyongyang', 'Korea Standard Time=Asia/Seoul',
  'Yakutsk Standard Time=Asia/Yakutsk', 'Cen. Australia Standard Time=Australia/Adelaide', 'AUS Central Standard Time=Australia/Darwin', 'E. Australia Standard Time=Australia/Brisbane',
  'AUS Eastern Standard Time=Australia/Sydney', 'West Pacific Standard Time=Pacific/Port_Moresby', 'Tasmania Standard Time=Australia/Hobart', 'Vladivostok Standard Time=Asia/Vladivostok',
  'Sakhalin Standard Time=Asia/Sakhalin', 'Central Pacific Standard Time=Pacific/Guadalcanal', 'Russia Time Zone 10=Asia/Srednekolymsk', 'Magadan Standard Time=Asia/Magadan',
  'Kamchatka Standard Time=Asia/Kamchatka', 'Russia Time Zone 11=Asia/Kamchatka', 'New Zealand Standard Time=Pacific/Auckland', 'Fiji Standard Time=Pacific/Fiji',
  'Tonga Standard Time=Pacific/Tongatapu', 'Samoa Standard Time=Pacific/Apia', 'Line Islands Standard Time=Pacific/Kiritimati',
];

/** lower-case Windows name → IANA zone */
export const WINDOWS_ZONES = new Map(PAIRS.map((p) => { const i = p.lastIndexOf('='); return [p.slice(0, i).toLowerCase(), p.slice(i + 1)]; }));

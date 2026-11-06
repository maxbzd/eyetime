#!/usr/bin/env python3
# SPDX-License-Identifier: FSL-1.1-ALv2
# Copyright 2026 maxbzd
"""Put the Functional Source License into an old EyeTime release file.
   patch_zip.py <file.zip|file.json> [out]
   Replaces LICENSE inside the zips, adds NOTICE, fixes the "MIT licence" line of the About screen (our own files only; the
   licence files of third-party things such as fonts are left alone), and fixes the licence of EyeTime in an SBOM."""
import sys, os, re, json, zipfile, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
LIC = open(os.path.join(ROOT, 'LICENSE'), encoding='utf8').read()
NOTICE = open(os.path.join(ROOT, 'NOTICE'), encoding='utf8').read()
TAG = {
    'en': 'Free · source-available · FSL-1.1-ALv2', 'de': 'Kostenlos · Quellcode einsehbar · FSL-1.1-ALv2',
    'es': 'Gratis · código fuente visible · FSL-1.1-ALv2', 'fr': 'Gratuit · code source consultable · FSL-1.1-ALv2',
    'it': 'Gratuito · codice sorgente consultabile · FSL-1.1-ALv2', 'ja': '無料 · ソースコード公開 · FSL-1.1-ALv2',
    'pl': 'Darmowy · kod źródłowy do wglądu · FSL-1.1-ALv2', 'pt': 'Gratuito · código-fonte visível · FSL-1.1-ALv2',
    'ru': 'Бесплатно · исходный код доступен · FSL-1.1-ALv2', 'uk': 'Безкоштовно · вихідний код доступний · FSL-1.1-ALv2',
    'zh': '免费 · 源码可见 · FSL-1.1-ALv2',
}


OLD = {  # the About line as it was under MIT, per language
    'en': 'Free and open source · MIT licence', 'de': 'Kostenlos und Open Source · MIT-Lizenz', 'es': 'Gratis y de código abierto · Licencia MIT',
    'fr': 'Gratuit et open source · licence MIT', 'it': 'Gratuito e open source · licenza MIT', 'ja': '無料・オープンソース · MITライセンス',
    'pl': 'Darmowy i open source · licencja MIT', 'pt': 'Gratuito e de código aberto · licença MIT', 'ru': 'Бесплатно, с открытым кодом · лицензия MIT',
    'uk': 'Безкоштовно, з відкритим кодом · ліцензія MIT', 'zh': '免费开源 · MIT 许可证',
}
THIRD_PARTY = re.compile(r'(^|/)(fonts|ml)/|LICENSE-|vendor/|\.min\.|ort\.')


def fix_locale(name, data):
    """Our own scripts and data (not third-party files): the About line, wherever the build put it (a locale file or inside a bundle)."""
    if not re.search(r'\.(js|mjs|json)$', name) or THIRD_PARTY.search(name) or not (name.startswith('src/') or name.startswith('_locales/')):
        return data
    try:
        s = data.decode('utf8')
    except UnicodeDecodeError:
        return data
    changed = False
    for lang, old in OLD.items():
        if old in s:
            s = s.replace(old, TAG[lang]); changed = True
    m = re.search(r'/(?:locales/(?:data/)?)?([a-z]{2})\.(?:js|json)$', name)
    fallback = TAG.get(m.group(1), TAG['en']) if m else TAG['en']
    def generic(x):  # any other About line that still says MIT (an older version)
        return x.group(1) + (fallback if 'MIT' in x.group(2) else x.group(2)) + x.group(3)
    s2 = re.sub(r"(about\.tagline['\"]?\s*:\s*['\"])([^'\"]*)(['\"])", generic, s)
    if s2 != s: s = s2; changed = True
    return s.encode('utf8') if changed else data


def patch_zip(src, dst):
    tmp = dst + '.tmp'
    with zipfile.ZipFile(src) as zi, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zo:
        names = zi.namelist()
        for info in zi.infolist():
            data = zi.read(info.filename)
            if info.filename == 'LICENSE':
                data = LIC.encode('utf8')
            elif info.filename == 'NOTICE':
                data = NOTICE.encode('utf8')
            else:
                data = fix_locale(info.filename, data)
            ni = zipfile.ZipInfo(info.filename, info.date_time)
            ni.compress_type = zipfile.ZIP_DEFLATED
            ni.external_attr = info.external_attr
            zo.writestr(ni, data)
        for extra, text in (('LICENSE', LIC), ('NOTICE', NOTICE)):
            if extra not in names:
                ni = zipfile.ZipInfo(extra, (2026, 11, 6, 0, 0, 0))
                ni.compress_type = zipfile.ZIP_DEFLATED
                zo.writestr(ni, text.encode('utf8'))
    shutil.move(tmp, dst)


def patch_json(src, dst):
    j = json.load(open(src, encoding='utf8'))
    c = j.get('metadata', {}).get('component', {})
    for lic in c.get('licenses', []):
        if lic.get('license', {}).get('id') == 'MIT':
            lic['license']['id'] = 'FSL-1.1-ALv2'
    json.dump(j, open(dst, 'w', encoding='utf8'), indent=2, ensure_ascii=False)


if __name__ == '__main__':
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else src
    (patch_zip if src.endswith('.zip') else patch_json)(src, dst)
    print('patched', dst)

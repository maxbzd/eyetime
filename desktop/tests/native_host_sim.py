#!/usr/bin/env python3
# SPDX-License-Identifier: FSL-1.1-ALv2
# Copyright 2026 maxbzd
"""Stands in for `eyetime-helper.exe --native-host` in the tests on Linux: the browser's framed messages go to the simulator over HTTP.
The real one (helper/src/agent.rs) forwards to the Windows named pipe the same way and refuses anything but site/decision/ping/status."""
import json, struct, sys, urllib.request

SIM = 'http://127.0.0.1:8131/req'
ALLOWED = {'site', 'decision', 'ping', 'status'}


def read():
    head = sys.stdin.buffer.read(4)
    if len(head) < 4:
        return None
    (n,) = struct.unpack('<I', head)
    return json.loads(sys.stdin.buffer.read(n))


def write(obj):
    data = json.dumps(obj).encode()
    sys.stdout.buffer.write(struct.pack('<I', len(data)) + data)
    sys.stdout.buffer.flush()


while True:
    msg = read()
    if msg is None:
        break
    if msg.get('op') not in ALLOWED:
        write({'ok': False, 'code': 'denied', 'message': 'not for the extension', 'data': None})
        continue
    try:
        req = urllib.request.Request(SIM, data=json.dumps(msg).encode(), method='POST')
        write(json.loads(urllib.request.urlopen(req, timeout=5).read()))
    except Exception as e:  # the simulator is not there
        write({'ok': False, 'code': 'offline', 'message': str(e), 'data': None})

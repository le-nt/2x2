#!/usr/bin/env python3
"""Register/login fixed dummy users on a running, marked loopback test stack."""
import argparse
import http.cookiejar
import json
import urllib.error
import urllib.request
from pathlib import Path

USERS = [('PreservationProbe', 'Isolated_probe_password_2026!'),
         ('PreservationPeer', 'Isolated_peer_password_2026!')]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage',type=Path,required=True)
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]
    stage=args.stage.resolve(strict=True)
    if not stage.is_relative_to(root/'work'):raise ValueError('Only this checkout/work test stages are allowed')
    marker=json.loads((stage/'validation-marker.json').read_text())
    config=json.loads((stage/'server/config.json').read_text())
    base=marker['publicOrigin']
    from urllib.parse import urlsplit
    origin=urlsplit(base)
    if (marker['type']!='isolated-native-validation' or origin.scheme!='http' or
        origin.hostname!='127.0.0.1' or origin.path or origin.query or origin.fragment or
        not origin.port or origin.port<1025 or config['native']['publicOrigin']!=base or
        config['accessToken']!='isolated-native-validation'):
        raise ValueError('Not an isolated loopback fixture')
    for username,password in USERS:
        opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        opener.open(base+'/?key=isolated-native-validation',timeout=10).close()
        data=json.dumps({'username':username,'password':password}).encode()
        def request(route):
            return opener.open(urllib.request.Request(base+route,data=data,headers={'Content-Type':'application/json'}),timeout=10)
        try:
            with request('/api/register') as response:
                if response.status!=200:raise RuntimeError('Fixture registration failed')
        except urllib.error.HTTPError as error:
            # An existing account must still authenticate with its fixture
            # password. Never reset passwords or change existing account data.
            if error.code not in {400,409}:raise
        with request('/api/login') as response:
            if response.status!=200:raise RuntimeError('Fixture login failed')
        print('Validated isolated fixture user: '+username)

if __name__=='__main__':main()

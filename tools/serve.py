#!/usr/bin/env python3
"""
serve.py — Petit serveur de développement pour le prototype.

http.server met en cache agressivement, ce qui fait que le navigateur
continue de servir d'anciens fichiers après une modification. Ce serveur
force le rechargement à chaque requête.

Usage :
    python3 tools/serve.py [port] [dossier]
"""
import functools
import http.server
import os
import socketserver
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """Désactive tout cache navigateur et autorise l'iframe de preview."""

    def end_headers(self):
        self.send_header('Cache-Control',
                         'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # la preview est servie dans une iframe sur un autre domaine
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, fmt, *args):
        # journal compact : on ignore les 200 sur les assets volumineux
        sys.stderr.write('%s %s\n' % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    root = sys.argv[2] if len(sys.argv) > 2 else 'prototype'
    root = os.path.abspath(root)

    handler = functools.partial(NoCacheHandler, directory=root)
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.ThreadingTCPServer(('0.0.0.0', port), handler) as httpd:
        print(f'Prototype servi depuis {root}')
        print(f'  http://0.0.0.0:{port}/          cinématique')
        print(f'  http://0.0.0.0:{port}/dive.html bac à sable')
        httpd.serve_forever()


if __name__ == '__main__':
    main()

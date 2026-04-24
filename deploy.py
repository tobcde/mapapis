#!/usr/bin/env python3
"""
Deploy a GitHub Pages.

Uso:
    python deploy.py usuario/repo ghp_xxxxx              # deploy completo del preset
    python deploy.py usuario/repo ghp_xxxxx <archivo>    # subir un solo archivo

Ejemplos:
    python deploy.py tobcde/mapapis ghp_xxxxx
    python deploy.py tobcde/mapapis ghp_xxxxx index.html
"""

import sys
import os
import base64
import json
import urllib.request
import urllib.error

PRESETS = {
    "tobcde/mapapis": [
        "github-pages/mapapis/index.html",
        "github-pages/mapapis/manifest.json",
        "github-pages/mapapis/sw.js",
        "github-pages/mapapis/icons/icon-192.png",
        "github-pages/mapapis/icons/icon-512.png",
    ],
}


def strip_prefix(local_path, repo):
    """Quita 'github-pages/<reponame>/' para obtener el path dentro del repo."""
    reponame = repo.split("/")[-1]
    prefix = f"github-pages/{reponame}/"
    if local_path.startswith(prefix):
        return local_path[len(prefix):]
    return local_path


def api_request(url, token, method="GET", data=None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"token {token}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "deploy.py")
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        req.add_header("Content-Type", "application/json")
    else:
        body = None
    try:
        with urllib.request.urlopen(req, data=body) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read().decode("utf-8"))
        except Exception:
            err = {"message": str(e)}
        return e.code, err


def upload_file(repo, token, local_path, remote_path):
    if not os.path.exists(local_path):
        print(f"  ✗ No existe: {local_path}")
        return False

    with open(local_path, "rb") as f:
        content = f.read()
    b64 = base64.b64encode(content).decode("utf-8")

    url = f"https://api.github.com/repos/{repo}/contents/{remote_path}"

    # Obtener SHA si existe
    status, existing = api_request(url, token)
    sha = existing.get("sha") if status == 200 else None

    payload = {
        "message": f"Update {remote_path}",
        "content": b64,
    }
    if sha:
        payload["sha"] = sha

    status, resp = api_request(url, token, method="PUT", data=payload)
    if status in (200, 201):
        print(f"  ✓ {remote_path}")
        return True
    else:
        print(f"  ✗ {remote_path}: {resp.get('message', 'error')}")
        return False


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    repo = sys.argv[1]
    token = sys.argv[2]
    single_file = sys.argv[3] if len(sys.argv) >= 4 else None

    if single_file:
        # Buscar el archivo en el preset o tomarlo relativo
        preset = PRESETS.get(repo, [])
        match = None
        for p in preset:
            if p.endswith(single_file) or p == single_file:
                match = p
                break
        if not match:
            match = single_file
        if not os.path.exists(match):
            print(f"No existe: {match}")
            sys.exit(1)
        remote = strip_prefix(match, repo)
        print(f"Subiendo a {repo}:")
        upload_file(repo, token, match, remote)
        print(f"\n🌐 https://{repo.split('/')[0]}.github.io/{repo.split('/')[1]}/")
        return

    files = PRESETS.get(repo)
    if not files:
        print(f"Repo '{repo}' no tiene preset definido en PRESETS.")
        sys.exit(1)

    print(f"Deploy completo a {repo}:")
    ok = 0
    for local in files:
        remote = strip_prefix(local, repo)
        if upload_file(repo, token, local, remote):
            ok += 1
    print(f"\n{ok}/{len(files)} archivos subidos.")
    print(f"🌐 https://{repo.split('/')[0]}.github.io/{repo.split('/')[1]}/")


if __name__ == "__main__":
    main()

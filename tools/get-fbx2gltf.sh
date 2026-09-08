#!/bin/sh
# Installe le convertisseur FBX -> glTF dans tools/bin/.
# Nécessaire pour importer les animations téléchargées depuis Mixamo,
# qui n'exporte pas en glTF.
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
npm install --silent --no-audit --no-fund --prefix "$tmp" fbx2gltf
mkdir -p "$root/tools/bin"
cp "$tmp/node_modules/fbx2gltf/bin/Linux/FBX2glTF" "$root/tools/bin/"
chmod +x "$root/tools/bin/FBX2glTF"
rm -rf "$tmp"
echo "OK -> tools/bin/FBX2glTF"

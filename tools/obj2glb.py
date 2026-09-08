#!/usr/bin/env python3
"""
obj2glb.py — Convertit un OBJ + texture en glTF binaire (.glb)

Les générateurs 3D exportent parfois en .obj (+ .mtl + .png) plutôt qu'en
.glb. Three.js charge nativement le .glb ; ce script fait la conversion
sans dépendance externe.

Usage :
    python3 tools/obj2glb.py entree.obj sortie.glb [texture.png]

Si la texture n'est pas précisée, elle est lue depuis le .mtl (map_Kd),
ou devinée à partir du nom de l'OBJ.
"""
import json
import os
import struct
import sys


def parse_obj(path):
    """Lit un OBJ et renvoie les listes de sommets, UV, normales et faces."""
    V, VT, VN, F = [], [], [], []
    with open(path, errors='replace') as fh:
        for line in fh:
            if line.startswith('v '):
                p = line.split()
                V.append((float(p[1]), float(p[2]), float(p[3])))
            elif line.startswith('vt '):
                p = line.split()
                VT.append((float(p[1]), float(p[2])))
            elif line.startswith('vn '):
                p = line.split()
                VN.append((float(p[1]), float(p[2]), float(p[3])))
            elif line.startswith('f '):
                idx = []
                for tok in line.split()[1:]:
                    a = tok.split('/')
                    idx.append((
                        int(a[0]) - 1,
                        int(a[1]) - 1 if len(a) > 1 and a[1] else -1,
                        int(a[2]) - 1 if len(a) > 2 and a[2] else -1,
                    ))
                # triangulation en éventail
                for k in range(1, len(idx) - 1):
                    F.append((idx[0], idx[k], idx[k + 1]))
    return V, VT, VN, F


def find_texture(obj_path, explicit=None):
    """Localise la texture : argument explicite, puis .mtl, puis devinette."""
    if explicit and os.path.exists(explicit):
        return explicit
    base = os.path.splitext(obj_path)[0]
    mtl = base + '.mtl'
    if os.path.exists(mtl):
        d = os.path.dirname(obj_path)
        with open(mtl, errors='replace') as fh:
            for line in fh:
                if line.strip().startswith('map_Kd'):
                    name = line.split(None, 1)[1].strip()
                    for cand in (os.path.join(d, name), name):
                        if os.path.exists(cand):
                            return cand
    for ext in ('.png', '.jpg', '.jpeg'):
        if os.path.exists(base + ext):
            return base + ext
    return None


def pad4(b, fill=b'\x00'):
    r = len(b) % 4
    return b + (fill * (4 - r) if r else b'')


def convert(obj_path, glb_path, tex_path=None, name='mesh'):
    V, VT, VN, F = parse_obj(obj_path)
    if not F:
        raise SystemExit(f'Aucune face trouvée dans {obj_path}')

    # glTF n'accepte qu'un seul index par sommet : on déduplique les
    # triplets (position, uv, normale) en sommets uniques.
    uniq, P, T, N, I = {}, [], [], [], []
    for tri in F:
        for key in tri:
            if key not in uniq:
                uniq[key] = len(P)
                vi, ti, ni = key
                P.append(V[vi])
                T.append(VT[ti] if 0 <= ti < len(VT) else (0.0, 0.0))
                N.append(VN[ni] if 0 <= ni < len(VN) else (0.0, 1.0, 0.0))
            I.append(uniq[key])

    pos = struct.pack('<%df' % (len(P) * 3), *[c for v in P for c in v])
    nor = struct.pack('<%df' % (len(N) * 3), *[c for v in N for c in v])
    # l'axe V des UV est inversé entre OBJ et glTF
    uv = struct.pack('<%df' % (len(T) * 2),
                     *[c for t in T for c in (t[0], 1.0 - t[1])])
    idx = struct.pack('<%dI' % len(I), *I)

    tex = find_texture(obj_path, tex_path)
    img = open(tex, 'rb').read() if tex else None
    mime = 'image/png' if tex and tex.lower().endswith('.png') else 'image/jpeg'

    buf = b''
    views = []

    def addview(data, target=None):
        nonlocal buf
        off = len(buf)
        buf = pad4(buf + data)
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target:
            v['target'] = target
        views.append(v)
        return len(views) - 1

    xs = [p[0] for p in P]
    ys = [p[1] for p in P]
    zs = [p[2] for p in P]

    accs = []
    accs.append({'bufferView': addview(pos, 34962), 'componentType': 5126,
                 'count': len(P), 'type': 'VEC3',
                 'min': [min(xs), min(ys), min(zs)],
                 'max': [max(xs), max(ys), max(zs)]})
    accs.append({'bufferView': addview(nor, 34962), 'componentType': 5126,
                 'count': len(N), 'type': 'VEC3'})
    accs.append({'bufferView': addview(uv, 34962), 'componentType': 5126,
                 'count': len(T), 'type': 'VEC2'})
    accs.append({'bufferView': addview(idx, 34963), 'componentType': 5125,
                 'count': len(I), 'type': 'SCALAR'})

    mat = {'name': name, 'doubleSided': False,
           'pbrMetallicRoughness': {'metallicFactor': 0.0,
                                    'roughnessFactor': 0.9}}
    g = {
        'asset': {'version': '2.0', 'generator': 'obj2glb (Echoes of the Deep)'},
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': name}],
        'meshes': [{'name': name, 'primitives': [{
            'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2},
            'indices': 3, 'material': 0}]}],
        'materials': [mat],
        'accessors': accs, 'bufferViews': views,
    }

    if img:
        vimg = addview(img)
        mat['pbrMetallicRoughness']['baseColorTexture'] = {'index': 0}
        g['textures'] = [{'source': 0, 'sampler': 0}]
        g['images'] = [{'bufferView': vimg, 'mimeType': mime,
                        'name': 'base_color'}]
        g['samplers'] = [{'magFilter': 9729, 'minFilter': 9987,
                          'wrapS': 10497, 'wrapT': 10497}]

    g['buffers'] = [{'byteLength': len(buf)}]

    js = pad4(json.dumps(g, separators=(',', ':')).encode('utf8'), b' ')
    bn = pad4(buf)
    glb = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(bn))
    glb += struct.pack('<I', len(js)) + b'JSON' + js
    glb += struct.pack('<I', len(bn)) + b'BIN\x00' + bn

    with open(glb_path, 'wb') as fh:
        fh.write(glb)

    print(f'{glb_path}  {len(glb) / 1e6:.2f} Mo')
    print(f'  sommets   : {len(P)}')
    print(f'  triangles : {len(I) // 3}')
    print(f'  texture   : {os.path.basename(tex) if tex else "aucune"}')
    h = max(ys) - min(ys)
    print(f'  hauteur   : {h:.3f} (normalisée à l\'exécution)')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(1)
    out = sys.argv[2]
    convert(sys.argv[1], out, sys.argv[3] if len(sys.argv) > 3 else None,
            name=os.path.splitext(os.path.basename(out))[0])

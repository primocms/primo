#!/usr/bin/env python3
"""Prepare unpublished stable npm archives from qualified candidate archives.

No registry mutation, tag, release or deployment is performed. Re-run after any
candidate bytes change. Final registry installation must be verified after the
separately authorized publication; offline installation is a separate gate.
"""
import argparse, base64, hashlib, json, os, pathlib, subprocess, tarfile, tempfile
root = pathlib.Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True, type=pathlib.Path)
args = parser.parse_args()
out = args.output.resolve()
out.mkdir(parents=True, exist_ok=True)
inputs = json.loads((root / 'tests/staging/rc8-packages.json').read_text())
versions = json.loads((root / 'release/ship/INPUTS.json').read_text())['plannedStableVersions']
manifest = {'state': 'prepared-unpublished', 'publicationAuthorized': False, 'registryHandoffVerified': False, 'versions': versions, 'packages': {}}
for kind in ['mcp', 'cli']:
    source = root / 'release/vendor' / inputs[kind]['archive']
    raw = source.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == inputs[kind]['sha256'], f'{kind}: candidate checksum mismatch'
    with tempfile.TemporaryDirectory(prefix=f'primo-final-{kind}-') as temp:
        stage = pathlib.Path(temp)
        with tarfile.open(source) as archive:
            for member in archive:
                path = pathlib.PurePosixPath(member.name)
                assert path.parts[0] == 'package' and '..' not in path.parts and not path.is_absolute()
                assert member.isdir() or member.isfile(), 'Archive links are not supported'
                target = stage.joinpath(*path.parts)
                if member.isdir(): target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(archive.extractfile(member).read())
                    target.chmod(member.mode & 0o777)
        package = stage / 'package'
        metadata = json.loads((package / 'package.json').read_text())
        metadata['version'] = versions[kind]
        if kind == 'cli': metadata['dependencies']['primo-mcp'] = versions['mcp']
        (package / 'package.json').write_text(json.dumps(metadata, indent=2) + '\n')
        result = subprocess.check_output(['npm', 'pack', '--ignore-scripts', '--json', '--cache', str(out / '.npm-cache'), '--pack-destination', str(out)], cwd=package, text=True)
        packed = json.loads(result)[0]
        stable = out / packed['filename']
        # Every shipped file except package metadata must remain byte-identical.
        with tarfile.open(source) as before, tarfile.open(stable) as after:
            a = {m.name: before.extractfile(m).read() for m in before if m.isfile() and m.name != 'package/package.json'}
            b = {m.name: after.extractfile(m).read() for m in after if m.isfile() and m.name != 'package/package.json'}
            assert a == b, f'{kind}: unexpected shipped-file change'
        data = stable.read_bytes()
        manifest['packages'][kind] = {'archive': stable.name, 'version': versions[kind], 'sourceArchive': source.name, 'sourceSHA256': inputs[kind]['sha256'], 'sha256': hashlib.sha256(data).hexdigest(), 'integrity': 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode(), 'files': len(b)+1}
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))

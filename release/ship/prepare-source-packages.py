#!/usr/bin/env python3
"""Build unpublished stable archives from clean CLI/MCP source checkouts."""
import argparse
import base64
import hashlib
import json
import pathlib
import subprocess
import tarfile
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cli-source', required=True, type=pathlib.Path)
parser.add_argument('--mcp-source', required=True, type=pathlib.Path)
parser.add_argument('--output', required=True, type=pathlib.Path)
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parents[2]
versions = json.loads((root / 'release/ship/INPUTS.json').read_text())['plannedStableVersions']
out = args.output.resolve()
out.mkdir(parents=True, exist_ok=True)
manifest = {'state': 'prepared-unpublished', 'publicationAuthorized': False,
            'registryHandoffVerified': False, 'versions': versions, 'packages': {}}

def run(command, cwd):
    if command[0] == 'npm':
        command += ['--cache', str(out / '.npm-cache')]
    return subprocess.check_output(command, cwd=cwd, text=True)

for kind in ['mcp', 'cli']:
    source = getattr(args, kind + '_source').resolve()
    if run(['git', 'status', '--porcelain', '--untracked-files=no'], source).strip():
        raise SystemExit(f'{kind}: tracked source changes must be committed first')
    commit = run(['git', 'rev-parse', 'HEAD'], source).strip()
    subprocess.run(['npm', 'run', 'build'], cwd=source, check=True)
    with tempfile.TemporaryDirectory(prefix=f'primo-source-{kind}-') as temp:
        stage = pathlib.Path(temp)
        packed = json.loads(run(['npm', 'pack', '--ignore-scripts', '--json',
                                 '--pack-destination', str(stage)], source))[0]
        original = stage / packed['filename']
        shipped = {}
        with tarfile.open(original) as archive:
            for member in archive:
                path = pathlib.PurePosixPath(member.name)
                if (not path.parts or path.parts[0] != 'package' or '..' in path.parts
                        or path.is_absolute() or not (member.isdir() or member.isfile())):
                    raise SystemExit('Invalid archive entry')
                target = stage.joinpath(*path.parts)
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    data = archive.extractfile(member).read()
                    shipped[member.name] = data
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(data)
                    target.chmod(member.mode & 0o777)
        package = stage / 'package'
        metadata = json.loads((package / 'package.json').read_text())
        metadata['version'] = versions[kind]
        if kind == 'cli':
            metadata['dependencies']['primo-mcp'] = versions['mcp']
        (package / 'package.json').write_text(json.dumps(metadata, indent=2) + '\n')
        final = json.loads(run(['npm', 'pack', '--ignore-scripts', '--json',
                                '--pack-destination', str(out)], package))[0]
        artifact = out / final['filename']
        with tarfile.open(artifact) as archive:
            final_files = {m.name: archive.extractfile(m).read() for m in archive if m.isfile()}
        shipped.pop('package/package.json')
        final_files.pop('package/package.json')
        if shipped != final_files:
            raise SystemExit(f'{kind}: unexpected shipped-file change')
        data = artifact.read_bytes()
        manifest['packages'][kind] = {
            'archive': artifact.name, 'version': versions[kind], 'sourceCommit': commit,
            'sourceArchiveSHA256': hashlib.sha256(original.read_bytes()).hexdigest(),
            'sha256': hashlib.sha256(data).hexdigest(),
            'integrity': 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode(),
            'files': len(final_files) + 1}
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))

#!/usr/bin/env python3
"""Build unpublished stable archives from clean CLI/MCP source checkouts."""
import argparse
import base64
from contextlib import contextmanager
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
if any(out.iterdir()):
    raise SystemExit('Output directory must be empty; preserve prior archives and manifests separately')
manifest = {'state': 'prepared-unpublished', 'publicationAuthorized': False,
            'registryHandoffVerified': False, 'versions': versions, 'packages': {}}

def run(command, cwd):
    if command[0] == 'npm':
        command += ['--cache', str(out / '.npm-cache')]
    return subprocess.check_output(command, cwd=cwd, text=True)

@contextmanager
def built_source(source, commit, stage):
    """Build only committed source with fresh locked dependencies and output."""
    worktree = stage / 'source'
    subprocess.run(['git', '-C', str(source), 'worktree', 'add', '--detach',
                    str(worktree), commit], check=True)
    try:
        run(['npm', 'ci', '--ignore-scripts'], worktree)
        run(['npm', 'run', 'build'], worktree)
        if run(['git', 'status', '--porcelain', '--untracked-files=no'], worktree).strip():
            raise SystemExit('Build changed tracked source; commit generated source before packing')
        yield worktree
    finally:
        subprocess.run(['git', '-C', str(source), 'worktree', 'remove', '--force',
                        str(worktree)], check=True)

for kind in ['mcp', 'cli']:
    source = getattr(args, kind + '_source').resolve()
    if run(['git', 'status', '--porcelain', '--untracked-files=normal'], source).strip():
        raise SystemExit(f'{kind}: source changes and untracked files must be committed first')
    commit = run(['git', 'rev-parse', 'HEAD'], source).strip()
    with tempfile.TemporaryDirectory(prefix=f'primo-source-{kind}-') as temp:
        stage = pathlib.Path(temp)
        with built_source(source, commit, stage) as clean:
            packed = json.loads(run(['npm', 'pack', '--ignore-scripts', '--json',
                                     '--pack-destination', str(stage)], clean))[0]
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

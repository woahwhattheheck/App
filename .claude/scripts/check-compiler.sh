#!/bin/bash

# Secure proxy script to run React Compiler compliance check on a single file.
# Validates the filepath before passing it to the underlying npm script.
set -eu

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <filepath>" >&2
    exit 1
fi

readonly FILEPATH="$1"

die() {
    echo "Error: $*" >&2
    exit 1
}

# Preserve the existing character allowlist, but require a repository-relative
# path without parent traversal.
if ! [[ "$FILEPATH" =~ ^[a-zA-Z0-9_./@-]+$ ]]; then
    die "Invalid filepath (contains disallowed characters)"
fi
if [[ "$FILEPATH" == /* || "$FILEPATH" == ".." || "$FILEPATH" == ../* || "$FILEPATH" == */../* || "$FILEPATH" == */.. ]]; then
    die "Invalid filepath (must stay inside the repository)"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly SCRIPT_DIR
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd -P)"
readonly REPO_ROOT

# Resolve the existing file before forwarding it so a repository-local symlink
# cannot escape the boundary after passing the lexical checks. Node is already
# a prerequisite for the npm command below.
SAFE_PATH=""
if ! SAFE_PATH="$(node - "$REPO_ROOT" "$FILEPATH" <<'NODE'
const fs = require('fs');
const path = require('path');

try {
    const root = fs.realpathSync(process.argv[2]);
    const candidate = fs.realpathSync(path.resolve(root, process.argv[3]));
    const relative = path.relative(root, candidate);

    if (
        relative === '' ||
        relative === '..' ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative) ||
        !fs.statSync(candidate).isFile()
    ) {
        process.exit(2);
    }

    process.stdout.write(relative);
} catch {
    process.exit(2);
}
NODE
)"; then
    die "Invalid filepath (must resolve to an existing file inside the repository)"
fi
readonly SAFE_PATH

npm run react-compiler-compliance-check -- check "$SAFE_PATH"

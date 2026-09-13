#!/bin/bash

set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly SCRIPT_DIR
readonly SOURCE_SCRIPT="$SCRIPT_DIR/check-compiler.sh"
TEMP_DIR="$(mktemp -d)"
readonly TEMP_DIR
trap 'rm -rf "$TEMP_DIR"' EXIT

readonly TEST_REPO="$TEMP_DIR/repo"
readonly OUTSIDE_DIR="$TEMP_DIR/outside"
readonly BIN_DIR="$TEMP_DIR/bin"
readonly NPM_LOG="$TEMP_DIR/npm.log"
export NPM_LOG

mkdir -p "$TEST_REPO/.claude/scripts" "$TEST_REPO/src" "$OUTSIDE_DIR" "$BIN_DIR"
cp "$SOURCE_SCRIPT" "$TEST_REPO/.claude/scripts/check-compiler.sh"
chmod +x "$TEST_REPO/.claude/scripts/check-compiler.sh"

touch "$TEST_REPO/src/ok.ts" "$OUTSIDE_DIR/secret.ts"
ln -s "$OUTSIDE_DIR/secret.ts" "$TEST_REPO/src/outside-link.ts"

cat > "$BIN_DIR/npm" <<'STUB'
#!/bin/sh
printf '%s\n' "$*" >> "$NPM_LOG"
STUB
chmod +x "$BIN_DIR/npm"

run_proxy() {
    (
        cd "$TEST_REPO"
        PATH="$BIN_DIR:$PATH" ./.claude/scripts/check-compiler.sh "$1"
    )
}

expect_accept() {
    local filepath="$1"
    rm -f "$NPM_LOG"
    if ! run_proxy "$filepath" >/dev/null 2>&1; then
        echo "Expected compiler proxy to accept: $filepath" >&2
        exit 1
    fi
    if [[ ! -s "$NPM_LOG" ]] || [[ "$(wc -l < "$NPM_LOG")" -ne 1 ]]; then
        echo "Expected exactly one npm invocation for: $filepath" >&2
        exit 1
    fi
    if [[ "$(cat "$NPM_LOG")" != "run react-compiler-compliance-check -- check src/ok.ts" ]]; then
        echo "Expected normalized repository-relative npm path for: $filepath" >&2
        exit 1
    fi
}

expect_reject() {
    local filepath="$1"
    rm -f "$NPM_LOG"
    if run_proxy "$filepath" >/dev/null 2>&1; then
        echo "Expected compiler proxy to reject: $filepath" >&2
        exit 1
    fi
    if [[ -s "$NPM_LOG" ]]; then
        echo "Rejected path reached npm: $filepath" >&2
        exit 1
    fi
}

expect_accept "src/ok.ts"
expect_accept "./src/ok.ts"

expect_reject "/etc/passwd"
expect_reject "../outside/secret.ts"
expect_reject "src/../src/ok.ts"
expect_reject "src/outside-link.ts"
expect_reject "src/missing.ts"

echo "check-compiler path-boundary tests passed"

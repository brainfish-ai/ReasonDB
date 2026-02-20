#!/usr/bin/env bash
set -Eeo pipefail

if [ "$(id -u)" = '0' ]; then
    mkdir -p /data
    chown -R reasondb:reasondb /data
    exec gosu reasondb "$BASH_SOURCE" "$@"
fi

# If the first argument looks like a flag, prepend the server binary.
if [ "${1:0:1}" = '-' ]; then
    set -- reasondb-server "$@"
fi

# If the command is reasondb-server, validate the data directory is writable.
if [ "$1" = 'reasondb-server' ]; then
    if [ ! -w /data ]; then
        echo >&2 "reasondb: /data is not writable — check volume permissions"
        exit 1
    fi
fi

exec "$@"

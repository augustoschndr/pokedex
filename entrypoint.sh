#!/bin/sh
set -e
mkdir -p /data
if [ "$(id -u)" = "0" ]; then
	chown -R nodeapp:nodeapp /data
	exec gosu nodeapp node build
fi
exec node build

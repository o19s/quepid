#!/bin/sh

set -e

# You can use whatever version structure you like.
echo "VERSION=$(git rev-parse HEAD)" > .env
echo "NODE_VERSION=$(cat .nvmrc)" >> .env
echo "PORT=5000" >> .env

cat .env


#!/usr/bin/env bash
# Generates the RS256 keypair the auth service signs/verifies JWTs with.
# keys/ is gitignored, so every dev runs this once after cloning.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p keys
if [ -f keys/jwt_private.pem ]; then
  echo "keys/jwt_private.pem already exists — leaving it untouched."
  exit 0
fi
openssl genrsa -out keys/jwt_private.pem 2048
openssl rsa -in keys/jwt_private.pem -pubout -out keys/jwt_public.pem
echo "Generated keys/jwt_private.pem + keys/jwt_public.pem"

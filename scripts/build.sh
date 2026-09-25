#!/usr/bin/env bash
# Builds the image. Default: native platform, loaded into the local Docker.
#   IMAGE=repo/name TAG=2.0.0 scripts/build.sh
# Multi-arch (linux/amd64 + linux/arm64) needs a registry: PUSH=1 IMAGE=registry/repo scripts/build.sh
# Pushing is an explicit, separate decision: never set PUSH=1 without approval.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="${IMAGE:-dinhdobathi/aws-secrets-manager}"  # matches the chart default
TAG="${TAG:-$(node -p "require('./package.json').version")}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"

if [ "${PUSH:-0}" = "1" ]; then
  # Multi-platform needs a docker-container builder (the default docker driver can't).
  BUILDER="${BUILDER:-sc-multiarch}"
  docker buildx inspect "${BUILDER}" >/dev/null 2>&1 || docker buildx create --name "${BUILDER}" --driver docker-container >/dev/null
  docker buildx build --builder "${BUILDER}" --platform "${PLATFORMS}" -t "${IMAGE}:${TAG}" --push .
else
  docker buildx build -t "${IMAGE}:${TAG}" --load .
fi
echo "built ${IMAGE}:${TAG}"

#!/bin/bash

# Set variables
DOCKER_USERNAME="dinhdobathi"
REPO_NAME="aws-secrets-manager"
IMAGE_TAG="1.0.0"

colima start

# Login to Docker Hub (you'll be prompted for password)
docker login -u $DOCKER_USERNAME

# Build image with platform specification and tag
docker build --platform linux/amd64 -t ${DOCKER_USERNAME}/${REPO_NAME}:${IMAGE_TAG} .

# Push to Docker Hub
docker push ${DOCKER_USERNAME}/${REPO_NAME}:${IMAGE_TAG}

echo "Successfully built and pushed image to Docker Hub"

colima stop
#!/bin/bash

# Set variables
DOCKER_USERNAME="dinhdobathi"
REPO_NAME="aws-secrets-manager"
IMAGE_TAG="latest"

# Login to Docker Hub (you'll be prompted for password)
docker login -u $DOCKER_USERNAME

# Build image
docker build -t $REPO_NAME .

# Tag image for Docker Hub
docker tag $REPO_NAME:$IMAGE_TAG $DOCKER_USERNAME/$REPO_NAME:$IMAGE_TAG

# Push to Docker Hub
docker push $DOCKER_USERNAME/$REPO_NAME:$IMAGE_TAG

echo "Successfully built and pushed image to Docker Hub"
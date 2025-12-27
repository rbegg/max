#!/bin/bash

SERVER_NAME="${1:-$SERVER_NAME}"

if [ -z "$SERVER_NAME" ]; then
  echo "Error: SERVER_NAME is not set.  Pass as a parameter or set env var 'SERVER_NAME'"
  exit 1
fi
# --- 1. Generate Local Certificate ---

# Create the local 'certs' directory if it doesn't exist
mkdir -p certs

# Check if the 'certs' directory is empty before generating a new certificate
if [ -z "$(ls -A certs)" ]; then
    echo "Directory 'certs' is empty. Generating new self-signed certificate..."
    openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -sha256 -days 365 -nodes -subj "/CN=localhost"
else
    echo "Directory 'certs' already contains files. Skipping generation."
fi

# --- 2. Copy Certificate to System Location ---

# Define the target directory in a variable for clarity
TARGET_DIR="/etc/letsencrypt/live/"$SERVER_NAME

# Create the target directory if it doesn't exist
# This command requires sudo if you are not running as root
mkdir -p "$TARGET_DIR"

# Check if the target directory is empty before copying the files
if [ -z "$(ls -A "$TARGET_DIR")" ]; then
    echo "Directory '$TARGET_DIR' is empty. Copying certificate..."
    # This command also requires sudo
    cp "certs/cert.pem" "$TARGET_DIR/fullchain.pem"
    cp "certs/key.pem" "$TARGET_DIR/privkey.pem"
else
    echo "Directory '$TARGET_DIR' already contains files. Skipping copy."
fi

echo "Setup complete."
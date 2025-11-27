#!/bin/bash

# Script to generate self-signed SSL certificate for Nginx

SSL_DIR="./ssl"
CERT_FILE="$SSL_DIR/opareta.crt"
KEY_FILE="$SSL_DIR/opareta.key"

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -subj "/C=US/ST=State/L=City/O=Opareta/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:::1"

# Set proper permissions
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo "SSL certificate generated successfully!"
echo "Certificate: $CERT_FILE"
echo "Private Key: $KEY_FILE"


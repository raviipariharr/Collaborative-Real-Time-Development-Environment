#!/bin/bash

echo "Checking Backend..."
curl https://codecollab-backend.up.railway.app/health

echo "\n\nChecking Auth Endpoint..."
curl https://codecollab-backend.up.railway.app/api/auth/me

echo "\n\nChecking CORS..."
curl -H "Origin: https://codecollab.up.railway.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://codecollab-backend.up.railway.app/api/auth/google

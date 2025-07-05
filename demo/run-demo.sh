#!/bin/bash
# Design Demo Runner

echo "🎨 Starting Design Demo..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the frontend
echo "🔨 Building frontend..."
npm run build

# Start the server
echo "🚀 Starting server..."
node server.js
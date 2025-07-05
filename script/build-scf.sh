#!/bin/sh

# Tencent Cloud Function automatic packaging script
set -e

echo "🚀 Starting to build Tencent Cloud Function package..."

# 0. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 1. Build TypeScript project
echo "📦 Building TypeScript project..."
npm run build

# 2. Build Docker image
echo "🐳 Building Docker image..."
docker build -f Dockerfile.scf -t scf-builder .

# 3. Run container and generate zip package
echo "📦 Running container to generate zip package..."
docker run --name scf-temp scf-builder

# 4. Copy zip package from container to project directory
echo "📁 Copying zip package to project directory..."
docker cp scf-temp:/app/scf-package.zip ./scf-package.zip

# 5. Clean up temporary container
echo "🧹 Cleaning up temporary container..."
docker rm scf-temp

echo "✅ Packaging completed!"
echo "📦 Generated zip package: $(pwd)/scf-package.zip"
echo "📊 Package size: $(du -h scf-package.zip | cut -f1)"
echo ""
echo "🔍 Package contents:"
unzip -l scf-package.zip | head -20 
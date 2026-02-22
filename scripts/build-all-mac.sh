#!/bin/bash

# Build script for CompressO Mac binaries (both architectures)
# This script builds both ARM64 and x86_64 versions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
APP_NAME="CompressO"

echo -e "${BLUE}=== CompressO Mac Build Script ===${NC}"
echo -e "Version: ${YELLOW}${VERSION}${NC}"
echo -e "App Name: ${YELLOW}${APP_NAME}${NC}"
echo ""

# Function to build for specific architecture
build_arch() {
    local arch=$1
    local target=$2

    echo -e "${GREEN}Building for ${arch}...${NC}"
    echo -e "${YELLOW}Target: ${target}${NC}"

    # Build Tauri app for specific architecture
    echo -e "${GREEN}Building Tauri app for ${arch}...${NC}"
    pnpm tauri:build --target "$target"

    # Check if DMG was created
    local dmg_path="./src-tauri/target/${target}/release/bundle/dmg/${APP_NAME}_${VERSION}_${arch}.dmg"
    if [ -f "$dmg_path" ]; then
        echo -e "${GREEN}✓ ${arch} DMG created: ${dmg_path}${NC}"
    else
        echo -e "${RED}✗ ${arch} DMG not found!${NC}"
        exit 1
    fi
    echo ""
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}Error: This script must be run on macOS${NC}"
    exit 1
fi

# Detect current architecture
CURRENT_ARCH=$(uname -m)
echo -e "${GREEN}Current architecture: ${YELLOW}${CURRENT_ARCH}${NC}"
echo ""

# Build ARM64 (Apple Silicon)
echo -e "${BLUE}========================================${NC}"
build_arch "aarch64" "aarch64-apple-darwin"

# Build x86_64 (Intel)
echo -e "${BLUE}========================================${NC}"
build_arch "x64" "x86_64-apple-darwin"

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}=== Build Complete ===${NC}"
echo ""
echo "Generated files:"
echo -e "  ARM64: ${YELLOW}./src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/${APP_NAME}_${VERSION}_aarch64.dmg${NC}"
echo -e "  x64:   ${YELLOW}./src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/${APP_NAME}_${VERSION}_x64.dmg${NC}"
echo ""
echo -e "${GREEN}Next: Run 'pnpm homebrew:release' to generate Homebrew cask files${NC}"

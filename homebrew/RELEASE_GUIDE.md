# Quick Release Guide

Complete workflow for releasing CompressO to Homebrew.

## Prerequisites

- macOS with both ARM64 and x86_64 build capabilities
- GitHub CLI (`gh`) installed
- Homebrew installed

## Step-by-Step Release

### 1. Update Version Numbers

```bash
# Edit version in all three files
# 1. package.json
# 2. src-tauri/Cargo.toml
# 3. src-tauri/tauri.conf.json

# Example: Change from 2.0.0 to 2.0.1
```

### 2. Build for Both Architectures

```bash
pnpm mac:build
```

This builds both ARM64 and Intel versions automatically.

### 3. Customize Template (Optional)

If you need to modify the cask content, edit the template:

```bash
nano homebrew/compresso.rb.template
```

The script reads from this template and replaces `{{VERSION}}` automatically.

### 4. Generate Homebrew Cask

```bash
pnpm homebrew:release
```

This generates:
- `homebrew/compresso.rb` - The cask file (from template)
- `homebrew/casks/compresso-2.0.1.rb` - Versioned backup (same as compresso.rb)
- `homebrew/checksums.txt` - Checksums for current version (overwritten each release)

### 4. Create GitHub Release

```bash
# First, tag and push
git tag v2.0.1
git push origin v2.0.1

# Then create release with binaries
gh release create v2.0.1 \
  src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/CompressO_2.0.1_aarch64.dmg \
  src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/CompressO_2.0.1_x64.dmg \
  --title "v2.0.1" \
  --notes "Release v2.0.1"
```

### 5. Test Cask Locally

```bash
brew install --cask --debug homebrew/compresso.rb
```

### 6. Submit to Homebrew

**First time setup:**

```bash
# Fork homebrew/homebrew-cask on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/homebrew-cask.git
cd homebrew-cask

# Copy cask file
cp /path/to/compresso/homebrew/compresso.rb Casks/compresso.rb

# Test
brew audit --cask --online Casks/compresso.rb
brew style --cask Casks/compresso.rb

# Commit and push
git checkout -b compresso
git add Casks/compresso.rb
git commit -m "Add compresso cask"
git push origin compresso

# Create PR via GitHub
```

**For existing cask:**

```bash
brew bump-cask-pr compresso --version=2.0.1
```

## Quick Commands Reference

```bash
# Build both architectures
pnpm mac:build

# Generate cask
pnpm homebrew:release

# Test locally
brew install --cask --debug homebrew/compresso.rb

# Audit cask
brew audit --cask --online homebrew/compresso.rb

# Check style
brew style --cask homebrew/compresso.rb

# Update existing cask
brew bump-cask-pr compresso --version=2.0.1
```

## Verify Installation

After installation via Homebrew, verify:

```bash
# Check if app is installed
brew list --cask | grep compresso

# Check app info
brew info compresso

# Reinstall if needed
brew reinstall --cask compresso
```

## Troubleshooting

### Build fails on Rosetta

If using Intel Mac or running under Rosetta on ARM:

```bash
# Install x86_64 Rust target
rustup target add x86_64-apple-darwin

# Install ARM64 Rust target
rustup target add aarch64-apple-darwin
```

### DMG file not found

Verify the DMG files exist at expected paths:

```bash
# Check ARM64
ls -la src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/

# Check x64
ls -la src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/
```

### Version mismatch

Ensure all three files have matching versions:

```bash
grep -A 2 '"version"' package.json
grep -A 2 '^version' src-tauri/Cargo.toml
grep -A 2 '"version"' src-tauri/tauri.conf.json
```

# Homebrew Distribution for CompressO

This directory contains the Homebrew cask configuration for distributing CompressO on macOS.

## File Structure

```
homebrew/
├── compresso.rb               # Main Homebrew cask file (auto-generated)
├── compresso.rb.template      # Template for new cask files
├── checksums.txt              # Checksums for current version
├── README.md                  # This file
├── RELEASE_GUIDE.md           # Quick release workflow guide
└── casks/                     # Versioned cask backups
    ├── compresso-2.0.0.rb     # Version 2.0.0 cask backup
    ├── compresso-2.0.1.rb     # Version 2.0.1 cask backup
    └── ...
```

## Quick Start

### 1. Build for Both Architectures

Build both ARM64 (Apple Silicon) and Intel (x86_64) versions:

```bash
pnpm mac:build
```

Or build individually:

```bash
# Apple Silicon (ARM64)
pnpm tauri:build:arm64

# Intel (x86_64)
pnpm tauri:build:x64
```

### 2. Generate Homebrew Cask

After building, generate the Homebrew cask file:

```bash
pnpm homebrew:release
```

This will:
- Verify both DMG files exist
- Calculate SHA256 checksums
- Generate `compresso.rb` cask file from `compresso.rb.template`
- Create versioned backup in `casks/compresso-{version}.rb` (same as compresso.rb)
- Create/update `checksums.txt` with current version checksums
- Display historical cask versions
- Display instructions for next steps

### 3. Test Locally

Test the cask before publishing:

```bash
brew install --cask --debug homebrew/compresso.rb
```

### 4. Publish to GitHub Releases

Upload the DMG files to GitHub:

```bash
gh release create v2.0.0 \
  src-tauri/target/release/bundle/dmg/CompressO_2.0.0_aarch64.dmg \
  src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/CompressO_2.0.0_x64.dmg \
  --title "v2.0.0" \
  --notes "Release v2.0.0"
```

### 5. Submit to Homebrew

#### Option A: New Cask Submission

If CompressO is not yet in Homebrew:

1. Fork [homebrew/homebrew-cask](https://github.com/Homebrew/homebrew-cask)
2. Create a branch: `git checkout -b compresso`
3. Copy `compresso.rb` to `Casks/compresso.rb`
4. Test: `brew install --cask --debug Casks/compresso.rb`
5. Audit: `brew audit --cask --online Casks/compresso.rb`
6. Style check: `brew style --cask Casks/compresso.rb`
7. Commit and submit PR

#### Option B: Update Existing Cask

If CompressO already exists in Homebrew:

```bash
brew bump-cask-pr compresso --version=2.0.0
```

This will automatically create a PR to update the cask.

## DMG File Locations

After building, DMG files are located at:

- **ARM64**: `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/CompressO_2.0.0_aarch64.dmg`
- **x64**: `src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/CompressO_2.0.0_x64.dmg`

## Versioning

The version is automatically pulled from `package.json`. When releasing:

1. Update version in `package.json`
2. Update version in `src-tauri/Cargo.toml`
3. Update version in `src-tauri/tauri.conf.json`
4. Run build scripts

## Cask File Details

### Main Cask File

The generated `compresso.rb` file:

- Uses `on_arm` and `on_intel` blocks for architecture-specific URLs
- Includes automatic uninstallation via `zap` stanza
- Points to official GitHub releases
- Uses verified GitHub downloads

### Versioned Backups

Every time you run `pnpm homebrew:release`, a versioned backup is created:
- Location: `homebrew/casks/compresso-{version}.rb`
- Contains the **same content** as `compresso.rb` (not the template)
- Useful for tracking changes to the cask content over time
- Allows quick comparison between versions

### Template Customization

To modify the cask content, edit `compresso.rb.template`:
- The script reads from this template file
- Replaces placeholders automatically:
  - `{{VERSION}}` → Version from `package.json`
  - `{{ARM64_SHA256}}` → Calculated SHA256 of ARM64 DMG
  - `{{X64_SHA256}}` → Calculated SHA256 of x64 DMG
- Changes to the template automatically apply to all future releases

Example template modification:
```ruby
# In homebrew/compresso.rb.template
cask "compresso" do
  version "{{VERSION}}"  # Replaced automatically

  on_arm do
    sha256 "{{ARM64_SHA256}}"  # Replaced automatically
  end

  on_intel do
    sha256 "{{X64_SHA256}}"  # Replaced automatically
  end
end
```

To view all historical versions:

```bash
ls -lh homebrew/casks/
```

To compare two versions:

```bash
diff homebrew/casks/compresso-2.0.0.rb homebrew/casks/compresso-2.0.1.rb
```

When updating the template (`compresso.rb.template`), you can easily see what changed by comparing with previous versioned files.

## Troubleshooting

### DMG Not Found

If the script can't find DMG files:

1. Ensure you've built for both architectures
2. Check the version matches between `package.json` and DMG filenames
3. Verify build completed successfully

### Cask Audit Failures

If `brew audit` fails:

1. Check all URLs are accessible
2. Verify SHA256 checksums
3. Ensure app bundle name matches
4. Run with `--online` flag to check URLs

### Style Issues

If `brew style` fails:

1. Check Ruby formatting
2. Ensure proper indentation (2 spaces)
3. Verify no trailing whitespace

## Resources

- [Homebrew Cask Documentation](https://docs.brew.sh/Cask-Cookbook)
- [Homebrew Cask Acceptance Criteria](https://github.com/Homebrew/homebrew-cask/blob/master/CONTRIBUTING.md)
- [Homebrew Forum](https://discourse.brew.sh/)

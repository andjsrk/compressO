cask "compresso" do
  version "2.0.0"

  on_arm do
    url "https://github.com/codeforreal1/compressO/releases/download/\#{version}/CompressO_\#{version}_aarch64.dmg",
        verified: "github.com/codeforreal1/compressO/"
    sha256 "6297eff0aec043d122f44b11287215c55443cc9d679cccb86cb9ea65725c484b"
  end

  on_intel do
    url "https://github.com/codeforreal1/compressO/releases/download/\#{version}/CompressO_\#{version}_x64.dmg",
        verified: "github.com/codeforreal1/compressO/"
    sha256 "89ccfa190c21aa9179b5a5ccd93bf1763162a7a78cc2b141aaa1f55c4a7479e2"
  end

  name "CompressO"
  desc "Compress any video file to a tiny size"
  homepage "https://github.com/codeforreal1/compressO"

  depends_on macos: ">= :ventura" # macOS 13

  postflight do
    system "xattr -dr com.apple.quarantine #{appdir}/CompressO.app"
  end

  app "CompressO.app"

  zap trash: [
    "~/Library/Application Support/com.compresso.app",
    "~/Library/Caches/com.compresso.app",
    "~/Library/Preferences/com.compresso.app.plist",
    "~/Library/Saved Application State/com.compresso.app.savedState",
  ]
end

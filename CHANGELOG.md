# Changelog

### 2.1.0

Features:
- Subtitle Upload: You can now upload single or multiple subtitle and embed in the final output video. You can upload subtitles from `Others` tab.
- Download Embedded Subtitle from the video: You can also download the embedded subtitles of the video in SRT or VTT format. You can download these subtitles from `Subtitles` tab of the full video info overlay.
- Theme Color: You can customize the color of the app to your liking. The selected color will be applied to everywhere on the app.
- Audio Amplification: You can now amplify the volume upto 200% of the original audio.
- Capture Current Frame: You can now capture the current frame from the video player and copy it to the clipboard. Just right click on the video player and the context menu will show up to do so.
- Progress % in Dock: MacOS dock icon now shows progress % during processing.

Enhancements:
- Light Mode for Timeline Bar: Video player timeline and trimmer timeline gets light theme mode support.
- Timeline Performance Improvements: Timeline performance has been heavily improved. Earlier it used to show blank spaces due to constant auto-scroll update during video play progress but now it has been updated to only scroll when the cursor goes out of view.
- Metadata improvements: Metadata inputs are now controlled to sync the value properly during batch videos and single video mode. 


### 2.0.0

Features:

- Batch compression.
- Video trim/split functionality.
- Video player for Mac & Windows. Note: Linux WebGTK does not support playing local videos, so this feature is not available on Linux.
- Paste video files from clipboard. Paste a directory from clipboard for batch compression.
- Drag & drop a directory containing videos for batch compression.
- Open video files in CompressO directory from file managers. Just right click and select "Open with CompressO"
- Full video information including video container, video, audio, subtitles, chapters, etc.
- Copy compressed video to clipboard functionality.
- Video codec selection.
- Brand new Audio tab containing:
    - Audio codec selection.
    - Audio track selection.
    - Audio channel manipulation.
    - Audio bit rate manipulation.
    - Audio volume adjustment.
- Video metadata editing (title, artist, album, year, genre, description, comments, synopsis, copyright, creation date, etc.).
- Custom thumbnail for video. The thumbnail shows as a preview on file managers.
- Homebrew support for macOS installation.

Enhancements:

- Revamped UI with tabs for video, audio, and metadata settings.
- Improved slider UI components.
- Thumbnail regeneration for videos on image thumbnail mode.
- Video frame capture for transformations.

Bug Fixes:

- Remove support for 32-bit Windows.
- Windows release builds have been changed to `nsis` from `msi` for better compatibility.
- Fix Linux desktop template file to be more specific. [LINK](https://github.com/codeforreal1/compressO/issues/72)
- Preserve audio tracks when the video contains multiple audio tracks. [LINK](https://github.com/codeforreal1/compressO/issues/23)
- Fix drag & drop issue on Windows.

### 1.1.0

Features:

- Ability to mute video. ([5a44b7cb9e77a393bfe117bf79aca8b266d665cd](https://github.com/codeforreal1/compressO/commit/b0e5b60c250c69454fc38c0112c57f7a55f265de))

Enhancements:

- The minimum window height is reduced from 992 to 800 to adjust on smaller screens. ([93b04dc9ff9669b5a1fb9e1e586293aca2689636](https://github.com/codeforreal1/compressO/commit/93b04dc9ff9669b5a1fb9e1e586293aca2689636))

Bug Fixes:

- Fix typo `vide_duration`. ([f73df39f223e023611b0c4e35daf5814edd4af7c](https://github.com/codeforreal1/compressO/commit/f73df39f223e023611b0c4e35daf5814edd4af7c)). Thanks to [mbifulco](https://github.com/mbifulco) for the PR.
- Update Readme to reflect correct windows installer extension. ([6459892acf37db67aab27342aa5dae39d4fc7987](https://github.com/codeforreal1/compressO/commit/6459892acf37db67aab27342aa5dae39d4fc7987)).

### 1.2.0

Features:

- File Drag & Drop support [d744fab04f85f6fd40c59b306486235c171d6fb3](https://github.com/codeforreal1/compressO/commit/d744fab04f85f6fd40c59b306486235c171d6fb3)
- Cancel in-progress compression [ca5bceb9fde92bcbf9c8ef418691e21278aac9e6](https://github.com/codeforreal1/compressO/commit/ca5bceb9fde92bcbf9c8ef418691e21278aac9e6)
- Quality slider to select from low, medium or hight compression quality [b65647ce89082243afad7e83b782200a251c3c10](https://github.com/codeforreal1/compressO/commit/b65647ce89082243afad7e83b782200a251c3c10)

Enhancements:

- Video configuration UI has been revamped to adjust new settings [b65647ce89082243afad7e83b782200a251c3c10](https://github.com/codeforreal1/compressO/commit/b65647ce89082243afad7e83b782200a251c3c10)
- Window size and position persistence. [cf0644c5a6db7cc1e42841dc0d88fb039df3e1d5](https://github.com/codeforreal1/compressO/commit/cf0644c5a6db7cc1e42841dc0d88fb039df3e1d5)

Bug Fixes:

- Window size and position persistence on every restart. https://github.com/codeforreal1/compressO/issues/2
- Accessibility fixes for scaled resolutions [315b26fbf71dcfb4fce93ebe12a78214f332874c](https://github.com/codeforreal1/compressO/commit/315b26fbf71dcfb4fce93ebe12a78214f332874c)

### 1.3.0
Features:

- Brand new geometric transformation that enables ability o crop, rotate, flip, etc. the video. [6bf6e193d4892b2da93caa59a87ff825c35b2b43](https://github.com/codeforreal1/compressO/commit/6bf6e193d4892b2da93caa59a87ff825c35b2b43)
- Ability to change video dimensions (resolution) [37d11f436050eab42c4f619b35cc9707987a26b8](https://github.com/codeforreal1/compressO/commit/37d11f436050eab42c4f619b35cc9707987a26b8)
- Ability to change the FPS of the video [ea8ec436ac09773d9604a45c36cb93239226b778](https://github.com/codeforreal1/compressO/commit/ea8ec436ac09773d9604a45c36cb93239226b778)

Enhancements:

- Revamped UI

### 1.4.0
Bug Fixes:

- Fixed drag and drop issue on Windows [646aa54102138cc1b710ae42455a099ffdc78a8f](https://github.com/codeforreal1/compressO/commit/646aa54102138cc1b710ae42455a099ffdc78a8f)

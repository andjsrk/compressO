export interface GitHubRelease {
  tag_name: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

const REPO_OWNER = "codeforreal1";
const REPO_NAME = "compressO";

/**
 * Fetch the latest release from GitHub
 * This runs at build time, so there's no runtime API call from the client
 */
export async function getLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`
  );

  if (!response.ok) {
    if (import.meta.env.PROD) {
      throw new Error("Failed to fetch latest release from GitHub.");
    }
    return {} as any
  }

  return response.json();
}

/**
 * Generate download URL for a specific asset
 */
export function getDownloadUrl(version: string, assetName: string): string {
  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${version}/${assetName}`;
}

/**
 * Download asset types
 */
export interface DownloadAssets {
  version: string;
  mac: {
    aarch64: string;
    x64: string;
  };
  linux: {
    appImage: string;
    deb: string;
  };
  windows: {
    x64: string;
  };
}

/**
 * Get all download URLs for the current version
 */
export function getDownloadAssets(version: string): DownloadAssets {
  const baseUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${version}`;

  return {
    version,
    mac: {
      aarch64: `${baseUrl}/CompressO_${version}_aarch64.dmg`,
      x64: `${baseUrl}/CompressO_${version}_x64.dmg`,
    },
    linux: {
      appImage: `${baseUrl}/CompressO_${version}_amd64.AppImage`,
      deb: `${baseUrl}/CompressO_${version}_amd64.deb`,
    },
    windows: {
      x64: `${baseUrl}/CompressO_${version}_x64.exe`,
    },
  };
}

export async function fetchGitHubStars(): Promise<number | undefined> {
  const response = await fetch(
    "https://api.github.com/repos/codeforreal1/compressO",
  );

  if (!response.ok) {
    if (import.meta.env.PROD) {
      throw new Error("Failed to fetch latest stars from GitHub.");
    }
    return undefined;
  }

  const data = await response.json();
  const stars = data.stargazers_count;
  return stars;
}
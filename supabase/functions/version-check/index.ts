import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GITHUB_REPO = "redmonkin/core-hr-hub";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

interface ChangelogEntry {
  version: string;
  date: string;
  type: "major" | "minor" | "patch";
  title: string;
  description: string;
  changes: Array<{ type: string; text: string }>;
}

function parseReleaseType(version: string): "major" | "minor" | "patch" {
  const parts = version.replace(/^v/, '').split('.');
  if (parts[2] === '0' && parts[1] === '0') return 'major';
  if (parts[2] === '0') return 'minor';
  return 'patch';
}

function parseReleaseNotes(body: string): Array<{ type: string; text: string }> {
  const changes: Array<{ type: string; text: string }> = [];
  const lines = body.split('\n');
  
  let currentSection = 'feature';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect section headers (e.g., "New Features", "Security", "Documentation")
    const lowerTrimmed = trimmed.toLowerCase();
    if (lowerTrimmed.includes('security') && !trimmed.startsWith('-')) {
      currentSection = 'security';
      continue;
    } else if ((lowerTrimmed.includes('documentation') || lowerTrimmed.includes('docs')) && !trimmed.startsWith('-')) {
      currentSection = 'docs';
      continue;
    } else if ((lowerTrimmed.includes('fix') || lowerTrimmed.includes('bug')) && !trimmed.startsWith('-')) {
      currentSection = 'fix';
      continue;
    } else if (lowerTrimmed.includes('breaking') && !trimmed.startsWith('-')) {
      currentSection = 'breaking';
      continue;
    } else if ((lowerTrimmed.includes('feature') || lowerTrimmed.includes('new')) && !trimmed.startsWith('-')) {
      currentSection = 'feature';
      continue;
    }
    
    // Parse list items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      let text = trimmed.substring(2).trim();
      
      // Remove checkbox syntax: [ ], [x], [X]
      text = text.replace(/^\[[ xX]?\]\s*/, '');
      
      if (text) {
        changes.push({ type: currentSection, text });
      }
    }
  }
  
  if (changes.length === 0) {
    changes.push({ type: 'feature', text: 'Various improvements and updates' });
  }
  
  return changes;
}

function transformGitHubRelease(release: GitHubRelease): ChangelogEntry {
  const version = release.tag_name.replace(/^v/, '');
  const date = release.published_at.split('T')[0];
  
  return {
    version,
    date,
    type: parseReleaseType(release.tag_name),
    title: release.name || `Version ${version}`,
    description: release.body?.split('\n')[0] || `Release ${version}`,
    changes: parseReleaseNotes(release.body || ''),
  };
}

// Cache GitHub response for 1 hour to avoid rate limits
let cachedData: { changelog: ChangelogEntry[]; currentVersion: string; releaseDate: string } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchGitHubReleases(): Promise<{ changelog: ChangelogEntry[]; currentVersion: string; releaseDate: string }> {
  const now = Date.now();
  
  if (cachedData && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('Returning cached GitHub releases');
    return cachedData;
  }
  
  console.log('Fetching releases from GitHub API');
  
  const response = await fetch(GITHUB_API_URL, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Peoplo-Version-Check',
    },
  });
  
  if (!response.ok) {
    console.error(`GitHub API error: ${response.status}`);
    throw new Error(`GitHub API returned ${response.status}`);
  }
  
  const releases: GitHubRelease[] = await response.json();
  
  if (!releases || releases.length === 0) {
    throw new Error('No releases found');
  }
  
  const changelog = releases.map(transformGitHubRelease);
  const latestRelease = releases[0];
  
  cachedData = {
    changelog,
    currentVersion: latestRelease.tag_name.replace(/^v/, ''),
    releaseDate: latestRelease.published_at.split('T')[0],
  };
  cacheTimestamp = now;
  
  return cachedData;
}

// Fallback data if GitHub API fails
const FALLBACK_DATA = {
  currentVersion: "1.0.0",
  releaseDate: "2025-01-19",
  changelog: [
    {
      version: "1.0.0",
      date: "2025-01-19",
      type: "major" as const,
      title: "Initial Release",
      description: "First stable release of Peoplo HR Management System",
      changes: [
        { type: "feature", text: "Complete employee management with CRUD operations" },
        { type: "feature", text: "Leave management with approval workflows" },
        { type: "feature", text: "Attendance tracking with clock in/out" },
        { type: "feature", text: "Payroll management with salary structures" },
        { type: "feature", text: "Performance reviews and goal tracking" },
        { type: "feature", text: "Asset management and assignment" },
        { type: "feature", text: "Department management" },
        { type: "feature", text: "Role-based access control" },
        { type: "feature", text: "Email notifications via Resend" },
        { type: "feature", text: "Company calendar with events and holidays" },
        { type: "feature", text: "Comprehensive reporting system" },
        { type: "security", text: "Row Level Security (RLS) policies" },
        { type: "docs", text: "Complete documentation for self-hosting" },
      ],
    },
  ],
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let clientVersion: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      clientVersion = url.searchParams.get('version');
    } else if (req.method === 'POST') {
      try {
        const body = await req.json();
        clientVersion = body.version || null;
      } catch {
        // Ignore JSON parse errors
      }
    }

    console.log(`Version check request from client version: ${clientVersion || 'unknown'}`);

    let versionData;
    try {
      versionData = await fetchGitHubReleases();
    } catch (error) {
      console.error('Failed to fetch from GitHub, using fallback:', error);
      versionData = FALLBACK_DATA;
    }

    const response = {
      currentVersion: versionData.currentVersion,
      releaseDate: versionData.releaseDate,
      changelog: versionData.changelog,
      hasUpdate: clientVersion ? clientVersion !== versionData.currentVersion : false,
      updateUrl: `https://github.com/${GITHUB_REPO}/releases`,
      documentationUrl: "https://peoplo.redmonk.in",
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error in version-check function:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to check version' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

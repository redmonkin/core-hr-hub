import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Version and changelog data - update this when releasing new versions
const VERSION_DATA = {
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
        { type: "feature", text: "Role-based access control (Admin, HR, Manager, Employee)" },
        { type: "feature", text: "Email notifications via Resend" },
        { type: "feature", text: "Company calendar with events and holidays" },
        { type: "feature", text: "Comprehensive reporting system" },
        { type: "security", text: "Row Level Security (RLS) policies for data protection" },
        { type: "docs", text: "Complete documentation for self-hosting" },
      ],
    },
  ],
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let clientVersion: string | null = null;

    // Support both GET query params and POST body
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

    const response = {
      currentVersion: VERSION_DATA.currentVersion,
      releaseDate: VERSION_DATA.releaseDate,
      changelog: VERSION_DATA.changelog,
      hasUpdate: clientVersion ? clientVersion !== VERSION_DATA.currentVersion : false,
      updateUrl: "https://github.com/redmonkin/core-hr-hub/releases",
      documentationUrl: "https://peoplo.redmonk.in",
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
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

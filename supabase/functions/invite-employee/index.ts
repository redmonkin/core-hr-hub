import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HTML escape utility to prevent XSS in email templates
const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Allowed domains for redirect URLs - prevents open redirect attacks
const ALLOWED_REDIRECT_HOSTS = [
  'lovable.app',           // Lovable preview/published URLs
  'lovable.dev',           // Lovable development URLs
  'localhost',             // Local development
  '127.0.0.1',             // Local development
  'corehrhub.lovable.app', // Published domain for this app
];

// Validate that a URL is safe for redirect
const isAllowedRedirectUrl = (urlString: string): boolean => {
  try {
    const url = new URL(urlString);
    
    // Check exact match or subdomain match for allowed hosts
    return ALLOWED_REDIRECT_HOSTS.some(allowedHost => 
      url.hostname === allowedHost || 
      url.hostname.endsWith(`.${allowedHost}`)
    );
  } catch {
    return false;
  }
};

// Input validation schema using Zod
const inviteEmployeeSchema = z.object({
  email: z.string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  first_name: z.string()
    .trim()
    .min(1, { message: "First name is required" })
    .max(100, { message: "First name must be less than 100 characters" }),
  last_name: z.string()
    .trim()
    .min(1, { message: "Last name is required" })
    .max(100, { message: "Last name must be less than 100 characters" }),
  designation: z.string()
    .trim()
    .min(1, { message: "Designation is required" })
    .max(100, { message: "Designation must be less than 100 characters" }),
  department_name: z.string()
    .trim()
    .max(100, { message: "Department name must be less than 100 characters" })
    .optional(),
  redirect_url: z.string()
    .url({ message: "Invalid redirect URL" })
    .max(500, { message: "Redirect URL must be less than 500 characters" })
    .refine(isAllowedRedirectUrl, { 
      message: "Redirect URL must be an allowed domain (lovable.app, lovable.dev, or localhost)" 
    }),
});

type InviteEmployeeRequest = z.infer<typeof inviteEmployeeSchema>;

const sendWelcomeEmail = async (
  to: string,
  firstName: string,
  designation: string,
  departmentName: string | undefined,
  inviteLink: string
) => {
  const safeFirstName = escapeHtml(firstName);
  const safeDesignation = escapeHtml(designation);
  const safeDepartmentName = escapeHtml(departmentName);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "HR System <onboarding@resend.dev>",
      to: [to],
      subject: "Welcome to the Team! Set Up Your Account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Welcome Aboard, ${safeFirstName}! 🎉</h1>
          <p>We're excited to have you join us as <strong>${safeDesignation}</strong>${safeDepartmentName ? ` in the <strong>${safeDepartmentName}</strong> department` : ''}.</p>
          <p>To get started, please set up your account by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" 
               style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Set Up Your Account
            </a>
          </div>
          <p style="color: #666;">This link will expire in 24 hours. If you have any questions, please contact HR.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">If you didn't expect this email, please ignore it or contact HR.</p>
        </div>
      `,
    }),
  });
  return res.json();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the token and get claims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("Invalid token:", claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log("Authenticated user:", userId);

    // Use service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is HR or admin
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'hr']);

    if (!userRoles || userRoles.length === 0) {
      console.error("User not authorized - must be HR or admin");
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only HR or admin can invite employees' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate input using Zod schema
    const rawPayload = await req.json();
    const parseResult = inviteEmployeeSchema.safeParse(rawPayload);
    
    if (!parseResult.success) {
      console.error("Input validation failed:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: parseResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: InviteEmployeeRequest = parseResult.data;
    console.log("Invite employee payload (validated):", { email: payload.email, first_name: payload.first_name });

    const { email, first_name, last_name, designation, department_name, redirect_url } = payload;

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      console.log("User already exists:", existingUser.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          user_id: existingUser.id,
          already_exists: true,
          message: "User already has an account"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invite user via Supabase Auth with validated redirect_url
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirect_url,
      data: {
        full_name: `${first_name} ${last_name}`,
        first_name,
        last_name,
      },
    });

    if (inviteError) {
      console.error("Error inviting user:", inviteError);
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User invited successfully:", inviteData.user?.id);

    // Send custom welcome email with Resend (more customizable than Supabase's default)
    if (RESEND_API_KEY) {
      try {
        // Generate a magic link for the user
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'invite',
          email,
          options: {
            redirectTo: redirect_url,
            data: {
              full_name: `${first_name} ${last_name}`,
              first_name,
              last_name,
            },
          },
        });

        if (!linkError && linkData?.properties?.action_link) {
          await sendWelcomeEmail(
            email,
            first_name,
            designation,
            department_name,
            linkData.properties.action_link
          );
          console.log("Custom welcome email sent");
        }
      } catch (emailErr) {
        console.error("Error sending custom email:", emailErr);
        // Don't fail the request - Supabase will have sent its own invite email
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: inviteData.user?.id,
        already_exists: false,
        message: "Invitation sent successfully"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in invite-employee:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

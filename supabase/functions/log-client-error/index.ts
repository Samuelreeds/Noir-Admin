import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function sanitizePII(text: string): string {
  if (!text) return text;
  // Redact JWTs and access tokens
  let sanitized = text.replace(/eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[REDACTED_JWT]');
  // Redact Email Addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[REDACTED_EMAIL]');
  // Redact Phone numbers (Cambodian and general international formats)
  sanitized = sanitized.replace(/(?:\+?855|0)[1-9][0-9]{7,8}\b/g, '[REDACTED_PHONE]');
  return sanitized;
}

async function generateFingerprint(errorName: string, message: string, route: string): Promise<string> {
  const raw = `${errorName}:${message}:${route}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Returns a 64-character hex string matching the database schema requirements
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  // 1. Handle CORS preflight for browser requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Payload size protection (Limit to ~10KB to prevent abuse)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10240) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), { 
        status: 413, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payload = await req.json();
    
    // 3. Extract and Sanitize Fields
    const error_type = payload.error_type || 'unknown';
    const error_name = payload.error_name || 'Error';
    const raw_message = payload.message || 'Unknown error';
    const raw_stack = payload.stack_trace || '';
    
    const message = sanitizePII(raw_message);
    const stack_trace = sanitizePII(raw_stack).substring(0, 2000); // Prevent database bloat
    const severity = payload.severity || 'error';
    const environment = payload.environment || 'production';
    const route = payload.route || 'unknown';
    const user_id = payload.user_id || null;
    const metadata = payload.metadata || {};

    // Force-strip any accidental checkout form fields from metadata
    delete metadata.name;
    delete metadata.phone;
    delete metadata.address;

    // 4. Generate Deduplication Fingerprint
    const fingerprint = await generateFingerprint(error_name, message, route);

    // 5. Initialize Admin Supabase Client 
    // Uses the Service Role Key to safely bypass RLS and execute the insertion
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 6. Execute Deduplication RPC
    const { data: errorId, error: dbError } = await supabaseAdmin.rpc('upsert_system_error', {
      p_fingerprint: fingerprint,
      p_error_type: error_type,
      p_error_name: error_name,
      p_message: message,
      p_stack_trace: stack_trace,
      p_severity: severity,
      p_environment: environment,
      p_route: route,
      p_user_id: user_id,
      p_metadata: metadata
    });

    if (dbError) throw dbError;

    // 7. Trigger Telegram Notification for Critical Checkout Errors
    if (severity === 'critical') {
      const alertMessage = `🚨 NOIR MTD CRITICAL ALERT\nType: ${error_type}\nRoute: ${route}\nMessage: ${message}\nEnv: ${environment}\nCheck Dashboard for details.`;
      
      // Fire-and-forget invocation to the existing telegram-notification function
      supabaseAdmin.functions.invoke('telegram-notification', {
        body: { message: alertMessage }
      }).catch(err => console.error('Telegram notification dispatch failed:', err));
    }

    return new Response(JSON.stringify({ success: true, id: errorId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Log Ingestion Error:', error);
    // Returning 200 even on ingest failure ensures the client doesn't get stuck in an infinite error loop
    return new Response(JSON.stringify({ success: false, error: 'Ingestion failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
})
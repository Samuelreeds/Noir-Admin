import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user } = await req.json()
    // You will need to add this secret to your Supabase project
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

    if (!botToken) throw new Error("Server configuration error: Bot token missing");
    if (!user || !user.hash) throw new Error("Invalid payload: Missing Telegram hash");

    // 1. Verify Telegram Hash
    const { hash, ...data } = user;
    
    // Construct the data check string (must be alphabetical)
    const checkString = Object.keys(data)
      .sort()
      .map(k => `${k}=${data[k]}`)
      .join('\n');

    // Cryptographic verification using Web Crypto API
    const encoder = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      "raw",
      await crypto.subtle.digest("SHA-256", encoder.encode(botToken)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(checkString));
    const hashHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (hashHex !== hash) {
      throw new Error("Authentication failed: Invalid Telegram signature");
    }

    // 2. Prevent replay attacks (check if auth date is within the last 24 hours)
    const now = Math.floor(Date.now() / 1000);
    if (now - user.auth_date > 86400) {
      throw new Error("Authentication failed: Outdated payload");
    }

    // 3. Connect to Supabase using Admin privileges
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Find or Create the User
    // We map Telegram users to a placeholder email domain
    const email = `${user.id}@telegram.local`;
    const tempPassword = crypto.randomUUID(); // Secure, one-time use password

    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const tgUser = existingUsers.users.find(u => u.email === email);

    if (tgUser) {
      // Update their password so the frontend can immediately log in
      await supabaseAdmin.auth.admin.updateUserById(tgUser.id, { password: tempPassword });
    } else {
      // Create new user
      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: user.first_name + (user.last_name ? ` ${user.last_name}` : ''),
          telegram_id: user.id,
          telegram_username: user.username,
          avatar_url: user.photo_url
        }
      });
    }

    // Return the secure credentials to the frontend so it can initiate the session
    return new Response(JSON.stringify({ email, password: tempPassword }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
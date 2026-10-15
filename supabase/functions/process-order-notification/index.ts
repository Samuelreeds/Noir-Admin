import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Ensure you set this secret in your Supabase dashboard later
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const webhookPayload = await req.json();
    const { type, table, record, old_record } = webhookPayload;

    // Initialize Admin Client to bypass RLS for data gathering
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ==========================================
    // 1. RETAIL ORDER CONFIRMATIONS
    // ==========================================
    if (table === 'orders' && type === 'INSERT') {
      let customerEmail = null;
      let customerName = 'Valued Customer';

      // Attempt to extract email from the shipping address JSONB block
      if (record.shipping_address && record.shipping_address.email) {
        customerEmail = record.shipping_address.email;
        customerName = record.shipping_address.name || customerName;
      } 
      // Fallback: Query the profiles table if they are a registered user
      else if (record.user_id) {
        const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', record.user_id).single();
        if (profile?.email) customerEmail = profile.email;
        if (profile?.full_name) customerName = profile.full_name;
      }

      const orderRef = `MA-${record.id.slice(-8).toUpperCase()}`;

      // Dispatch Customer Email via Resend
      if (RESEND_API_KEY && customerEmail) {
        const htmlReceipt = `
          <div style="font-family: monospace; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee;">
            <h2 style="text-transform: uppercase;">NOIR MTD - Order Received</h2>
            <p>Hi ${customerName},</p>
            <p>Thank you for your order! Your reference is <strong>${orderRef}</strong>.</p>
            <div style="background: #f8f9fa; padding: 15px; margin: 20px 0;">
              <p><strong>Grand Total:</strong> $${record.grand_total}</p>
              <p><strong>Status:</strong> ${record.payment_status}</p>
            </div>
            <p>We are currently verifying your payment. You will receive another update once your items are prepared for delivery.</p>
          </div>
        `;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'NOIR MTD Orders <orders@noirmtd.com>', // Update domain once verified in Resend
            to: [customerEmail],
            subject: `Order Confirmation - ${orderRef}`,
            html: htmlReceipt
          })
        });
      }

      // Dispatch Internal Telegram Alert
      await supabaseAdmin.functions.invoke('telegram-notification', {
        body: { message: `🛍️ New Website Order Placed!\nRef: ${orderRef}\nValue: $${record.grand_total}\nStatus: ${record.payment_status}` }
      }).catch(err => console.error('Telegram notification failed:', err));
    }

    // ==========================================
    // 2. B2B QUOTATION APPROVALS
    // ==========================================
    if (table === 'b2b_quotations' && type === 'UPDATE') {
      // Only fire if the status explicitly changed to 'Approved'
      if (record.status === 'Approved' && old_record?.status !== 'Approved') {
        
        // Fetch B2B Company contact details
        const { data: company } = await supabaseAdmin.from('b2b_companies').select('contact_email, company_name').eq('id', record.company_id).single();
        
        if (RESEND_API_KEY && company?.contact_email) {
           const htmlQuote = `
            <div style="font-family: monospace; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee;">
              <h2 style="text-transform: uppercase;">NOIR MTD - Quotation Approved</h2>
              <p>Hi ${company.company_name},</p>
              <p>Your wholesale quotation <strong>${record.quotation_ref || record.id.slice(-8).toUpperCase()}</strong> has been approved.</p>
              <p>Please log in to your B2B portal to review the finalized pricing and convert this quotation into an active order.</p>
            </div>
          `;

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
            body: JSON.stringify({
              from: 'NOIR MTD Wholesale <b2b@noirmtd.com>', 
              to: [company.contact_email],
              subject: `Quotation Approved - NOIR MTD`,
              html: htmlQuote
            })
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Notification Processing Error:', error);
    // Return 200 even on error so Supabase doesn't infinitely retry the webhook
    return new Response(JSON.stringify({ error: 'Notification processing failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    });
  }
})
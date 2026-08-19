import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') 
const TELEGRAM_ORDER_THREAD_ID = Deno.env.get('TELEGRAM_ORDER_THREAD_ID')
const TELEGRAM_TX_THREAD_ID = Deno.env.get('TELEGRAM_TX_THREAD_ID')
const TELEGRAM_CONTACT_THREAD_ID = Deno.env.get('TELEGRAM_CONTACT_THREAD_ID')

serve(async (req) => {
  try {
    const payload = await req.json()
    const table = payload.table
    const type = payload.type
    const record = payload.record
    const oldRecord = payload.old_record

    if (!record) {
      return new Response("No record data found", { status: 400 })
    }

    let message = ""
    let threadId = ""

    // 1. NEW ORDERS (INSERT on orders table)
    if (table === 'orders' && type === 'INSERT') {
      threadId = TELEGRAM_ORDER_THREAD_ID || "";
      message = `
🚨 <b>NEW ORDER RECEIVED!</b> 🚨

<b>Order ID:</b> MA-${record.id.slice(-8).toUpperCase()}
<b>Customer:</b> ${record.shipping_address?.name || 'N/A'}
<b>Phone:</b> ${record.shipping_address?.phone || 'N/A'}
<b>Amount:</b> $${record.grand_total?.toFixed(2) || 0}
<b>Payment:</b> ${record.payment_method?.toUpperCase()}

<a href="https://your-store-url.com/admin/orders">Log in to Dashboard</a> to view details.`;
    }

    // 2. TRANSACTIONS (UPDATE on orders table when receipt URL is added)
    else if (table === 'orders' && type === 'UPDATE') {
      // Only send if the receipt was JUST uploaded (was empty before, but has data now)
      if (record.transaction_receipt_url && (!oldRecord || !oldRecord.transaction_receipt_url)) {
        threadId = TELEGRAM_TX_THREAD_ID || "";
        message = `
💳 <b>NEW PAYMENT RECEIPT UPLOADED!</b> 💳

<b>Order ID:</b> MA-${record.id.slice(-8).toUpperCase()}
<b>Amount:</b> $${record.grand_total?.toFixed(2) || 0}
<b>Status:</b> Needs Verification

<a href="${record.transaction_receipt_url}">🖼️ View Receipt Image</a>

<a href="https://your-store-url.com/admin/orders">Log in to Dashboard</a> to verify and process.`;
      } else {
         return new Response("Update ignored (not a receipt upload)", { status: 200 })
      }
    }

    // 3. CONTACT INQUIRIES (INSERT on contacts table)
    else if (table === 'contacts' && type === 'INSERT') {
      threadId = TELEGRAM_CONTACT_THREAD_ID || "";
      message = `
✉️ <b>NEW CONTACT INQUIRY!</b> ✉️

<b>Name:</b> ${record.name}
<b>Email:</b> ${record.email}
<b>Subject:</b> ${record.subject || 'N/A'}

<b>Message:</b>
${record.message}`;
    }
    
    else {
      return new Response("Event not routed", { status: 200 })
    }

    // Send to Telegram if a message was formatted
    if (message && threadId) {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            message_thread_id: threadId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        })
        const result = await response.json()
        return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } })
    }

    return new Response("No target thread available", { status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
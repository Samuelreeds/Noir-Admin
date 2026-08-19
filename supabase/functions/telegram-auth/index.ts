import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') 
const TELEGRAM_ORDER_THREAD_ID = Deno.env.get('TELEGRAM_ORDER_THREAD_ID') // <-- Grabs the Thread ID

serve(async (req) => {
  try {
    const payload = await req.json()
    const order = payload.record

    if (!order) {
      return new Response("No order data found", { status: 400 })
    }

    // Format the message for Telegram
    const message = `
🚨 <b>NEW ORDER RECEIVED!</b> 🚨

<b>Order ID:</b> MA-${order.id.slice(-8).toUpperCase()}
<b>Customer:</b> ${order.shipping_address?.name || 'N/A'}
<b>Phone:</b> ${order.shipping_address?.phone || 'N/A'}
<b>Amount:</b> $${order.grand_total?.toFixed(2) || 0}
<b>Payment:</b> ${order.payment_method?.toUpperCase()}

<a href="https://your-store-url.com/admin/orders">Log in to Dashboard</a> to view details.
    `;

    // Send the HTTP request to the official Telegram Bot API
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        message_thread_id: TELEGRAM_ORDER_THREAD_ID, // <-- Routes it to the specific Topic!
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    })

    const result = await response.json()
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
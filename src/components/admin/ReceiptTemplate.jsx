// @ts-nocheck
import React from 'react';

export default function ReceiptTemplate({ order }) {
  if (!order) return null;

  const formatDate = (/** @type {string} */ isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div id="print-receipt" className="hidden print:flex flex-col font-mono text-black bg-white box-border w-[80mm] mx-auto text-[11px] leading-snug pb-8">
      <style type="text/css" media="print">
        {`
          @page {
            margin: 0;
            size: 80mm auto; /* Forces 80mm thermal roll width */
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: white !important;
          }
          body * {
            visibility: hidden;
          }
          #print-receipt, #print-receipt * {
            visibility: visible;
          }
          #print-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 4mm; /* Prevents text from hitting the physical paper edge */
            box-sizing: border-box;
            display: flex !important;
            flex-direction: column;
          }
        `}
      </style>

      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-3xl font-black uppercase mb-1 tracking-widest">NOIR</h1>
        <p className="text-[10px] uppercase font-bold">Noir MTD Official</p>
        <p className="text-[10px]">Tel: 096 666-5133</p>
        <p className="text-[10px]">info@noirmtd.com</p>
      </div>

      <div className="border-b-[1.5px] border-dashed border-black mb-3"></div>

      {/* Order Info */}
      <div className="mb-3 space-y-0.5">
        <div className="flex justify-between">
          <span>ORDER:</span>
          <span className="font-bold">#{order.id.slice(-8).toUpperCase()}</span>
        </div>
        <div className="flex justify-between">
          <span>DATE:</span>
          <span>{formatDate(order.created_at)}</span>
        </div>
        <div className="flex justify-between">
          <span>PAYMENT:</span>
          <span className="font-bold uppercase">{order.payment_method === 'cod' ? 'COD' : 'PRE-PAID'}</span>
        </div>
      </div>

      <div className="border-b-[1.5px] border-dashed border-black mb-3"></div>

      {/* Customer Info */}
      <div className="mb-3 space-y-0.5">
        <p className="font-bold uppercase">DELIVER TO:</p>
        <p>{order.shipping_address?.name}</p>
        <p>TEL: {order.shipping_address?.phone}</p>
        <p className="mt-1">{order.shipping_address?.address}, {order.shipping_address?.province}</p>
      </div>

      <div className="border-b-[1.5px] border-dashed border-black mb-3"></div>

      {/* Items List */}
      <div className="mb-3">
        <div className="flex justify-between font-bold mb-2 uppercase border-b border-black pb-1">
          <span>Item</span>
          <span>Total</span>
        </div>
        
        {order.order_items && order.order_items.length > 0 ? (
          order.order_items.map((/** @type {any} */ item) => (
            <div key={item.id} className="mb-2">
              <div className="font-bold truncate">{item.product_name}</div>
              <div className="flex justify-between text-[10px] mt-0.5 text-slate-800">
                <span>{item.quantity} x ${item.unit_price?.toFixed(2)} ({item.selected_color}/{item.selected_size})</span>
                <span className="font-bold">${item.total_price?.toFixed(2)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center italic py-2 text-slate-500">No items found</div>
        )}
      </div>

      <div className="border-b-[1.5px] border-dashed border-black mb-3"></div>

      {/* Totals */}
      <div className="mb-3 space-y-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>${order.subtotal?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Shipping:</span>
          <span>{order.shipping_fee === 0 ? 'Free' : `$${order.shipping_fee?.toFixed(2)}`}</span>
        </div>
        {order.tax > 0 && (
          <div className="flex justify-between">
            <span>Tax:</span>
            <span>${order.tax?.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="border-b-[1.5px] border-dashed border-black mb-2"></div>

      {/* Grand Total */}
      <div className="flex justify-between items-center mb-6 mt-1">
        <span className="font-black text-sm uppercase">Total:</span>
        <span className="font-black text-base">
          {order.currency === 'KHR' ? `${order.grand_total?.toLocaleString()} ៛` : `$${order.grand_total?.toFixed(2)}`}
        </span>
      </div>

      {/* Footer */}
      <div className="text-center mt-4 pt-4 border-t-2 border-black flex flex-col items-center">
        <p className="font-black uppercase tracking-widest text-[13px] mb-1">Thank You</p>
        {/* Placeholder for a Barcode if needed in the future */}
        <div className="w-48 h-8 bg-black my-2 flex items-center justify-center opacity-80" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, white 2px, white 4px)' }}></div>
        <p className="text-[9px] uppercase">Please keep this receipt</p>
      </div>
    </div>
  );
}
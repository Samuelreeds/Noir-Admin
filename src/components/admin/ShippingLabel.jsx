// @ts-nocheck
import React from 'react';

export default function ShippingLabel({ order }) {
  if (!order) return null;

  const formatLabelDate = (/** @type {string} */ isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace(/ /g, '-');
  };

  return (
    <div id="print-label" className="hidden print:flex flex-col font-sans text-black bg-white border-[6px] border-black box-border">
      <style type="text/css" media="print">
        {`
          @page {
            size: 6in 4in landscape;
            margin: 0 !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: white !important;
          }
          
          body * {
            visibility: hidden;
          }
          
          #print-label, #print-label * {
            visibility: visible;
          }
          
          #print-label {
            position: absolute;
            left: 0;
            top: 0;
            width: 6in;
            height: 4in;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column;
          }
        `}
      </style>

      {/* Top Block: Logo & Order Number */}
      <div className="flex border-b-[3px] border-black h-24 shrink-0">
        <div className="w-1/2 p-3 border-r-[3px] border-black flex flex-col justify-center">
          <h1 className="text-4xl font-serif font-black tracking-widest uppercase leading-none mb-1">NOIR</h1>
          <p className="text-[9px] font-bold text-slate-800 leading-tight">
            NOIR MTD OFFICIAL<br/>
            Support: 096 666-5133<br/>
            info@noirmtd.com
          </p>
        </div>
        <div className="w-1/2 p-3 flex flex-col justify-center items-end bg-black text-white">
          <span className="text-[10px] uppercase tracking-widest text-gray-300 font-bold mb-1">Order Number</span>
          <span className="text-xl font-bold tracking-wider">#{order.id.slice(-8).toUpperCase()}</span>
          <span className="text-xs mt-1 font-mono tracking-widest">{formatLabelDate(order.created_at)}</span>
        </div>
      </div>

      {/* Delivery Type Ribbon */}
      <div className="bg-slate-200 border-b-[3px] border-black px-4 py-1 flex justify-between items-center shrink-0">
         <span className="text-xs font-black uppercase tracking-widest">Standard Delivery</span>
         <span className="text-xs font-black uppercase tracking-widest">{order.payment_method === 'cod' ? 'COD' : 'PRE-PAID'}</span>
      </div>

      {/* Middle Block: Ship To Customer */}
      <div className="p-4 border-b-[3px] border-black flex-1 flex flex-col justify-center">
        <h3 className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-500">Deliver To:</h3>
        <h2 className="text-xl font-bold uppercase leading-none mb-2">{order.shipping_address?.name}</h2>
        <p className="text-sm font-medium leading-snug w-full">
          {order.shipping_address?.address}, {order.shipping_address?.province}
        </p>
        <p className="text-base font-bold mt-2 border-l-4 border-black pl-2">
          TEL: {order.shipping_address?.phone}
        </p>
      </div>

      {/* Bottom Block: Packing List & Total */}
      <div className="p-3 shrink-0 flex gap-4 bg-white h-24">
        <div className="flex-1 overflow-hidden">
          <table className="w-full text-[10px] text-left">
             <thead>
               <tr className="border-b border-black">
                 <th className="pb-1 uppercase font-bold text-slate-600">Item</th>
                 <th className="pb-1 uppercase font-bold text-slate-600 text-center w-12">Qty</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200">
               {order.order_items?.length > 0 ? (
                 order.order_items.slice(0, 3).map((/** @type {any} */ item) => (
                   <tr key={item.id}>
                     <td className="py-1 pr-2 truncate max-w-[200px] font-medium">
                       {item.product_name} <span className="text-gray-500 font-normal">({item.selected_color}/{item.selected_size})</span>
                     </td>
                     <td className="py-1 text-center font-bold text-sm">{item.quantity}</td>
                   </tr>
                 ))
               ) : (
                 <tr><td colSpan={2} className="py-1 text-gray-400">No items</td></tr>
               )}
               {order.order_items?.length > 3 && (
                 <tr><td colSpan={2} className="py-1 text-gray-500 text-center italic">+ {order.order_items.length - 3} more items</td></tr>
               )}
             </tbody>
          </table>
        </div>
        
        <div className="w-[120px] border-l-[3px] border-black pl-4 flex flex-col justify-between shrink-0">
           <div>
             <p className="text-[9px] uppercase font-bold text-slate-500">Total Amount</p>
             <p className="text-lg font-black tracking-tight leading-none mt-1">
               {order.currency === 'KHR' ? `${order.grand_total?.toLocaleString()} ៛` : `$${order.grand_total?.toFixed(2)}`}
             </p>
           </div>
           <div className="text-[10px] font-bold text-center mt-2 border-t-2 border-black pt-1 uppercase tracking-widest">
              Thank You
           </div>
        </div>
      </div>
    </div>
  );
}
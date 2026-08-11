import React from "react";

/**
 * @param {{ value: string, height?: number, showText?: boolean }} props
 */
export default function BarcodeSVG({ value, height = 60, showText = true }) {
  if (!value) return null;
  const bars = [];
  let x = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const width = (code % 3) + 1;
    bars.push(<rect key={i} x={x} y={0} width={width} height={height} fill="#050505" />);
    x += width + (code % 2);
  }
  return (
    <div className="inline-flex flex-col items-center">
      <svg width={x} height={height} viewBox={`0 0 ${x} ${height}`} className="block">
        {bars}
      </svg>
      {showText && <p className="font-mono text-[10px] tracking-[0.2em] mt-1">{value}</p>}
    </div>
  );
}
import React from "react";

export interface FigmaDiamondShadowProps {
  className?: string;
  opacity?: number;
}

/**
 * SVG exacto proporcionado desde Figma (Nodo 7:60)
 */
export const FigmaDiamondShadow: React.FC<FigmaDiamondShadowProps> = ({
  className = "",
  opacity = 1,
}) => {
  return (
    <svg
      className={`w-full h-full pointer-events-none select-none ${className}`}
      width="1434"
      height="998"
      viewBox="0 0 1434 998"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity }}
    >
      <g clipPath="url(#paint0_diamond_7_60_clip_path)" data-figma-skip-parse="true">
        <g transform="matrix(0 0.515 -0.726 0 726 515)">
          <rect
            x="0"
            y="0"
            width="1001.94"
            height="1001.38"
            fill="url(#paint0_diamond_7_60)"
            opacity="0.15"
            shapeRendering="crispEdges"
          />
          <rect
            x="0"
            y="0"
            width="1001.94"
            height="1001.38"
            transform="scale(1 -1)"
            fill="url(#paint0_diamond_7_60)"
            opacity="0.15"
            shapeRendering="crispEdges"
          />
          <rect
            x="0"
            y="0"
            width="1001.94"
            height="1001.38"
            transform="scale(-1 1)"
            fill="url(#paint0_diamond_7_60)"
            opacity="0.15"
            shapeRendering="crispEdges"
          />
          <rect
            x="0"
            y="0"
            width="1001.94"
            height="1001.38"
            transform="scale(-1)"
            fill="url(#paint0_diamond_7_60)"
            opacity="0.15"
            shapeRendering="crispEdges"
          />
        </g>
      </g>
      <rect
        width="1452"
        height="1030"
        fill="none"
        data-figma-gradient-fill='{"type":"GRADIENT_DIAMOND","stops":[{"color":{"r":0.83137255907058716,"g":0.82352942228317261,"b":0.85490196943283081,"a":1.0},"position":0.0},{"color":{"r":0.035294119268655777,"g":0.031372550874948502,"b":0.047058824449777603,"a":1.0},"position":1.0}],"transform":{"m00":8.8909362185897456e-14,"m01":-1452.0,"m02":1452.0,"m10":1030.0,"m11":6.3069314311034463e-14,"m12":-6.3069314311034463e-14},"opacity":0.15000000596046448,"blendMode":"NORMAL","stopsVar":[{"color":{"r":0.83137255907058716,"g":0.82352942228317261,"b":0.85490196943283081,"a":1.0},"position":0.0},{"color":{"r":0.035294119268655777,"g":0.031372550874948502,"b":0.047058824449777603,"a":1.0},"position":1.0}],"visible":true}'
      />
      <defs>
        <clipPath id="paint0_diamond_7_60_clip_path">
          <rect width="1452" height="1030" />
        </clipPath>
        <linearGradient
          id="paint0_diamond_7_60"
          x1="0"
          y1="0"
          x2="500"
          y2="500"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#D4D2DA" />
          <stop offset="1" stopColor="#09080C" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default FigmaDiamondShadow;

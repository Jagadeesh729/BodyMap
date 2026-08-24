import React from 'react'

interface BodyMapLogoProps {
  className?: string
  iconSize?: number
  showText?: boolean
  variant?: 'horizontal' | 'icon-only' | 'stacked'
}

export const BodyMapLogo: React.FC<BodyMapLogoProps> = ({
  className = '',
  iconSize = 32,
  showText = true,
  variant = 'horizontal',
}) => {
  const icon = (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-300 group-hover:scale-105"
      aria-hidden="true"
    >
      <rect width="100" height="100" rx="28" fill="#0B1F3A" />
      {/* Dynamic Base Mapping Circle */}
      <circle
        cx="50"
        cy="50"
        r="32"
        stroke="#22C55E"
        strokeWidth="3.5"
        opacity="0.85"
      />
      {/* Dynamic Diagonal Orbital Ring */}
      <ellipse
        cx="50"
        cy="48"
        rx="36"
        ry="18"
        transform="rotate(-35 50 48)"
        stroke="url(#orbitGrad)"
        strokeWidth="4"
        fill="none"
      />
      {/* Ascending Human Silhouette */}
      <circle cx="50" cy="37" r="4.5" fill="#22C55E" />
      <path
        d="M48 43 C43 45, 36 49, 35 52 C42 50, 47 48, 49 53 C50 56, 48 60, 44 67 C42 70, 37 77, 36 79 C42 74, 46 68, 48 64 C51 60, 56 65, 59 71 C61 68, 64 63, 64 61 C61 58, 56 55, 54 52 C53 49, 56 42, 62 26 C61 31, 58 37, 54 41 C52 42, 50 42, 48 43 Z"
        fill="url(#bodyGrad)"
      />
      <defs>
        <linearGradient id="orbitGrad" x1="14" y1="30" x2="86" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FF88" />
          <stop offset="0.5" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#00A7A0" />
        </linearGradient>
        <linearGradient id="bodyGrad" x1="35" y1="26" x2="64" y2="79" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FF88" />
          <stop offset="1" stopColor="#00A7A0" />
        </linearGradient>
      </defs>
    </svg>
  )

  if (!showText || variant === 'icon-only') {
    return <div className={`inline-flex items-center ${className}`}>{icon}</div>
  }

  if (variant === 'stacked') {
    return (
      <div className={`inline-flex flex-col items-center gap-2 group ${className}`}>
        {icon}
        <span className="text-xl font-poppins font-bold tracking-wide">
          <span className="text-white">BODY</span>
          <span className="text-neon-green">MAP</span>
        </span>
      </div>
    )
  }

  return (
    <div className={`inline-flex items-center gap-2.5 group ${className}`}>
      {icon}
      <span className="text-2xl font-poppins font-bold tracking-tight">
        <span className="text-white transition-colors duration-200 group-hover:text-electric-purple">
          BODY
        </span>
        <span className="text-neon-green transition-colors duration-200 group-hover:text-cyan-400">
          MAP
        </span>
      </span>
    </div>
  )
}

export default BodyMapLogo

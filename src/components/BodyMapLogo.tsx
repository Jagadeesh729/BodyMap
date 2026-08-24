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
      <rect width="100" height="100" rx="22" fill="#0B1F3A" />
      {/* Outer Orbit Mapping Rings */}
      <circle
        cx="50"
        cy="50"
        r="34"
        stroke="#00FF88"
        strokeWidth="2.5"
        strokeDasharray="6 3"
        opacity="0.6"
      />
      <ellipse
        cx="50"
        cy="55"
        rx="38"
        ry="16"
        stroke="#22D3EE"
        strokeWidth="2"
        opacity="0.8"
      />
      <ellipse
        cx="50"
        cy="45"
        rx="38"
        ry="16"
        stroke="#00A7A0"
        strokeWidth="2"
        opacity="0.7"
      />
      {/* Biometric Data Nodes */}
      <circle cx="50" cy="16" r="3.5" fill="#00FF88" />
      <circle cx="88" cy="50" r="3.5" fill="#22D3EE" />
      <circle cx="12" cy="50" r="3.5" fill="#00FF88" />
      <circle cx="50" cy="84" r="3.5" fill="#22D3EE" />
      <circle cx="78" cy="30" r="2.5" fill="#00FF88" />
      <circle cx="22" cy="30" r="2.5" fill="#22D3EE" />
      {/* Anatomical Head Node */}
      <circle cx="50" cy="32" r="7.5" fill="#00FF88" />
      {/* Torso Silhouette with Gradient */}
      <path
        d="M38 46 C42 43, 58 43, 62 46 C66 49, 68 56, 67 68 C64 74, 61 77, 56 77 C55 70, 54 62, 50 62 C46 62, 45 70, 44 77 C39 77, 36 74, 33 68 C32 56, 34 49, 38 46 Z"
        fill="url(#logoTorsoGrad)"
        opacity="0.95"
      />
      <defs>
        <linearGradient id="logoTorsoGrad" x1="50" y1="43" x2="50" y2="77" gradientUnits="userSpaceOnUse">
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

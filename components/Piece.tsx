import React from 'react';
import { PieceType, PieceColor } from '../types';

interface PieceProps {
  type: PieceType;
  color: PieceColor;
  className?: string;
}

const Piece: React.FC<PieceProps> = ({ type, color, className = "" }) => {
  const isWhite = color === 'w';
  const fill = isWhite ? "#ffffff" : "#1a1a1a";
  const stroke = isWhite ? "#000000" : "#ffffff";
  const strokeW = 2.4; // Ajustado para el estilo icónico de la referencia

  // Base exacta basada en la referencia del caballo
  const CommonBase = () => (
    <g>
      {/* Collar superior */}
      <rect x="11" y="32" width="23" height="3" rx="0.5" fill={fill} stroke={stroke} strokeWidth={strokeW} />
      {/* Cuerpo medio bulboso */}
      <path d="M9 35 C9 35 7 36.5 7 38.5 C7 40.5 9 41.5 9 41.5 L36 41.5 C36 41.5 38 40.5 38 38.5 C38 36.5 36 35 36 35 Z" fill={fill} stroke={stroke} strokeWidth={strokeW} />
      {/* Base plana final */}
      <rect x="7" y="41.5" width="31" height="2.5" fill={fill} stroke={stroke} strokeWidth={strokeW} />
    </g>
  );

  const pieces: Record<PieceType, React.ReactElement> = {
    p: (
      <g>
        {/* Head with highlight */}
        <circle cx="22.5" cy="11" r="8" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        <path d="M25.5 8 C27.5 10 27.5 13 25.5 15" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        
        {/* Neck collar */}
        <rect x="14" y="19" width="17" height="4" rx="2" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        
        {/* Main Body - Concave flared */}
        <path 
          d="M22.5 23 C19 23 15 28 15 35 L30 35 C30 28 26 23 22.5 23 Z" 
          fill={fill} stroke={stroke} strokeWidth={strokeW} 
        />
        
        {/* Tiered Base specifically for Pawn to match reference image exactly */}
        <path d="M10 35 C10 35 7.5 36.5 7.5 39 C7.5 41.5 10 42.5 10 42.5 L35 42.5 C35 42.5 37.5 41.5 37.5 39 C37.5 36.5 35 35 35 35 Z" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        <rect x="7.5" y="42.5" width="30" height="2.5" rx="0.5" fill={fill} stroke={stroke} strokeWidth={strokeW} />
      </g>
    ),
    r: (
      <g>
        <path d="M13 8 L13 14 L32 14 L32 8 L28 8 L28 11 L25 11 L25 8 L20 8 L20 11 L17 11 L17 8 Z" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        <path d="M22.5 14 C18 14 16 19 16 32 L29 32 C29 19 27 14 22.5 14 Z" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        <CommonBase />
      </g>
    ),
    n: (
      <g>
        {/* Cuerpo y cabeza del caballo siguiendo la silueta de la imagen */}
        <path 
          d="M22 32 C22 28 20 23 20 18 C20 14 23 11 26 9 C28 8 31 8 32 10 L33 8 L35 11 L37 9 L38 12 L39 16 L40 21 L38 28 L37 32" 
          fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" 
        />
        
        {/* Perfil del hocico y parte frontal */}
        <path 
          d="M26 9 C22 10 17 13 14 18 C11 23 12 26 14 28 C15 29 17 29 19 27 C20 26 21 24 21 24" 
          fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" 
        />

        {/* Crines dentadas (escalones en la parte trasera) */}
        <path d="M32 10 L37 13 M33 15 L38 18 M34 20 L39 23 M35 25 L40 28" stroke={stroke} strokeWidth={strokeW} strokeLinecap="round" />

        {/* Ojo inclinado exacto */}
        <path d="M19 17 L21.5 20" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        
        {/* Detalle de la boca */}
        <path d="M13 25 C14 26 15 25.5 15.5 24.5" fill="none" stroke={stroke} strokeWidth={strokeW} strokeLinecap="round" />
        
        {/* Oreja puntiaguda */}
        <path d="M25 9 L24 6 L22 8.5" fill={fill} stroke={stroke} strokeWidth={strokeW} />

        <CommonBase />
      </g>
    ),
    b: (
      <g>
        <path d="M22.5 6.5 C22.5 6.5 16 10 16 16 C16 19 18 21 22.5 21 C27 21 29 19 29 16 C29 10 22.5 6.5 22.5 6.5 Z" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        <circle cx="22.5" cy="5" r="1.5" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        <path d="M25 10 L20 15" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        <path d="M22.5 21 C18 21 15 25 15 32 L30 32 C30 25 27 21 22.5 21 Z" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        <CommonBase />
      </g>
    ),
    q: (
      <g>
        <path d="M14 14 L10 8 L17 11 L22.5 5 L28 11 L35 8 L31 14 Z" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        <circle cx="10" cy="7.5" r="1.2" fill={fill} stroke={stroke} strokeWidth="1" />
        <circle cx="22.5" cy="4.5" r="1.2" fill={fill} stroke={stroke} strokeWidth="1" />
        <circle cx="35" cy="7.5" r="1.2" fill={fill} stroke={stroke} strokeWidth="1" />
        <path d="M22.5 14 C18 14 15 20 15 32 L30 32 C30 20 27 14 22.5 14 Z" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        <CommonBase />
      </g>
    ),
    k: (
      <g>
        <path d="M22.5 2 L22.5 8 M19.5 5 L25.5 5" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M14 15 L22.5 9 L31 15 L22.5 21 Z" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        <path d="M22.5 21 C18 21 15 25 15 32 L30 32 C30 25 27 21 22.5 21 Z" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        <CommonBase />
      </g>
    )
  };

  return (
    <svg viewBox="0 0 45 45" className={`w-full h-full drop-shadow-sm ${className}`}>
      {pieces[type]}
    </svg>
  );
};

export default Piece;
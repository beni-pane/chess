export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

export interface Square {
  type: PieceType;
  color: PieceColor;
}

export interface GameState {
  fen: string;
  isGameOver: boolean;
  isCheckmate: boolean;
  winner: PieceColor | 'draw' | null;
  history: string[];
  capturedWhite: PieceType[];
  capturedBlack: PieceType[];
  turn: PieceColor;
}

export interface Move {
  from: string;
  to: string;
  promotion?: string;
}
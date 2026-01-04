import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chess, Square as ChessSquare } from 'chess.js';
import Piece from './components/Piece';
import { getGeminiMove, getPositionAnalysis } from './services/geminiChessAi';
import { GameState, PieceColor, PieceType } from './types';

const TIME_OPTIONS = [
  { label: 'Sin Reloj', value: 0 },
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
];

const App: React.FC = () => {
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [aiMode, setAiMode] = useState<'none' | 'black' | 'white'>('black');
  
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string, to: string } | null>(null);

  const [initialTime, setInitialTime] = useState(0);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);

  const [gameStatus, setGameStatus] = useState<GameState>({
    fen: '',
    isGameOver: false,
    isCheckmate: false,
    winner: null,
    history: [],
    capturedWhite: [],
    capturedBlack: [],
    turn: 'w'
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  const updateGameStatus = useCallback((chess: Chess, timeOutWinner?: PieceColor) => {
    const history = chess.history();
    const fen = chess.fen();
    const isGameOver = chess.isGameOver() || !!timeOutWinner;
    const isCheckmate = chess.isCheckmate();
    let winner: PieceColor | 'draw' | null = timeOutWinner || null;
    
    if (!winner) {
      if (isCheckmate) winner = chess.turn() === 'w' ? 'b' : 'w';
      else if (isGameOver) winner = 'draw';
    }

    const board = chess.board();
    const capturedWhite: PieceType[] = [];
    const capturedBlack: PieceType[] = [];
    
    const pieces = { w: { p: 8, n: 2, b: 2, r: 2, q: 1 }, b: { p: 8, n: 2, b: 2, r: 2, q: 1 } };
    board.flat().forEach(sq => {
      if (sq && sq.type !== 'k') pieces[sq.color][sq.type]--;
    });
    (['p', 'n', 'b', 'r', 'q'] as PieceType[]).forEach(t => {
      for (let i = 0; i < pieces.w[t]; i++) capturedWhite.push(t);
      for (let i = 0; i < pieces.b[t]; i++) capturedBlack.push(t);
    });

    setGameStatus({ fen, isGameOver, isCheckmate, winner, history, capturedWhite, capturedBlack, turn: chess.turn() });
  }, []);

  const makeMove = useCallback((move: string | { from: string; to: string; promotion?: string }) => {
    try {
      const gameCopy = new Chess(game.fen());
      const result = gameCopy.move(move);
      if (result) {
        setGame(gameCopy);
        updateGameStatus(gameCopy);
        setSelectedSquare(null);
        setValidMoves([]);
        setPendingPromotion(null);
        if (initialTime > 0) setIsTimerActive(true);
        return true;
      }
    } catch (e) {
      console.error("Invalid move:", move);
    }
    return false;
  }, [game, updateGameStatus, initialTime]);

  useEffect(() => {
    if (initialTime > 0 && isTimerActive && !gameStatus.isGameOver) {
      timerRef.current = window.setInterval(() => {
        if (game.turn() === 'w') {
          setWhiteTime(t => (t <= 1 ? (updateGameStatus(game, 'b'), 0) : t - 1));
        } else {
          setBlackTime(t => (t <= 1 ? (updateGameStatus(game, 'w'), 0) : t - 1));
        }
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [initialTime, isTimerActive, gameStatus.isGameOver, game, updateGameStatus]);

  const handleSquareClick = (square: string) => {
    if (gameStatus.isGameOver || isAiThinking || pendingPromotion) return;
    const piece = game.get(square as ChessSquare);
    
    if (selectedSquare && validMoves.includes(square)) {
      const movingPiece = game.get(selectedSquare as ChessSquare);
      const isPromotion = 
        movingPiece?.type === 'p' && 
        ((movingPiece.color === 'w' && square[1] === '8') || 
         (movingPiece.color === 'b' && square[1] === '1'));

      if (isPromotion) {
        setPendingPromotion({ from: selectedSquare, to: square });
        return;
      }
      makeMove({ from: selectedSquare, to: square });
      return;
    }

    if (piece && piece.color === game.turn()) {
      const isAiTurn = (aiMode === 'black' && game.turn() === 'b') || (aiMode === 'white' && game.turn() === 'w');
      if (isAiTurn) return; // No permitir que el humano mueva las piezas de la IA

      if (selectedSquare === square) {
        setSelectedSquare(null);
        setValidMoves([]);
      } else {
        setSelectedSquare(square);
        setValidMoves(game.moves({ square: square as ChessSquare, verbose: true }).map(m => m.to));
      }
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  const resetGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    updateGameStatus(newGame);
    setWhiteTime(initialTime);
    setBlackTime(initialTime);
    setIsTimerActive(false);
    setSelectedSquare(null);
    setValidMoves([]);
    setAnalysis("");
    setPendingPromotion(null);
  };

  useEffect(() => {
    if (gameStatus.isGameOver) return;
    const isAiTurn = (aiMode === 'black' && game.turn() === 'b') || (aiMode === 'white' && game.turn() === 'w');
    if (isAiTurn && !isAiThinking) {
      const triggerAi = async () => {
        setIsAiThinking(true);
        const legal = game.moves();
        if (legal.length === 0) return setIsAiThinking(false);
        try {
          const move = await getGeminiMove(game.fen(), gameStatus.history, legal);
          makeMove(move);
        } catch (error) {
          makeMove(legal[0]);
        } finally {
          setIsAiThinking(false);
        }
      };
      const t = setTimeout(triggerAi, 300);
      return () => clearTimeout(t);
    }
  }, [gameStatus.fen, aiMode]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const renderBoard = () => {
    const squares = [];
    const board = game.board();
    const lastMove = game.history({ verbose: true }).slice(-1)[0];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const squareName = `${String.fromCharCode(97 + c)}${8 - r}`;
        const isDark = (r + c) % 2 === 1;
        const piece = board[r][c];
        const isSelected = selectedSquare === squareName;
        const isValidMove = validMoves.includes(squareName);
        const isHighlight = lastMove && (lastMove.from === squareName || lastMove.to === squareName);

        squares.push(
          <div key={squareName} onClick={() => handleSquareClick(squareName)}
            className={`relative aspect-square flex items-center justify-center cursor-pointer transition-colors ${isDark ? 'bg-zinc-800' : 'bg-zinc-300'} ${isSelected ? 'bg-yellow-400/50 ring-2 ring-yellow-400 z-10' : ''} ${isHighlight && !isSelected ? 'bg-yellow-100/20' : ''} ${isValidMove ? 'after:content-[""] after:w-3 after:h-3 after:bg-green-500/50 after:rounded-full after:absolute' : ''}`}>
            {piece && <div className="w-[85%] h-[85%]"><Piece type={piece.type} color={piece.color} /></div>}
            {c === 0 && <span className={`absolute top-0.5 left-0.5 text-[8px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{8 - r}</span>}
            {r === 7 && <span className={`absolute bottom-0.5 right-0.5 text-[8px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{String.fromCharCode(97 + c)}</span>}
          </div>
        );
      }
    }
    return squares;
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 max-w-7xl mx-auto">
      <header className="w-full flex flex-col md:flex-row justify-between items-center mb-6 gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><i className="fa-solid fa-chess-knight text-xl text-white"></i></div>
          <h1 className="text-xl font-bold text-white tracking-tight">Gemini Chess <span className="text-indigo-400 font-normal">Flash</span></h1>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {/* Selector de Tiempo */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            {TIME_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => { setInitialTime(opt.value); setWhiteTime(opt.value); setBlackTime(opt.value); resetGame(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${initialTime === opt.value ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Selector de IA */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button onClick={() => setAiMode('none')} className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all ${aiMode === 'none' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-400'}`}>PvP</button>
            <button onClick={() => setAiMode('white')} className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all ${aiMode === 'white' ? 'bg-white text-black' : 'text-zinc-500 hover:text-zinc-400'}`}>IA Blancas</button>
            <button onClick={() => setAiMode('black')} className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all ${aiMode === 'black' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-400'}`}>IA Negras</button>
          </div>
        </div>
      </header>

      <main className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
          {initialTime > 0 && (
            <div className={`p-6 rounded-2xl border transition-all ${game.turn() === 'b' ? 'bg-zinc-900 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-zinc-900/40 border-zinc-800 opacity-60'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-zinc-500 text-[10px] uppercase font-bold">Negras</span>
                {aiMode === 'black' && <span className="text-[8px] bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-300">IA</span>}
              </div>
              <div className={`text-4xl font-mono font-bold ${blackTime < 20 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{formatTime(blackTime)}</div>
            </div>
          )}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 min-h-[100px]">
            <h2 className="text-zinc-600 text-[10px] uppercase font-bold mb-2">Capturadas</h2>
            <div className="flex flex-wrap gap-1">
              {gameStatus.capturedWhite.map((t, i) => <div key={i} className="w-5 h-5 opacity-40"><Piece type={t} color="w" /></div>)}
            </div>
          </div>
          <button onClick={async () => { setIsAiThinking(true); setAnalysis(await getPositionAnalysis(game.fen())); setIsAiThinking(false); }}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
            <i className="fa-solid fa-wand-magic-sparkles"></i> Análisis Instantáneo
          </button>
          {analysis && <p className="text-zinc-400 text-[10px] italic p-3 bg-zinc-900 rounded-xl border border-zinc-800 leading-relaxed">{analysis}</p>}
        </div>

        <div className="lg:col-span-6 flex flex-col items-center order-1 lg:order-2">
          <div className="w-full max-w-[500px] aspect-square bg-zinc-900 border-4 border-zinc-900 rounded-lg shadow-2xl relative overflow-hidden ring-1 ring-white/5">
            {isAiThinking && (
              <div className="absolute top-2 right-2 z-50 bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-bold animate-pulse shadow-xl flex items-center gap-2">
                <i className="fa-solid fa-bolt text-[8px]"></i> IA PENSANDO
              </div>
            )}
            
            <div className="grid grid-cols-8 grid-rows-8 w-full h-full">{renderBoard()}</div>

            {pendingPromotion && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-700 shadow-2xl max-w-[80%] text-center">
                  <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Promocionar a:</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {(['q', 'r', 'b', 'n'] as PieceType[]).map((type) => (
                      <button key={type} onClick={() => makeMove({ ...pendingPromotion, promotion: type })}
                        className="w-16 h-16 bg-zinc-800 hover:bg-indigo-600 rounded-2xl p-2 transition-all hover:scale-110 active:scale-90 flex items-center justify-center">
                        <Piece type={type} color={game.turn()} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {gameStatus.isGameOver && (
              <div className="absolute inset-0 bg-zinc-950/95 z-[60] flex items-center justify-center p-8 text-center animate-in fade-in duration-300">
                <div className="space-y-6">
                  {gameStatus.isCheckmate ? (
                    <div className="space-y-2">
                      <h2 className="text-5xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(99,102,241,0.6)] animate-pulse">CHECK MATE</h2>
                      <div className="w-24 h-1 bg-indigo-500 mx-auto rounded-full"></div>
                    </div>
                  ) : (
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight">Fin de Partida</h2>
                  )}
                  
                  <p className="text-indigo-400 font-bold uppercase tracking-widest text-sm">
                    {gameStatus.winner === 'draw' ? "Tablas / Empate" : `Ganador: ${gameStatus.winner === 'w' ? 'Blancas' : 'Negras'}`}
                  </p>
                  
                  <button onClick={resetGame} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95">
                    Reiniciar Partida
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4 order-3">
          {initialTime > 0 && (
            <div className={`p-6 rounded-2xl border transition-all ${game.turn() === 'w' ? 'bg-zinc-900 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-zinc-900/40 border-zinc-800 opacity-60'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-zinc-500 text-[10px] uppercase font-bold">Blancas</span>
                {aiMode === 'white' && <span className="text-[8px] bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-300">IA</span>}
              </div>
              <div className={`text-4xl font-mono font-bold ${whiteTime < 20 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{formatTime(whiteTime)}</div>
            </div>
          )}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl h-[250px] overflow-hidden flex flex-col">
            <div className="p-3 border-b border-zinc-800 text-[10px] text-zinc-500 uppercase font-bold flex justify-between">
              <span>Movimientos</span>
              <span className="text-zinc-700">{Math.ceil(gameStatus.history.length / 2)}</span>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 text-[11px] space-y-1">
              {gameStatus.history.map((m, i) => i % 2 === 0 && (
                <div key={i} className="flex justify-between py-1 border-b border-zinc-800/20">
                  <span className="text-zinc-700 w-6 font-mono">{Math.floor(i/2) + 1}.</span>
                  <span className="font-bold text-zinc-300 flex-1">{m}</span>
                  <span className="font-bold text-zinc-300 flex-1">{gameStatus.history[i+1] || ''}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { const gc = new Chess(game.fen()); gc.undo(); if(aiMode !== 'none') gc.undo(); setGame(gc); updateGameStatus(gc); }} 
              className="flex-1 py-3 bg-zinc-800 text-zinc-400 rounded-xl hover:text-white transition-all border border-transparent hover:border-zinc-700 shadow-lg">
              <i className="fa-solid fa-rotate-left"></i>
            </button>
            <button onClick={resetGame} 
              className="flex-1 py-3 bg-zinc-800 text-zinc-400 rounded-xl hover:text-white transition-all border border-transparent hover:border-zinc-700 shadow-lg">
              <i className="fa-solid fa-sync"></i>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chess, Square as ChessSquare } from 'chess.js';
import Piece from './components/Piece';
import { getGeminiMove, getPositionAnalysis } from './services/geminiChessAi';
import { GameState, PieceColor, PieceType } from './types';

const TIME_OPTIONS = [
  { label: 'Sin Reloj', value: 0 },
  { label: '3m', value: 180 },
  { label: '5m', value: 300 },
  { label: '10m', value: 600 },
];

const App: React.FC = () => {
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [aiMode, setAiMode] = useState<'none' | 'black' | 'white'>('black');
  const [copySuccess, setCopySuccess] = useState(false);
  
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
    (['p', 'n', 'b', 'r', 'q'] as const).forEach(t => {
      for (let i = 0; i < pieces.w[t as keyof typeof pieces.w]; i++) capturedWhite.push(t);
      for (let i = 0; i < pieces.b[t as keyof typeof pieces.b]; i++) capturedBlack.push(t);
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
      if (isAiTurn) return;

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

  const copyFen = () => {
    navigator.clipboard.writeText(game.fen());
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
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
            className={`relative aspect-square flex items-center justify-center cursor-pointer transition-all duration-200 ${isDark ? 'bg-zinc-800' : 'bg-zinc-300'} ${isSelected ? 'bg-indigo-500/50 ring-2 ring-indigo-400 z-10 scale-95' : ''} ${isHighlight && !isSelected ? 'bg-yellow-100/10' : ''} ${isValidMove ? 'after:content-[""] after:w-3 after:h-3 after:bg-green-500/40 after:rounded-full after:absolute hover:bg-zinc-500/20' : ''}`}>
            {piece && <div className="w-[85%] h-[85%] transition-transform active:scale-90"><Piece type={piece.type} color={piece.color} /></div>}
            {c === 0 && <span className={`absolute top-0.5 left-0.5 text-[7px] font-bold ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>{8 - r}</span>}
            {r === 7 && <span className={`absolute bottom-0.5 right-0.5 text-[7px] font-bold ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>{String.fromCharCode(97 + c)}</span>}
          </div>
        );
      }
    }
    return squares;
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 animate-in fade-in duration-700">
      <header className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)] text-2xl">♞</div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">BENICIO'S CHESS</h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Live Gemini AI Engine</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <div className="glass p-1 rounded-xl flex items-center gap-1">
            {TIME_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => { setInitialTime(opt.value); setWhiteTime(opt.value); setBlackTime(opt.value); resetGame(); }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${initialTime === opt.value ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {opt.label}
              </button>
            ))}
          </div>

          <div className="glass p-1 rounded-xl flex items-center gap-1">
            <button onClick={() => setAiMode('none')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiMode === 'none' ? 'bg-indigo-600 text-white' : 'text-zinc-500'}`}>PvP</button>
            <button onClick={() => setAiMode('white')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiMode === 'white' ? 'bg-white text-black' : 'text-zinc-500'}`}>IA Blanca</button>
            <button onClick={() => setAiMode('black')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiMode === 'black' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>IA Negra</button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Panel Izquierdo */}
        <div className="lg:col-span-3 space-y-6 order-2 lg:order-1">
          {initialTime > 0 && (
            <div className={`glass p-6 rounded-3xl border-l-4 transition-all ${game.turn() === 'b' ? 'border-indigo-500 shadow-xl' : 'border-transparent opacity-40'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-500 text-[10px] font-black uppercase">Negras</span>
                {aiMode === 'black' && <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded text-[8px] font-bold">CPU</span>}
              </div>
              <div className={`text-4xl font-mono font-bold tracking-tighter ${blackTime < 20 && initialTime > 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{formatTime(blackTime)}</div>
            </div>
          )}
          
          <div className="glass rounded-3xl p-5 border border-white/5">
            <h2 className="text-zinc-500 text-[9px] font-black uppercase mb-4 tracking-widest">Cementerio</h2>
            <div className="flex flex-wrap gap-1 min-h-[40px]">
              {gameStatus.capturedWhite.map((t, i) => <div key={i} className="w-5 h-5 opacity-30 hover:opacity-100 transition-opacity"><Piece type={t} color="w" /></div>)}
            </div>
          </div>

          <button onClick={async () => { setIsAiThinking(true); setAnalysis(await getPositionAnalysis(game.fen())); setIsAiThinking(false); }}
            className="w-full py-4 glass hover:bg-indigo-600/20 text-indigo-400 border-indigo-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3">
            <span>✨</span> Analizar Posición
          </button>
          
          {analysis && <p className="text-zinc-400 text-[11px] leading-relaxed p-4 glass rounded-2xl border border-white/5 italic">{analysis}</p>}
        </div>

        {/* Tablero Central */}
        <div className="lg:col-span-6 flex flex-col items-center order-1 lg:order-2">
          <div className="w-full max-w-[540px] aspect-square bg-zinc-900 border-[8px] border-zinc-900 rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative overflow-hidden group">
            {isAiThinking && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-5 py-1.5 rounded-full text-[9px] font-black tracking-[0.2em] shadow-2xl animate-bounce">
                GEMINI PENSANDO...
              </div>
            )}
            
            <div className="grid grid-cols-8 grid-rows-8 w-full h-full">{renderBoard()}</div>

            {/* Promoción */}
            {pendingPromotion && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md">
                <div className="glass p-8 rounded-3xl border border-white/10 shadow-2xl text-center">
                  <h3 className="text-white font-black mb-6 text-xs uppercase tracking-[0.3em]">Promoción</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {(['q', 'r', 'b', 'n'] as PieceType[]).map((type) => (
                      <button key={type} onClick={() => makeMove({ ...pendingPromotion, promotion: type })}
                        className="w-20 h-20 glass hover:bg-indigo-600 rounded-2xl p-3 transition-all hover:scale-105 active:scale-90 flex items-center justify-center">
                        <Piece type={type} color={game.turn()} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Fin de Juego */}
            {gameStatus.isGameOver && (
              <div className="absolute inset-0 bg-zinc-950/90 z-[60] flex items-center justify-center p-8 text-center animate-in zoom-in duration-500">
                <div className="space-y-8">
                  {gameStatus.isCheckmate ? (
                    <div className="space-y-2">
                      <h2 className="text-6xl font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(99,102,241,0.8)]">CHECK MATE</h2>
                      <div className="w-32 h-1.5 bg-indigo-500 mx-auto rounded-full"></div>
                    </div>
                  ) : (
                    <h2 className="text-4xl font-black text-white uppercase tracking-tight">Game Over</h2>
                  )}
                  
                  <div className="px-6 py-2 bg-zinc-900 rounded-full border border-white/5 inline-block">
                    <p className="text-indigo-400 font-black uppercase tracking-widest text-[10px]">
                      {gameStatus.winner === 'draw' ? "Tablas" : `Victoria: ${gameStatus.winner === 'w' ? 'Blancas' : 'Negras'}`}
                    </p>
                  </div>
                  
                  <button onClick={resetGame} className="block mx-auto px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95">
                    Nueva Batalla
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex gap-4">
             <button onClick={copyFen} className={`text-[10px] font-black uppercase tracking-widest transition-all ${copySuccess ? 'text-green-500' : 'text-zinc-600 hover:text-zinc-400'}`}>
               <span className="mr-2">{copySuccess ? '✓' : '📋'}</span> 
               {copySuccess ? 'Copiado' : 'Copiar FEN'}
             </button>
          </div>
        </div>

        {/* Panel Derecho */}
        <div className="lg:col-span-3 space-y-6 order-3">
          {initialTime > 0 && (
            <div className={`glass p-6 rounded-3xl border-l-4 transition-all ${game.turn() === 'w' ? 'border-indigo-500 shadow-xl' : 'border-transparent opacity-40'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-500 text-[10px] font-black uppercase">Blancas</span>
                {aiMode === 'white' && <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded text-[8px] font-bold">CPU</span>}
              </div>
              <div className={`text-4xl font-mono font-bold tracking-tighter ${whiteTime < 20 && initialTime > 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{formatTime(whiteTime)}</div>
            </div>
          )}
          
          <div className="glass rounded-3xl h-[320px] overflow-hidden flex flex-col border border-white/5">
            <div className="p-4 border-b border-white/5 text-[9px] text-zinc-500 font-black uppercase tracking-widest flex justify-between items-center">
              <span>Historial</span>
              <span className="bg-zinc-800 px-2 py-0.5 rounded text-white">{Math.ceil(gameStatus.history.length / 2)}</span>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 text-[11px] font-mono space-y-2">
              {gameStatus.history.map((m, i) => i % 2 === 0 && (
                <div key={i} className="flex justify-between py-1.5 border-b border-white/5 items-center">
                  <span className="text-zinc-700 w-8">{Math.floor(i/2) + 1}.</span>
                  <span className="font-bold text-indigo-400 flex-1">{m}</span>
                  <span className="font-bold text-zinc-400 flex-1">{gameStatus.history[i+1] || '...'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { const gc = new Chess(game.fen()); gc.undo(); if(aiMode !== 'none') gc.undo(); setGame(gc); updateGameStatus(gc); }} 
              className="flex-1 py-4 glass text-zinc-400 rounded-2xl hover:text-white hover:bg-zinc-800 transition-all">
              <span>↶</span>
            </button>
            <button onClick={resetGame} 
              className="flex-1 py-4 glass text-zinc-400 rounded-2xl hover:text-white hover:bg-zinc-800 transition-all">
              <span>🗑️</span>
            </button>
          </div>
        </div>
      </main>

      <footer className="mt-16 text-[9px] text-zinc-600 font-bold uppercase tracking-[0.4em] opacity-40">
        Grandmaster Edition &bull; Powered by Google Gemini
      </footer>
    </div>
  );
};

export default App;
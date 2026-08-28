import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Trophy, 
  RotateCcw, 
  Play, 
  CheckCircle2, 
  PawPrint,
  Clock,
  Zap,
  XCircle,
  Clock as ClockIcon,
  Timer,
  Volume2,
  VolumeX,
  LayoutGrid,
  ShoppingBasket
} from 'lucide-react';
import fixedBannerAsset from "@/assets/banner-promo.png.asset.json";
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from "@/integrations/supabase/client";
import { AuthScreen } from './components/auth/AuthScreen';
import { AdminScreen } from './components/admin/AdminScreen';
import { DogFoodGame } from './components/DogFoodGame';
import { BasketCatcherGame } from './components/BasketCatcherGame';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import JogoCesta from './pages/JogoCesta';
import { Toaster } from 'sonner';
import { useAudioManager } from './hooks/useAudioManager';
import { BannerCarousel } from './components/BannerCarousel';
import { PRODUCT_ASSETS } from './lib/productAssets';
import OfflineHome from './pages/tablet-offline/OfflineHome';
import OfflineRegister from './pages/tablet-offline/OfflineRegister';

import OfflineCatchGame from './pages/tablet-offline/OfflineCatchGame';
import OfflineValidatePrize from './pages/tablet-offline/OfflineValidatePrize';
import BarGame from './pages/BarGame';
import BhaskarAdmin from './pages/BhaskarAdmin';
import CuteFantasyGame from './pages/CuteFantasyGame';
import AdminRelatorioOffline from './pages/AdminRelatorioOffline';
import { OFFLINE_MEMORY_PRODUCTS } from './pages/tablet-offline/offlineAssets';
import { MobileOfflineAuth } from './components/auth/MobileOfflineAuth';
import { installMobileSync, setCurrentParticipantId } from './lib/mobileOfflineDb';
import { Capacitor } from '@capacitor/core';

const isMobileView = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;

// Configuração da Marca RobustUS
const BRAND = {
  name: "RobustUS",
  primary: "#0047ab",
  orange: "var(--robustus-orange)",
  white: "#ffffff",
  darkBlue: "#003380",
};

const ASSETS = {
  bgHero: "/brand/bg-home-v2.jpg",
  logo: "/brand/robustus-laranja.png",
  banner: fixedBannerAsset.url,
  paw: "/brand/robustus-laranja.png",
};

const PRODUCTS = [
  { id: 1, name: 'Life Special Filhote', line: 'Cão Filhote', img: 'https://robustus.com.br/wp-content/uploads/2025/10/DASDASDAS-768x633.png', packageImg: OFFLINE_MEMORY_PRODUCTS[0].img },
  { id: 2, name: 'Adulto Mini e Pequeno', line: 'Cão Adulto', img: 'https://robustus.com.br/wp-content/uploads/2025/10/cao-mini-768x633.png', packageImg: OFFLINE_MEMORY_PRODUCTS[1].img },
  { id: 3, name: 'Adulto Médio e Grande', line: 'Cão Adulto', img: 'https://robustus.com.br/wp-content/uploads/2025/10/cao-ADULTO-768x633.png', packageImg: OFFLINE_MEMORY_PRODUCTS[2].img },
  { id: 4, name: 'Gato Castrado', line: 'Life Special', img: 'https://robustus.com.br/wp-content/uploads/2025/10/sdsadasdas-1-768x633.png', packageImg: OFFLINE_MEMORY_PRODUCTS[3].img },
  { id: 5, name: 'Gato Adulto', line: 'Life Special', img: 'https://robustus.com.br/wp-content/uploads/2025/10/DASDASDAS-2-768x633.png', packageImg: OFFLINE_MEMORY_PRODUCTS[4].img },
];

type GameState = 'START' | 'AUTH' | 'PLAYING' | 'VICTORY' | 'GAMEOVER' | 'ADMIN' | 'ERROR';

interface Card {
  instanceId: number;
  productId: number;
  name: string;
  line: string;
  img: string;
  packageImg: string;
  isFlipped: boolean;
  isMatched: boolean;
}

interface PlaySession {
  play_id: string;
  play_token: string;
  max_attempts: number;
  max_seconds: number;
}

interface LeaderboardEntry {
  rank_position: number;
  name: string;
  cpf_masked: string;
  time_seconds: number;
  attempts_used: number;
  prize_code: string;
  won_at: string;
}

const Leaderboard = ({ entries, loading }: { entries: LeaderboardEntry[], loading?: boolean }) => {
  if (loading) {
    return (
      <div className="leaderboard-container flex flex-col items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-[#0047ab] border-t-transparent rounded-full animate-spin mb-2"></div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carregando placar...</p>
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="leaderboard-container text-center py-4">
        <h3 className="leaderboard-title">Melhores tempos</h3>
        <p className="text-[10px] font-bold text-[var(--robustus-orange)] uppercase tracking-widest mt-2">Seja o primeiro no placar!</p>
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      <h3 className="leaderboard-title">Melhores tempos</h3>
      <p className="leaderboard-subtitle">Menor tempo e menos tentativas</p>
      <div className="space-y-1">
        {entries.slice(0, 5).map((entry, idx) => (
          <div key={idx} className="leaderboard-row">
            <span className="leaderboard-pos">{entry.rank_position}º</span>
            <span className="leaderboard-name">{entry.name || 'Anônimo'}</span>
            <div className="leaderboard-stats">
              <span className="leaderboard-time">{entry.time_seconds}s</span>
              <span className="mx-1 text-slate-300">•</span>
              <span>{entry.attempts_used} tent.</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const GameContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState>('START');
  const [selectedGame, setSelectedGame] = useState<'memoria' | 'cesta' | null>(null);
  const { isMuted, toggleMute, playSound, startBackgroundMusic, stopBackgroundMusic, initAudio } = useAudioManager();
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [prizeCode, setPrizeCode] = useState('');
  const [lockBoard, setLockBoard] = useState(false);
  const [matches, setMatches] = useState(0);
  
  // Estados da Sessão
  const [session, setSession] = useState<PlaySession | null>(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [error, setError] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const adminPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startAdminPress = () => {
    if (gameState !== 'START') return;
    if (adminPressTimer.current) clearTimeout(adminPressTimer.current);
    adminPressTimer.current = setTimeout(() => {
      navigate('/admin/relatorio-offline');
    }, 2200);
  };

  const cancelAdminPress = () => {
    if (!adminPressTimer.current) return;
    clearTimeout(adminPressTimer.current);
    adminPressTimer.current = null;
  };

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const { data, error: rpcError } = await (supabase.rpc as any)("get_memory_leaderboard", {
        p_event_slug: "robustus-expo-2026",
        p_limit: 5
      });
      
      if (!rpcError && data) {
        setLeaderboard(data);
      }
    } catch (err) {
      console.error("Erro ao buscar placar:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    if (gameState === 'VICTORY' || gameState === 'GAMEOVER') {
      fetchLeaderboard();
    }
  }, [gameState]);

  // Fase de Memorização
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewCountdown, setPreviewCountdown] = useState(4);
  const [gameStarted, setGameStarted] = useState(false);

  // Verificar rota de admin
  useEffect(() => {
    // Adiciona classe para o modo totem se não estiver no admin
    if (location.pathname !== '/validar-brinde') {
      document.documentElement.classList.add('totem-mode');
    } else {
      document.documentElement.classList.remove('totem-mode');
    }
  }, [location.pathname]);

  const initializeGame = (sessionData: any) => {
    if (selectedGame === 'cesta') {
      navigate('/jogo-cesta', { state: { session: sessionData } });
      return;
    }
    const playSession: PlaySession = {
      play_id: sessionData.play_id,
      play_token: sessionData.play_token,
      max_attempts: sessionData.max_attempts || 20,
      max_seconds: sessionData.max_seconds || 60
    };

    const gameCards: Card[] = [...PRODUCTS, ...PRODUCTS].map((product, index) => ({
      ...product,
      instanceId: index,
      productId: product.id,
      isFlipped: false,
      isMatched: false,
    }));

    setSession(playSession);
    setCards(gameCards.sort(() => Math.random() - 0.5));
    setFlippedCards([]);
    setMatches(0);
    setAttemptsUsed(0);
    setTimeLeft(playSession.max_seconds);
    setLockBoard(true);
    setIsPreviewing(true);
    setPreviewCountdown(4);
    setGameStarted(false);
    setGameState('PLAYING');
    initAudio();
    startBackgroundMusic();
  };

  // Timer de Memorização
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (gameState === 'PLAYING' && isPreviewing && previewCountdown > 0) {
      timer = setInterval(() => {
        setPreviewCountdown(prev => {
          if (prev <= 1) {
            setIsPreviewing(false);
            setGameStarted(true);
            setLockBoard(false);
            setFlippedCards([]);
            setStartTime(Date.now());
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState, isPreviewing, previewCountdown]);

  // Timer do jogo
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (gameState === 'PLAYING' && gameStarted && !isPreviewing && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleGameOver('time');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState, gameStarted, isPreviewing, timeLeft]);

  const handleGameOver = async (reason: 'time' | 'attempts' | 'won') => {
    if (gameState !== 'PLAYING') return;
    setLockBoard(true);
    
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const playId = session?.play_id;
    const playToken = session?.play_token;
    
    // Garantir que enviamos 5 se for vitória, mesmo que o estado 'matches' ainda não tenha atualizado
    const finalPairsFound = reason === 'won' ? 5 : matches;

    try {
      console.log("CALLING FINISH_PLAY WITH:", {
        p_play_id: playId,
        p_play_token: playToken,
        p_pairs_found: finalPairsFound,
        p_attempts_used: attemptsUsed,
        p_client_time_seconds: elapsedSeconds
      });

      const { data, error: rpcError } = await (supabase.rpc as any)("finish_play", {
        p_play_id: playId,
        p_play_token: playToken,
        p_pairs_found: finalPairsFound,
        p_attempts_used: attemptsUsed,
        p_client_time_seconds: elapsedSeconds
      });

      console.log("FINISH_PLAY_DATA:", data);
      console.error("FINISH_PLAY_ERROR:", rpcError);

      if (rpcError) {
        setError("Não foi possível finalizar a jogada. Chame a equipe do stand.");
        setGameState("ERROR");
        return;
      }

      if (!data?.ok) {
        setError(data?.message || "Não foi possível finalizar a jogada.");
        setGameState("ERROR");
        return;
      }

      if (data.result === "won" && data.prize_code) {
        setPrizeCode(data.prize_code);
        setGameState("VICTORY");
        stopBackgroundMusic();
        playSound('victory-applause');
        confetti({
          particleCount: 200,
          spread: 80,
          origin: { y: 0.5 },
          colors: [BRAND.primary, BRAND.orange, BRAND.white]
        });
        return;
      }

      if (data.result === "lost") {
        console.log("Motivo da derrota:", {
          pairs_found: data.pairs_found,
          attempts_used: data.attempts_used,
          time_seconds: data.time_seconds,
          max_attempts: data.max_attempts,
          max_seconds: data.max_seconds
        });
        setGameState("GAMEOVER");
        stopBackgroundMusic();
        playSound('lost');
        return;
      }

      setError("Não foi possível gerar seu código. Chame a equipe do stand.");
      setGameState("ERROR");
    } catch (err) {
      console.error("Erro crítico ao finalizar:", err);
      setError("Não foi possível gerar seu código. Chame a equipe do stand.");
      setGameState("ERROR");
    }
  };

  const handleCardClick = (instanceId: number) => {
    if (lockBoard || gameState !== 'PLAYING' || isPreviewing || !gameStarted) return;
    const card = cards.find(c => c.instanceId === instanceId);
    if (!card || card.isFlipped || card.isMatched) return;

    playSound('flip');

    const newCards = cards.map(c => 
      c.instanceId === instanceId ? { ...c, isFlipped: true } : c
    );
    setCards(newCards);

    const newFlipped = [...flippedCards, instanceId];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setLockBoard(true);
      
      const [firstId, secondId] = newFlipped;
      const firstCard = cards.find(c => c.instanceId === firstId)!;
      const secondCard = newCards.find(c => c.instanceId === secondId)!;
      
      const newAttempts = attemptsUsed + 1;
      setAttemptsUsed(newAttempts);

      if (firstCard.productId === secondCard.productId) {
        setTimeout(() => {
          const updatedCards = newCards.map(c => 
            c.productId === firstCard.productId ? { ...c, isMatched: true } : c
          );
          setCards(updatedCards);
          const newMatches = matches + 1;
          setMatches(newMatches);
          playSound('applause');
          setFlippedCards([]);
          setLockBoard(false);
          
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 },
            colors: [BRAND.primary, BRAND.orange, BRAND.white]
          });

          if (newMatches === PRODUCTS.length) {
            handleGameOver('won');
          }
        }, 600);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            c.instanceId === firstId || c.instanceId === secondId ? { ...c, isFlipped: false } : c
          ));
          playSound('crowd-ahh');
          setFlippedCards([]);
          setLockBoard(false);

          if (session && newAttempts >= session.max_attempts) {
            handleGameOver('attempts');
          }
        }, 1000);
      }
    }
  };

  // Auto-reset após vitória ou derrota
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (gameState === 'VICTORY' || gameState === 'GAMEOVER') {
      timer = setTimeout(() => {
        setGameState('START');
        setSession(null);
      }, gameState === 'VICTORY' ? 20000 : 15000);
    }
    return () => clearTimeout(timer);
  }, [gameState]);

  // A rota /validar-brinde agora é tratada diretamente no App.tsx
  // para evitar o container do totem e seus estilos restritivos.

  return (
    <div className="totem-wrapper">
      <div className={`totem-container flex flex-col items-center justify-start relative select-none shadow-2xl overflow-x-hidden ${gameState === 'PLAYING' ? 'overflow-hidden' : 'overflow-y-auto'}`} style={{ '--robustus-orange': BRAND.orange } as any}>
      
      {/* Background Container */}
      <div className="absolute inset-0 z-0">
        {(gameState === 'START' || gameState === 'AUTH') ? (
          <div className="w-full h-full relative overflow-hidden">
            <img 
              src={ASSETS.bgHero} 
              alt="Hero" 
              className="absolute inset-0 w-full h-full object-cover object-center" 
              draggable={false}
            />
          </div>
        ) : (
          <div className="absolute inset-0 bg-[#0047ab]">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0056cf] via-[#0047ab] to-[#003380]"></div>
            <div className="absolute inset-0 bg-paw-pattern opacity-[0.06]"></div>
            <div className="absolute top-[-15%] left-[-25%] w-[150%] h-[50%] bg-blue-400/10 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-[-20%] right-[-25%] w-[150%] h-[60%] bg-orange-400/5 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-0 left-0 w-full h-[40%] bg-white/5 clip-path-ellipse"></div>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {gameState === 'START' && (
          <motion.div key="start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 w-full flex flex-col items-center justify-center pt-[10vh] px-4 z-10 overflow-hidden relative">
            
            {/* Container: JOGAR e Logo Admin alinhados e centralizados */}
            <div 
              className="absolute z-50 flex items-center justify-center gap-[80px] pointer-events-none"
              style={{ left: '49%', top: '72%', transform: 'translateX(-50%)' }}
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  initAudio();
                  navigate('/tablet-offline/jogo-cesta');
                }}
                className="text-white text-base font-black italic tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all cursor-pointer px-4 py-2 pointer-events-auto"
              >
                JOGAR
              </motion.button>

              <div
                onPointerDown={startAdminPress}
                onPointerUp={cancelAdminPress}
                onPointerCancel={cancelAdminPress}
                onPointerLeave={cancelAdminPress}
                className="w-20 sm:w-28 hover:scale-105 transition-transform cursor-pointer pointer-events-auto mt-[6px]"
              >
                <img
                  src={ASSETS.logo}
                  alt="Admin"
                  className="w-full h-auto object-contain pointer-events-none"
                  draggable={false}
                />
              </div>
            </div>

            <AnimatePresence>
              {loadingLeaderboard || leaderboard.length > 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: 20 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                  onClick={() => { setLeaderboard([]); setLoadingLeaderboard(false); }}
                >
                  <div 
                    className="bg-white rounded-[2rem] p-6 w-full max-w-[400px] shadow-2xl border-t-[8px] border-[#f7941d]"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-black text-[#0047ab] uppercase italic">Placar</h2>
                      <button onClick={() => { setLeaderboard([]); setLoadingLeaderboard(false); }} className="p-2 text-slate-400 hover:text-slate-600">
                        <RotateCcw className="w-6 h-6" />
                      </button>
                    </div>
                    <Leaderboard entries={leaderboard} loading={loadingLeaderboard} />
                    <button 
                      onClick={() => { setLeaderboard([]); setLoadingLeaderboard(false); }}
                      className="w-full mt-4 bg-[#0047ab] text-white py-3 rounded-xl font-black uppercase italic"
                    >
                      Fechar
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        )}

        {gameState === 'AUTH' && (
          isMobileView() && selectedGame === 'cesta' ? (
            <MobileOfflineAuth
              key="mobile-auth"
              game="cesta"
              onClose={() => setGameState('START')}
              onStart={({ participantId }) => {
                setCurrentParticipantId(participantId);
                initializeGame({ participantId });
              }}
            />
          ) : (
            <AuthScreen key="auth" onStart={initializeGame} onClose={() => setGameState('START')} />
          )
        )}


        {gameState === 'PLAYING' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="game-screen z-10">
            {/* Header Compacto - Ocultar na memorização para liberar espaço */}
            {!isPreviewing ? (
              <div className="game-header">
                <div className="w-full flex flex-col gap-1 sm:gap-4">
                  <div className="flex justify-between items-center gap-3">
                    <div className="bg-white p-1.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg border border-[#f7941d] w-20 sm:w-40">
                      <img src={ASSETS.logo} className="w-full h-auto object-contain" alt="Logo" />
                    </div>
                    
                    <div className="flex-1 flex justify-center items-center gap-2 sm:gap-4">
                      <div className="bg-white/15 backdrop-blur-md px-3 py-1 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2 text-white border border-white/20">
                        <Timer className="w-4 h-4 sm:w-6 sm:h-6 text-[#f7941d]" />
                        <span className="text-base sm:text-2xl font-black">{timeLeft}s</span>
                      </div>
                      
                      <div className="hidden sm:flex bg-white/15 backdrop-blur-md px-4 py-2 rounded-xl items-center gap-2 text-white border border-white/20">
                        <Zap className="w-5 h-5 text-[#f7941d]" />
                        <span className="text-xl font-black">{session ? session.max_attempts - attemptsUsed : 0}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={toggleMute} 
                        className="p-1.5 sm:p-3 bg-white/15 backdrop-blur-md rounded-xl text-white border border-white/20"
                        aria-label={isMuted ? "Ativar som" : "Desativar som"}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4 sm:w-6 sm:h-6" /> : <Volume2 className="w-4 h-4 sm:w-6 sm:h-6" />}
                      </button>
                      <button onClick={() => { setGameState('START'); stopBackgroundMusic(); }} className="p-1.5 sm:p-3 bg-white/15 backdrop-blur-md rounded-xl text-white border border-white/20">
                        <RotateCcw className="w-4 h-4 sm:w-6 sm:h-6" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-white/95 backdrop-blur-md p-1.5 sm:p-4 rounded-xl sm:rounded-3xl border sm:border-2 border-[#f7941d] shadow-xl w-full">
                    <div className="flex justify-between items-center px-2 mb-1">
                      <div className="flex items-center gap-2">
                         <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase italic">Pares:</span>
                         <span className="text-xs sm:text-xl font-black text-[#0047ab]">{matches} / 5</span>
                      </div>
                      <div className="flex items-center gap-2 sm:hidden">
                         <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase italic">Chances:</span>
                         <span className="text-xs font-black text-[#f7941d]">{session ? session.max_attempts - attemptsUsed : 0}</span>
                      </div>
                      <div className="hidden sm:block h-3 bg-slate-100 rounded-full overflow-hidden flex-1 mx-4 p-0.5 border border-slate-200">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(matches / 5) * 100}%` }} className="h-full bg-gradient-to-r from-[#f7941d] to-[#ffb85f] rounded-full" />
                      </div>
                    </div>
                    <div className="sm:hidden h-1.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(matches / 5) * 100}%` }} className="h-full bg-gradient-to-r from-[#f7941d] to-[#ffb85f] rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="game-header flex justify-between items-center py-2 px-2">
                <div className="bg-white p-1.5 rounded-xl shadow-lg border border-[#f7941d] w-20">
                  <img src={ASSETS.logo} className="w-full h-auto object-contain" alt="Logo" />
                </div>
                <div className="bg-[#f7941d] px-4 py-2 rounded-2xl shadow-xl border-2 border-white flex items-center gap-3">
                  <span className="text-sm font-black text-white uppercase italic">Memorize os produtos</span>
                  <span className="text-2xl font-black text-white">{previewCountdown}</span>
                </div>
              </div>
            )}

            {/* Board */}
            <div className="memory-board">
              {cards.map((card) => (
                <div key={card.instanceId} onClick={() => handleCardClick(card.instanceId)} className="memory-card">
                  <div className="card-inner" style={{ transform: isPreviewing || card.isFlipped || card.isMatched ? 'rotateY(180deg)' : 'rotateY(0deg)', transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                    <div className="card-back bg-[#0047ab] border-2 sm:border-4 border-white/40 flex flex-col items-center justify-center shadow-lg">
                       <div className="absolute inset-0 bg-paw-pattern opacity-10"></div>
                       <div className="w-8 h-8 sm:w-16 sm:h-16 bg-white/10 rounded-full flex items-center justify-center relative z-10 border border-white/20">
                          <img src={ASSETS.paw} className="w-4 h-4 sm:w-8 sm:h-8 brightness-0 invert opacity-60" alt="" />
                       </div>
                    </div>
                      <div className={`card-front memory-card-front bg-white border-2 sm:border-4 shadow-lg flex flex-col items-center justify-between transition-all duration-300 ${card.isMatched ? 'border-[#f7941d] bg-orange-50' : 'border-white'}`} style={{ transform: 'rotateY(180deg)' }}>
                        {card.isMatched && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-[#f7941d] text-white p-0.5 sm:p-1 rounded-full shadow-lg z-[2] border border-white"><CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" /></motion.div>}
                        <div className="memory-card-image-wrap w-full h-full min-h-0 flex items-center justify-center relative bg-slate-50 rounded-md sm:rounded-xl p-0.5 sm:p-1 overflow-hidden">
                          <img src={card.packageImg} alt={card.name} className="memory-card-img memory-card-img-mobile max-w-full max-h-full w-auto h-auto object-contain sm:hidden" />
                          <img src={card.img} alt={card.name} className="memory-card-img memory-card-img-desktop max-w-full max-h-full w-auto h-auto object-contain hidden sm:block" />
                        </div>
                        <div className="memory-card-text w-full text-center hidden sm:flex flex-col items-center">
                          <span className="product-badge inline-block px-1.5 py-0.5 bg-[#0047ab] rounded-full font-black text-white uppercase italic tracking-widest mb-0.5">{card.line}</span>
                          <h4 className="product-name font-black text-[#003380] uppercase italic">{card.name}</h4>
                        </div>
                      </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {gameState === 'VICTORY' && (
          <motion.div key="victory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="victory-screen">
            <div className="victory-card bg-white/95 backdrop-blur-3xl rounded-[2rem] sm:rounded-[3rem] shadow-[0_25px_50px_rgba(0,0,0,0.4)] border-t-[8px] sm:border-t-[12px] border-[#f7941d]">
              <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 12 }} transition={{ type: "spring", damping: 12, delay: 0.2 }} className="absolute -top-6 sm:-top-10 right-4 bg-[#f7941d] p-3 sm:p-5 rounded-xl sm:rounded-2xl shadow-xl border-2 sm:border-4 border-white">
                <Trophy className="w-8 h-8 sm:w-12 sm:h-12 text-white" />
              </motion.div>
              
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <h2 className="text-4xl sm:text-6xl font-black text-[#0047ab] leading-none tracking-tighter uppercase italic drop-shadow-lg">PARABÉNS!</h2>
                <div className="bg-[#f7941d] inline-block px-4 py-1.5 sm:px-8 sm:py-2 rounded-full border-2 sm:border-4 border-white shadow-lg rotate-[-1deg]">
                   <p className="text-sm sm:text-xl font-black text-white uppercase tracking-wider italic">VOCÊ GANHOU UM BRINDE!</p>
                </div>
              </div>

              <div className="bg-[#0047ab]/5 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 w-full border-2 border-dashed border-[#0047ab]/20 mb-4 sm:mb-6 shadow-inner">
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-2">Código para retirar seu brinde:</p>
                <div className="bg-white px-3 py-4 rounded-xl sm:rounded-2xl shadow-lg border-2 border-[#0047ab] flex items-center justify-center w-full min-h-[70px] sm:min-h-[100px]">
                  <span className="font-black text-[#0047ab] uppercase leading-[1.05] tracking-[0.04em] text-center w-full" style={{ 
                    fontSize: 'clamp(18px, 4.5vw, 32px)',
                    whiteSpace: 'pre-line',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word'
                  }}>
                    {prizeCode?.replace("ROBUSTUS-", "ROBUSTUS\n")}
                  </span>
                </div>
              </div>

              <Leaderboard entries={leaderboard} loading={loadingLeaderboard} />

              <div className="mt-6 sm:mt-8 w-full flex justify-center">
                <motion.button 
                  whileTap={{ scale: 0.96 }} 
                  onClick={() => { setGameState('START'); setSession(null); setPrizeCode(""); setLeaderboard([]); }} 
                  className="play-again-button bg-[#f7941d] shadow-xl font-black text-white uppercase italic tracking-widest border-b-[4px] sm:border-b-[6px] border-[#d47a00]"
                >
                  <RotateCcw /> JOGAR NOVAMENTE
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="victory-screen">
            <div className="victory-card bg-white/95 backdrop-blur-3xl rounded-[2rem] sm:rounded-[3rem] shadow-[0_25px_50px_rgba(0,0,0,0.4)] border-t-[8px] sm:border-t-[12px] border-red-500">
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <XCircle className="w-16 h-16 sm:w-24 sm:h-24 text-red-500 mx-auto" />
                <h2 className="text-4xl sm:text-6xl font-black text-[#0047ab] leading-none tracking-tighter uppercase italic">POXA!</h2>
                <p className="text-xl sm:text-2xl font-bold text-slate-500 uppercase tracking-widest italic leading-tight">NÃO FOI DESSA VEZ...</p>
              </div>
              
              <p className="text-sm sm:text-base text-slate-400 font-bold uppercase mb-4 italic">OBRIGADO POR PARTICIPAR!</p>

              <Leaderboard entries={leaderboard} loading={loadingLeaderboard} />

              <div className="mt-6 sm:mt-8 w-full flex justify-center">
                <motion.button 
                  whileTap={{ scale: 0.96 }} 
                  onClick={() => { setGameState('START'); setSession(null); setPrizeCode(""); setLeaderboard([]); }} 
                  className="play-again-button bg-slate-200 shadow-lg font-black text-slate-500 uppercase italic tracking-widest border-b-[4px] sm:border-b-[6px] border-slate-300"
                >
                  <RotateCcw /> TENTAR DE NOVO
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
        
        {gameState === 'ERROR' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="victory-screen">
            <div className="victory-card bg-white/95 backdrop-blur-3xl rounded-[2rem] sm:rounded-[3rem] shadow-[0_25px_50px_rgba(0,0,0,0.4)] border-t-[8px] sm:border-t-[12px] border-red-500">
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <XCircle className="w-16 h-16 sm:w-24 sm:h-24 text-red-500 mx-auto" />
                <h2 className="text-3xl sm:text-5xl font-black text-[#0047ab] leading-none tracking-tighter uppercase italic">AVISO</h2>
                <p className="text-lg sm:text-xl font-bold text-slate-500 uppercase tracking-widest leading-tight">{error}</p>
              </div>
              <div className="mt-6 sm:mt-8 w-full flex justify-center">
                <motion.button 
                  whileTap={{ scale: 0.96 }} 
                  onClick={() => { setGameState('START'); setSession(null); setPrizeCode(""); setLeaderboard([]); }} 
                  className="play-again-button bg-slate-200 shadow-lg font-black text-slate-500 uppercase italic tracking-widest border-b-[4px] sm:border-b-[6px] border-slate-300"
                >
                  <RotateCcw /> VOLTAR AO INÍCIO
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-2 sm:bottom-4 z-10 opacity-30 flex items-center gap-1.5 sm:gap-3 text-[#0047ab]">
        <PawPrint className="w-3 h-3 sm:w-5 sm:h-5" />
        <span className="text-[10px] sm:text-base font-black tracking-widest uppercase italic whitespace-nowrap">RobustUS Nutrição Animal</span>
      </div>
      </div>
    </div>
  );
};

const App = () => {
  useEffect(() => {
    // Inicia o sincronizador local-first para a versão mobile
    try { installMobileSync(); } catch {}
  }, []);
  return (
    <BrowserRouter>
        <Routes>
          <Route path="/" element={Capacitor.isNativePlatform() ? <BarGame /> : <GameContent />} />
          <Route path="/validar-brinde" element={<AdminScreen />} />
          <Route path="/admin/relatorio-offline" element={<AdminRelatorioOffline />} />
          <Route path="/cachorro-racao" element={<DogFoodGame />} />
          <Route path="/cesta-robustus" element={<BasketCatcherGame />} />
          <Route path="/jogo-cesta" element={<JogoCesta />} />
          {/* Versão TABLET OFFLINE — totalmente isolada, sem Supabase */}
          <Route path="/tablet-offline" element={<OfflineHome />} />
          <Route path="/tablet-offline/cadastro" element={<OfflineRegister />} />
          
          <Route path="/tablet-offline/jogo-cesta" element={<OfflineCatchGame />} />
          <Route path="/tablet-offline/validar-brinde" element={<OfflineValidatePrize />} />
          <Route path="/bar-game" element={<BarGame />} />
          <Route path="/bar-game/admin" element={<BhaskarAdmin />} />
          <Route path="/cute-fantasy" element={<CuteFantasyGame />} />
        </Routes>
      <Toaster position="top-center" richColors />
    </BrowserRouter>
  );
};

export default App;

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Users, Play, Plus, X, RotateCcw, Heart } from "lucide-react";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Space Background Component
const SpaceBackground = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-black"></div>
      {/* Stars */}
      <div className="absolute inset-0 opacity-50">
        {[...Array(100)].map((_, i) => {
          const size = Math.random() * 2 + 1;
          const left = Math.random() * 100;
          const top = Math.random() * 100;
          const animationDuration = Math.random() * 3 + 2;
          const animationDelay = Math.random() * 5;
          return (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: size,
                height: size,
                left: `${left}%`,
                top: `${top}%`,
              }}
              animate={{
                opacity: [0.2, 1, 0.2],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: animationDuration,
                delay: animationDelay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </div>
      {/* Nebulas */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-fuchsia-600/10 blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px]"></div>
    </div>
  );
};

export default function App() {
  const [gameState, setGameState] = useState<"setup" | "playing">("setup");
  const [players, setPlayers] = useState<string[]>([""]);
  // Record history by player or combination key
  const [askedQuestions, setAskedQuestions] = useState<Record<string, string[]>>({});
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddPlayer = () => {
    if (players.length < 10) {
      setPlayers([...players, ""]);
    }
  };

  const handleRemovePlayer = (index: number) => {
    const newPlayers = [...players];
    newPlayers.splice(index, 1);
    if (newPlayers.length === 0) {
      newPlayers.push("");
    }
    setPlayers(newPlayers);
  };

  const handlePlayerChange = (index: number, value: string) => {
    const newPlayers = [...players];
    newPlayers[index] = value;
    setPlayers(newPlayers);
  };

  const startGame = () => {
    const validPlayers = players.filter((p) => p.trim() !== "");
    if (validPlayers.length === 0) {
      setError("少なくとも1人のプレイヤー名を入力してください。");
      return;
    }
    setPlayers(validPlayers);
    setGameState("playing");
    setAskedQuestions({});
    setError(null);
    generateNextQuestion(validPlayers, {});
  };

  const generateNextQuestion = async (
    currentPlayers: string[],
    history: Record<string, string[]>,
  ) => {
    setIsGenerating(true);
    setError(null);

    try {
      // Determine number of targets
      let targetCount = 1;
      if (currentPlayers.length >= 2) {
        // 30% chance for 2 players
        if (Math.random() < 0.3) {
          targetCount = 2;
        }
      }

      // Select random players
      const shuffled = [...currentPlayers].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, targetCount);
      setSelectedPlayers(selected);
      
      // Create a key for the selected player(s) to track their specific history
      const historyKey = selected.sort().join(" & ");
      const playerHistory = history[historyKey] || [];

      // Generate prompt
      let prompt = `あなたは恋愛トークゲームの魅力的な司会者です。
以下の条件に従って、恋愛に関する質問を1つだけ生成してください。

【条件】
- 質問の対象人数: ${targetCount}人 (${targetCount === 1 ? "1人に向けて答えてもらう質問" : "2人に向けて、お互いのことや共通のテーマについて答えてもらう質問"})
- 質問の長さ: 1文字〜90文字程度で簡潔に。
- 最終的に聞きたいことは1つだけにする。
- 内容: 「好きなタイプは？」のような王道から、「もし〇〇な状況ならどうする？」のような少しマニアックなものまで様々。
- 過去に出題された質問と被らないようにする。
- 出力は質問のテキストのみにしてください。余計な挨拶や記号は不要です。`;

      if (targetCount === 2) {
        const isDating = Math.random() < 0.2; // 20% chance for dating assumption
        if (isDating) {
          prompt += `\n- 2人への質問の前提: 「もし2人が付き合っていたら」という前提で、少しドキッとするような質問にしてください。`;
        } else {
          prompt += `\n- 2人への質問の前提: 2人は「付き合っていない」前提で、あくまでパーティーゲームとして盛り上がるような、お互いの印象や恋愛観に関する質問にしてください。`;
        }
      }

      prompt += `\n\n【過去の質問】\n${playerHistory.length > 0 ? playerHistory.map((q, i) => `${i + 1}. ${q}`).join("\n") : "なし"}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          temperature: 0.9,
        },
      });

      let questionText =
        response.text?.trim() ||
        "質問の生成に失敗しました。もう一度お試しください。";

      // Clean up potential quotes
      if (questionText.startsWith('"') && questionText.endsWith('"')) {
        questionText = questionText.slice(1, -1);
      }
      if (questionText.startsWith("「") && questionText.endsWith("」")) {
        questionText = questionText.slice(1, -1);
      }

      setCurrentQuestion(questionText);
      
      // Update history for this specific player or combination
      setAskedQuestions({
        ...history,
        [historyKey]: [...playerHistory, questionText]
      });
    } catch (err) {
      console.error("Error generating question:", err);
      setError("質問の生成中にエラーが発生しました。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNext = () => {
    generateNextQuestion(players, askedQuestions);
  };

  const endGame = () => {
    setGameState("setup");
    setCurrentQuestion(null);
    setSelectedPlayers([]);
    setAskedQuestions([]);
  };

  return (
    <div className="min-h-screen text-slate-100 font-sans selection:bg-fuchsia-500/30">
      <SpaceBackground />

      <main className="container mx-auto px-4 py-12 max-w-4xl min-h-screen flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {gameState === "setup" ? (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600 mb-4 shadow-lg shadow-fuchsia-500/20">
                  <Heart className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-indigo-400">
                  Cosmic Love Talk
                </h1>
                <p className="text-slate-400 mt-2 text-sm">
                  星降る夜の、秘密の恋愛トーク
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    プレイヤー ({players.length}/10)
                  </span>
                </div>

                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                  <AnimatePresence>
                    {players.map((player, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={player}
                          onChange={(e) =>
                            handlePlayerChange(index, e.target.value)
                          }
                          placeholder={`プレイヤー ${index + 1}`}
                          className="flex-1 bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition-all"
                          maxLength={15}
                        />
                        {players.length > 1 && (
                          <button
                            onClick={() => handleRemovePlayer(index)}
                            className="p-3 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {players.length < 10 && (
                  <button
                    onClick={handleAddPlayer}
                    className="w-full py-3 flex items-center justify-center gap-2 text-sm text-fuchsia-400 hover:text-fuchsia-300 hover:bg-fuchsia-400/10 rounded-xl transition-colors border border-dashed border-fuchsia-500/30"
                  >
                    <Plus className="w-4 h-4" />
                    プレイヤーを追加
                  </button>
                )}
              </div>

              {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              <button
                onClick={startGame}
                className="w-full py-4 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 group"
              >
                <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                ゲームスタート
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl flex flex-col items-center"
            >
              <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-cyan-500"></div>

                <div className="flex justify-between items-start mb-12">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Sparkles className="w-4 h-4 text-fuchsia-400" />
                    <span>Question #{Object.values(askedQuestions).flat().length}</span>
                  </div>
                  <button
                    onClick={endGame}
                    className="text-slate-500 hover:text-white transition-colors flex items-center gap-2 text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    終了してリセット
                  </button>
                </div>

                <div className="text-center min-h-[200px] flex flex-col justify-center">
                  {isGenerating ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-fuchsia-500/20 border-t-fuchsia-500 rounded-full animate-spin"></div>
                      <p className="text-slate-400 animate-pulse">
                        星の導きを受信中...
                      </p>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="flex flex-wrap justify-center gap-3 mb-8">
                        {selectedPlayers.map((player, idx) => (
                          <span
                            key={idx}
                            className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-lg font-medium text-fuchsia-300 shadow-inner"
                          >
                            {player}
                          </span>
                        ))}
                        <span className="px-2 py-2 text-lg text-slate-400 flex items-center">
                          {selectedPlayers.length === 1
                            ? "への質問"
                            : "への質問"}
                        </span>
                      </div>

                      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-white mb-8 tracking-tight">
                        {currentQuestion}
                      </h2>
                    </motion.div>
                  )}
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                    {error}
                  </div>
                )}
              </div>

              <div className="mt-8">
                <button
                  onClick={handleNext}
                  disabled={isGenerating}
                  className="px-8 py-4 bg-white text-slate-900 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-bold text-lg shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                >
                  <Sparkles className="w-5 h-5" />
                  次の質問へ
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

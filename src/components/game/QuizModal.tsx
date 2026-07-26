'use client';

import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import quizData from '@/data/quizData.json';
import { soundManager } from '@/lib/game/soundManager';
import { Progress } from '@/components/ui/progress';

export default function QuizModal() {
  const {
    quizActive,
    quizQuestions,
    currentQuizQuestion,
    quizScore,
    quizComplete,
  } = useGameStore();

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [currentCorrect, setCurrentCorrect] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState('');

  if (!quizActive && !quizComplete) return null;

  if (quizComplete) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-amber-950/40 border-2 border-amber-400/50 p-8 max-w-md text-center shadow-2xl">
          <div className="text-amber-400 text-5xl mb-4 animate-bounce">🎓</div>
          <h2 className="text-2xl font-bold text-white mb-2">Chapter Quiz Complete!</h2>
          <div className="text-lg text-white/70 mb-4">
            You scored <span className="text-amber-400 font-bold text-xl">{quizScore}</span> out of <span className="text-amber-400 font-bold text-xl">{quizQuestions.length}</span>
          </div>
          <div className="text-sm text-white/50 mb-6 italic">
            {quizScore >= quizQuestions.length
              ? '🌟 Perfect! You truly listened to every word.'
              : quizScore >= quizQuestions.length - 1
                ? '👍 Almost perfect! You paid close attention.'
                : '📚 Good effort! Review the Codex for more details.'}
          </div>
          <div className="rounded-lg bg-emerald-900/20 border border-emerald-400/30 p-3 mb-4">
            <div className="text-emerald-400 text-sm font-bold">+60 Knowledge XP</div>
          </div>
          <div className="text-white/40 text-xs">
            Your progress is being saved...
          </div>
        </div>
      </div>
    );
  }

  const question = quizQuestions[currentQuizQuestion];
  if (!question) return null;

  const progress = ((currentQuizQuestion) / quizQuestions.length) * 100;

  const handleAnswer = (answerId: string) => {
    if (selectedAnswer) return; // Already answered this question

    const option = question.options.find(o => o.id === answerId);
    setSelectedAnswer(answerId);
    setCurrentCorrect(option?.correct || false);
    setCurrentExplanation(question.correctExplanation);
    setShowExplanation(true);

    // Play sound based on correctness
    soundManager.play(option?.correct ? 'quiz-correct' : 'quiz-wrong');
  };

  const handleNext = () => {
    useGameStore.getState().answerQuiz(currentQuizQuestion, selectedAnswer || 'a');
    setSelectedAnswer(null);
    setShowExplanation(false);
    soundManager.play('ui-click');
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-stone-950 border-2 border-amber-400/50 p-6 max-w-lg w-full shadow-2xl">
        {/* Header with progress */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-amber-400 font-bold text-xs tracking-widest uppercase">Chapter 1 Quiz</div>
            <div className="text-white/40 text-xs mt-0.5">Test your knowledge</div>
          </div>
          <div className="text-right">
            <div className="text-white/60 text-xs">Question</div>
            <div className="text-amber-400 font-bold">
              {currentQuizQuestion + 1}<span className="text-white/40">/{quizQuestions.length}</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="h-1.5 mb-4 bg-stone-800" />

        {/* Question */}
        <h3 className="text-white text-lg font-semibold mb-4 leading-relaxed">{question.question}</h3>

        {/* Options */}
        <div className="space-y-2 mb-4">
          {question.options.map((option, idx) => {
            const isSelected = selectedAnswer === option.id;
            const isCorrect = option.correct;
            const showResult = selectedAnswer !== null;

            let bgColor = 'bg-stone-800/30 border-stone-700/30 hover:bg-stone-800/50 hover:border-stone-600/50';
            if (showResult && isCorrect) bgColor = 'bg-emerald-900/30 border-emerald-400/50';
            if (showResult && isSelected && !isCorrect) bgColor = 'bg-red-900/30 border-red-400/50';
            if (showResult && !isSelected && !isCorrect) bgColor = 'bg-stone-800/20 border-stone-700/20 opacity-50';

            return (
              <button
                key={option.id}
                onClick={() => handleAnswer(option.id)}
                disabled={selectedAnswer !== null}
                className={`w-full text-left rounded-lg p-3 transition-all border flex items-center gap-3 ${
                  bgColor
                } ${!showResult ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isSelected
                    ? isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                    : showResult && isCorrect
                      ? 'bg-emerald-500 text-white'
                      : 'bg-stone-700 text-white/60'
                }`}>
                  {showResult && isCorrect ? '✓' : showResult && isSelected && !isCorrect ? '✗' : String.fromCharCode(65 + idx)}
                </div>
                <span className="text-white text-sm flex-1">{option.text}</span>
              </button>
            );
          })}
        </div>

        {/* Explanation (shown after answering) */}
        {showExplanation && (
          <div className={`rounded-lg p-3 mb-4 border animate-in fade-in slide-in-from-bottom-2 ${
            currentCorrect ? 'bg-emerald-900/20 border-emerald-400/30' : 'bg-red-900/20 border-red-400/30'
          }`}>
            <div className={`text-sm font-bold mb-1 flex items-center gap-1 ${currentCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
              {currentCorrect ? '✓ Correct!' : '✗ Not quite right'}
            </div>
            <div className="text-white/70 text-xs leading-relaxed">
              {currentExplanation}
            </div>
          </div>
        )}

        {/* Next button */}
        {selectedAnswer && (
          <button
            onClick={handleNext}
            className="w-full rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold py-2.5 transition-all shadow-lg hover:shadow-amber-500/30"
          >
            {currentQuizQuestion < quizQuestions.length - 1 ? 'Next Question →' : 'Finish Quiz'}
          </button>
        )}
      </div>
    </div>
  );
}

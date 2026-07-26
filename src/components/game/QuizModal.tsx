'use client';

import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import quizData from '@/data/quizData.json';

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
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
        <div className="rounded-2xl bg-stone-900/95 border-2 border-amber-400/50 p-8 max-w-md text-center shadow-2xl">
          <div className="text-amber-400 text-4xl mb-4">🎓</div>
          <h2 className="text-2xl font-bold text-white mb-2">Chapter Quiz Complete!</h2>
          <div className="text-lg text-white/70 mb-4">
            You scored <span className="text-amber-400 font-bold">{quizScore}</span> out of <span className="text-amber-400 font-bold">{quizQuestions.length}</span>
          </div>
          <div className="text-sm text-white/50 mb-6">
            {quizScore >= quizQuestions.length 
              ? 'Perfect! You truly listened to every word.' 
              : quizScore >= quizQuestions.length - 1
                ? 'Almost perfect! You paid close attention.'
                : 'Good effort! Review the Codex for more details.'}
          </div>
          <div className="text-emerald-400 text-sm">
            +60 Knowledge XP earned!
          </div>
        </div>
      </div>
    );
  }

  const question = quizQuestions[currentQuizQuestion];
  if (!question) return null;

  const handleAnswer = (answerId: string) => {
    if (selectedAnswer) return; // Already answered this question
    
    const option = question.options.find(o => o.id === answerId);
    setSelectedAnswer(answerId);
    setCurrentCorrect(option?.correct || false);
    setCurrentExplanation(question.correctExplanation);
    setShowExplanation(true);
  };

  const handleNext = () => {
    useGameStore.getState().answerQuiz(currentQuizQuestion, selectedAnswer || 'a');
    setSelectedAnswer(null);
    setShowExplanation(false);
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="rounded-2xl bg-stone-900/95 border-2 border-amber-400/50 p-6 max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-amber-400 font-bold text-sm tracking-wider uppercase">
            Chapter 1 Quiz
          </div>
          <div className="text-white/50 text-xs">
            Question {currentQuizQuestion + 1} of {quizQuestions.length}
          </div>
        </div>

        {/* Question */}
        <h3 className="text-white text-lg font-semibold mb-4">{question.question}</h3>

        {/* Options */}
        <div className="space-y-2 mb-4">
          {question.options.map(option => {
            const isSelected = selectedAnswer === option.id;
            const isCorrect = option.correct;
            const showResult = selectedAnswer !== null;

            let bgColor = 'bg-stone-800/30 border-stone-700/30 hover:bg-stone-800/50';
            if (showResult && isCorrect) bgColor = 'bg-emerald-900/30 border-emerald-400/50';
            if (showResult && isSelected && !isCorrect) bgColor = 'bg-red-900/30 border-red-400/50';
            if (showResult && !isSelected && !isCorrect) bgColor = 'bg-stone-800/20 border-stone-700/20 opacity-50';

            return (
              <button
                key={option.id}
                onClick={() => handleAnswer(option.id)}
                disabled={selectedAnswer !== null}
                className={`w-full text-left rounded-lg p-3 transition-colors border ${bgColor} ${
                  !showResult ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <span className="text-white text-sm">{option.text}</span>
                {showResult && isCorrect && <span className="text-emerald-400 ml-2">✓</span>}
                {showResult && isSelected && !isCorrect && <span className="text-red-400 ml-2">✗</span>}
              </button>
            );
          })}
        </div>

        {/* Explanation (shown after answering) */}
        {showExplanation && (
          <div className={`rounded-lg p-3 mb-4 ${
            currentCorrect ? 'bg-emerald-900/20 border border-emerald-400/30' : 'bg-red-900/20 border border-red-400/30'
          }`}>
            <div className={`text-sm font-semibold mb-1 ${currentCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
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
            className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2 transition-colors"
          >
            {currentQuizQuestion < quizQuestions.length - 1 ? 'Next Question' : 'Finish Quiz'}
          </button>
        )}
      </div>
    </div>
  );
}

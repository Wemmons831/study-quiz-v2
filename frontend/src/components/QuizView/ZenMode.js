import React, { useState, useEffect } from 'react';
import './ZenMode.css';

const ZenMode = ({ 
  question, 
  onAnswer, 
  onNext, 
  onPrevious, 
  onExit, 
  currentQuestionIndex, 
  totalQuestions,
  studySetTitle
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [shuffledAnswers, setShuffledAnswers] = useState([]);

  useEffect(() => {
    if (question) {
      // Shuffle answers for this question
      const answers = [
        question.correct_answer,
        ...question.wrong_answers
      ];
      
      // Simple shuffle algorithm
      const shuffled = [...answers];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      setShuffledAnswers(shuffled);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  }, [question]);

  const handleAnswerSelect = (answer) => {
    if (showResult) return;
    
    setSelectedAnswer(answer);
    const correct = answer === question.correct_answer;
    setIsCorrect(correct);
    setShowResult(true);
    
    // Call the onAnswer callback
    if (onAnswer) {
      onAnswer(correct);
    }
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    }
  };

  const handlePrevious = () => {
    if (onPrevious) {
      onPrevious();
    }
  };

  const getAnswerClass = (answer) => {
    if (!showResult) {
      return selectedAnswer === answer ? 'selected' : '';
    }
    
    if (answer === question.correct_answer) {
      return 'correct';
    }
    
    if (answer === selectedAnswer && !isCorrect) {
      return 'incorrect';
    }
    
    return 'disabled';
  };

  if (!question) {
    return (
      <div className="zen-mode">
        <div className="zen-container">
          <div className="loading">Loading question...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="zen-mode">
      <div className="zen-container">
        {/* Header */}
        <div className="zen-header">
          <div className="zen-title">
            <h2>{studySetTitle}</h2>
            <div className="zen-progress">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </div>
          </div>
          <button className="exit-zen-button" onClick={onExit}>
            ✕ Exit Zen Mode
          </button>
        </div>

        {/* Progress Bar */}
        <div className="zen-progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
          ></div>
        </div>

        {/* Question */}
        <div className="zen-question-container">
          <div className="zen-question">
            <h1>{question.question_text}</h1>
          </div>

          {/* Answers */}
          <div className="zen-answers">
            {shuffledAnswers.map((answer, index) => (
              <button
                key={index}
                className={`zen-answer ${getAnswerClass(answer)}`}
                onClick={() => handleAnswerSelect(answer)}
                disabled={showResult}
              >
                <span className="answer-letter">{String.fromCharCode(65 + index)}</span>
                <span className="answer-text">{answer}</span>
              </button>
            ))}
          </div>

          {/* Result Feedback */}
          {showResult && (
            <div className={`zen-feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
              <div className="feedback-icon">
                {isCorrect ? '✓' : '✗'}
              </div>
              <div className="feedback-text">
                {isCorrect ? 'Correct!' : 'Incorrect'}
              </div>
              {!isCorrect && (
                <div className="correct-answer-hint">
                  The correct answer was: <strong>{question.correct_answer}</strong>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="zen-navigation">
            <button
              className="nav-button secondary"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              ← Previous
            </button>
            
            {showResult && (
              <button
                className="nav-button primary"
                onClick={handleNext}
                disabled={currentQuestionIndex >= totalQuestions - 1}
              >
                {currentQuestionIndex >= totalQuestions - 1 ? 'Finish' : 'Next →'}
              </button>
            )}
          </div>
        </div>

        {/* Zen Mode Tips */}
        {!showResult && currentQuestionIndex === 0 && (
          <div className="zen-tips">
            <div className="tip">
              💡 <strong>Zen Mode:</strong> Focus on one question at a time without distractions
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZenMode;
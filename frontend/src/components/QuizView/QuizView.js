import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { studySetsAPI, progressAPI } from '../../services/api';
import  ZenMode  from './ZenMode';
import './QuizView.css';

export const QuizView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [studySet, setStudySet] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [activeQuestions, setActiveQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentAnswers, setCurrentAnswers] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isZenMode, setIsZenMode] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [studyTime, setStudyTime] = useState(0);
  const [lastActiveTime, setLastActiveTime] = useState(Date.now());
  const [masteredCount, setMasteredCount] = useState(0);
  
  const timerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Initialize quiz
  useEffect(() => {
    loadStudySet();
    startStudySession();
    startTimer();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      endStudySession();
    };
  }, [id]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (loading || !currentQuestion) return;

      const key = event.key;
      
      // Answer selection (1-4)
      if (['1', '2', '3', '4'].includes(key) && !showFeedback) {
        const answerIndex = parseInt(key) - 1;
        if (answerIndex < currentAnswers.length) {
          handleAnswerSelect(answerIndex);
        }
      }
      
      // Next question (any key after answering)
      if (showFeedback) {
        nextQuestion();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [currentQuestion, currentAnswers, showFeedback, loading]);

  // Activity tracking
  useEffect(() => {
    const trackActivity = () => {
      lastActivityRef.current = Date.now();
      setLastActiveTime(Date.now());
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, trackActivity);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, trackActivity);
      });
    };
  }, []);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      // Only count time if user was active within last 2 minutes
      if (timeSinceLastActivity < 2 * 60 * 1000) {
        setStudyTime(prev => prev + 1);
      }
    }, 1000);
  };

  const loadStudySet = async () => {
    try {
      setLoading(true);
      const response = await studySetsAPI.getById(id);
      const studySetData = response.data.studySet;
      
      setStudySet(studySetData);
      
      // Set document title to study set name
      document.title = studySetData.title.replace(/_/g, ' ');
      
      // Initialize questions with progress
      const questionsWithProgress = studySetData.questions.map(q => ({
        ...q,
        correctCount: 0,
        timesSeen: 0,
        isMastered: false
      }));
      
      setQuestions(questionsWithProgress);
      resetActiveQuestions(questionsWithProgress);
      
    } catch (error) {
      console.error('Error loading study set:', error);
      setError('Failed to load study set');
    } finally {
      setLoading(false);
    }
  };

  const resetActiveQuestions = (allQuestions) => {
    const notMastered = allQuestions.filter(q => !q.isMastered);
    setActiveQuestions([...notMastered]);
    
    if (notMastered.length > 0) {
      showNextQuestion(notMastered);
    }
  };

  const showNextQuestion = (questionPool = activeQuestions) => {
    if (questionPool.length === 0) {
      // All questions mastered!
      setCurrentQuestion(null);
      return;
    }

    // Shuffle and pick first question
    const shuffled = [...questionPool].sort(() => Math.random() - 0.5);
    const nextQuestion = shuffled[0];
    
    // Generate shuffled answers
    const answers = [
      { text: nextQuestion.correct_answer, isCorrect: true },
      ...nextQuestion.wrong_answers.map(ans => ({ text: ans, isCorrect: false }))
    ];
    
    // Shuffle answers
    const shuffledAnswers = answers.sort(() => Math.random() - 0.5);
    
    setCurrentQuestion(nextQuestion);
    setCurrentAnswers(shuffledAnswers);
    setSelectedAnswer(null);
    setShowFeedback(false);
    
    // Update times seen
    updateQuestionProgress(nextQuestion.id, { timesSeen: true });
  };

  const handleAnswerSelect = (answerIndex) => {
    if (showFeedback) return;
    
    const selectedAns = currentAnswers[answerIndex];
    setSelectedAnswer(answerIndex);
    setIsCorrect(selectedAns.isCorrect);
    setShowFeedback(true);
    
    // Update progress
    updateQuestionProgress(currentQuestion.id, { 
      isCorrect: selectedAns.isCorrect 
    });
  };

  const nextQuestion = () => {
    if (!showFeedback) return;
    
    // Update question in state
    const updatedQuestions = questions.map(q => {
      if (q.id === currentQuestion.id) {
        const newCorrectCount = isCorrect ? q.correctCount + 1 : 0;
        const newIsMastered = newCorrectCount >= 3;
        
        return {
          ...q,
          correctCount: newCorrectCount,
          timesSeen: q.timesSeen + 1,
          isMastered: newIsMastered
        };
      }
      return q;
    });
    
    setQuestions(updatedQuestions);
    
    // Update active questions
    let newActiveQuestions = [...activeQuestions];
    
    if (isCorrect) {
      const updatedQuestion = updatedQuestions.find(q => q.id === currentQuestion.id);
      if (updatedQuestion?.isMastered) {
        // Remove from active questions
        newActiveQuestions = newActiveQuestions.filter(q => q.id !== currentQuestion.id);
        setMasteredCount(prev => prev + 1);
      }
    }
    
    setActiveQuestions(newActiveQuestions);
    
    // Show next question or complete
    if (newActiveQuestions.length === 0) {
      // Quiz complete!
      setCurrentQuestion(null);
    } else {
      showNextQuestion(newActiveQuestions);
    }
  };

  const updateQuestionProgress = async (questionId, progressData) => {
    try {
      await progressAPI.updateProgress(id, progressData);
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const startStudySession = async () => {
    try {
      const response = await progressAPI.startSession(id);
      setSessionId(response.data.sessionId);
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const endStudySession = async () => {
    if (sessionId) {
      try {
        await progressAPI.endSession(sessionId);
      } catch (error) {
        console.error('Error ending session:', error);
      }
    }
  };

  const restartQuiz = () => {
    const resetQuestions = questions.map(q => ({
      ...q,
      correctCount: 0,
      isMastered: false
    }));
    
    setQuestions(resetQuestions);
    setMasteredCount(0);
    resetActiveQuestions(resetQuestions);
  };

  const downloadProgress = async () => {
    try {
      const response = await studySetsAPI.exportCSV(id);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${studySet.title.replace(/[^a-zA-Z0-9]/g, '_')}_progress.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading progress:', error);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="quiz-loading">
        <div className="loading-spinner"></div>
        <p>Loading quiz...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/dashboard')} className="btn btn--primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (isZenMode) {
    return (
      <ZenMode
        currentQuestion={currentQuestion}
        currentAnswers={currentAnswers}
        selectedAnswer={selectedAnswer}
        showFeedback={showFeedback}
        isCorrect={isCorrect}
        onAnswerSelect={handleAnswerSelect}
        onNextQuestion={nextQuestion}
        onExitZen={() => setIsZenMode(false)}
        progress={{
          completed: masteredCount,
          total: questions.length,
          remaining: activeQuestions.length
        }}
      />
    );
  }

  // Quiz complete
  if (!currentQuestion && activeQuestions.length === 0) {
    return (
      <div className="quiz-complete">
        <div className="quiz-complete-content">
          <h1>🎉 Congratulations!</h1>
          <p>You've mastered all questions in this study set!</p>
          
          <div className="quiz-stats">
            <div className="stat-item">
              <span className="stat-number">{questions.length}</span>
              <span className="stat-label">Questions Mastered</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{formatTime(studyTime)}</span>
              <span className="stat-label">Study Time</span>
            </div>
          </div>
          
          <div className="quiz-complete-actions">
            <button onClick={restartQuiz} className="btn btn--primary">
              Study Again
            </button>
            <button onClick={downloadProgress} className="btn btn--secondary">
              Download Progress
            </button>
            <button onClick={() => navigate('/dashboard')} className="btn btn--outline">
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <div className="quiz-title">
          <h1>{studySet?.title}</h1>
          <div className="quiz-controls">
            <button 
              onClick={() => setIsZenMode(true)}
              className="btn btn--secondary btn--small"
            >
              Zen Mode
            </button>
            <button onClick={downloadProgress} className="btn btn--outline btn--small">
              Download Progress
            </button>
          </div>
        </div>
        
        <div className="quiz-stats">
          <div className="stat">
            <span className="stat-label">Progress:</span>
            <span className="stat-value">
              {masteredCount} / {questions.length} mastered
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Remaining:</span>
            <span className="stat-value">{activeQuestions.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Study Time:</span>
            <span className="stat-value">{formatTime(studyTime)}</span>
          </div>
        </div>
        
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${(masteredCount / questions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="quiz-content">
        {currentQuestion && (
          <div className="question-container">
            <div className="question-text">
              <h2>{currentQuestion.question_text}</h2>
            </div>
            
            <div className="answers-container">
              {currentAnswers.map((answer, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showFeedback}
                  className={`answer-btn ${
                    selectedAnswer === index
                      ? showFeedback
                        ? isCorrect
                          ? 'correct'
                          : 'incorrect'
                        : 'selected'
                      : ''
                  } ${
                    showFeedback && answer.isCorrect && selectedAnswer !== index
                      ? 'correct-answer'
                      : ''
                  }`}
                >
                  <span className="answer-number">({index + 1})</span>
                  <span className="answer-text">{answer.text}</span>
                </button>
              ))}
            </div>
            
            {showFeedback && (
              <div className={`feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
                <div className="feedback-content">
                  <h3>{isCorrect ? '✅ Correct!' : '❌ Incorrect'}</h3>
                  {!isCorrect && (
                    <p>The correct answer is: <strong>{currentQuestion.correct_answer}</strong></p>
                  )}
                  <p className="feedback-instruction">Press any key to continue</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default QuizView;

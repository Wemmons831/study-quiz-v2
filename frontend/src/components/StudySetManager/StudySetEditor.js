import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiCall } from '../../services/api';
import './StudySetEditor.css';

const StudySetEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = Boolean(id && id !== 'create');

  const [studySet, setStudySet] = useState({
    title: '',
    description: '',
    is_public: false,
    tags: []
  });
  const [questions, setQuestions] = useState([
    { question_text: '', correct_answer: '', wrong_answers: ['', '', ''] }
  ]);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEditing) {
      loadStudySet();
    }
  }, [id, isEditing]);

  const loadStudySet = async () => {
    setIsLoading(true);
    try {
      const response = await apiCall(`/studysets/${id}`);
      const { studySet: loadedStudySet, questions: loadedQuestions } = response;
      
      setStudySet({
        title: loadedStudySet.title || '',
        description: loadedStudySet.description || '',
        is_public: loadedStudySet.is_public || false,
        tags: loadedStudySet.tags || []
      });
      
      if (loadedQuestions && loadedQuestions.length > 0) {
        setQuestions(loadedQuestions.map(q => ({
          id: q.id,
          question_text: q.question_text || '',
          correct_answer: q.correct_answer || '',
          wrong_answers: q.wrong_answers || ['', '', '']
        })));
      }
    } catch (error) {
      console.error('Error loading study set:', error);
      if (error.status === 404) {
        navigate('/my-study-sets');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudySetChange = (field, value) => {
    setStudySet(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleQuestionChange = (questionIndex, field, value) => {
    setQuestions(prev => prev.map((q, index) => 
      index === questionIndex 
        ? { ...q, [field]: value }
        : q
    ));

    const errorKey = `question_${questionIndex}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({
        ...prev,
        [errorKey]: ''
      }));
    }
  };

  const handleWrongAnswerChange = (questionIndex, answerIndex, value) => {
    setQuestions(prev => prev.map((q, qIndex) => 
      qIndex === questionIndex 
        ? {
            ...q,
            wrong_answers: q.wrong_answers.map((answer, aIndex) =>
              aIndex === answerIndex ? value : answer
            )
          }
        : q
    ));

    const errorKey = `question_${questionIndex}_wrong_answer_${answerIndex}`;
    if (errors[errorKey]) {
      setErrors(prev => ({
        ...prev,
        [errorKey]: ''
      }));
    }
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      question_text: '',
      correct_answer: '',
      wrong_answers: ['', '', '']
    }]);
  };

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions(prev => prev.filter((_, i) => i !== index));
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !studySet.tags.includes(tag) && studySet.tags.length < 10) {
      setStudySet(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setStudySet(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validate study set
    if (!studySet.title.trim()) {
      newErrors.title = 'Title is required';
    }

    // Validate questions
    questions.forEach((question, qIndex) => {
      if (!question.question_text.trim()) {
        newErrors[`question_${qIndex}_question_text`] = 'Question text is required';
      }
      if (!question.correct_answer.trim()) {
        newErrors[`question_${qIndex}_correct_answer`] = 'Correct answer is required';
      }
      
      question.wrong_answers.forEach((answer, aIndex) => {
        if (!answer.trim()) {
          newErrors[`question_${qIndex}_wrong_answer_${aIndex}`] = 'Wrong answer is required';
        }
      });
    });

    return newErrors;
  };

  const handleSave = async () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    setErrors({});

    try {
      const payload = {
        ...studySet,
        questions: questions.map(({ id, ...question }) => question)
      };

      let response;
      if (isEditing) {
        response = await apiCall(`/studysets/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        response = await apiCall('/studysets', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      navigate(`/study-set/${response.studySet.id}`);
    } catch (error) {
      console.error('Error saving study set:', error);
      setErrors({
        submit: error.message || 'Failed to save study set'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      setIsLoading(true);
      const response = await apiCall('/studysets/import-csv', {
        method: 'POST',
        body: formData,
        skipContentType: true
      });

      if (response.questions && response.questions.length > 0) {
        setQuestions(response.questions.map(q => ({
          question_text: q.question_text || '',
          correct_answer: q.correct_answer || '',
          wrong_answers: q.wrong_answers || ['', '', '']
        })));
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Failed to import CSV file. Please check the format and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="study-set-editor-loading">Loading...</div>;
  }

  return (
    <div className="study-set-editor">
      <div className="editor-container">
        <div className="editor-header">
          <h1>{isEditing ? 'Edit Study Set' : 'Create New Study Set'}</h1>
          <div className="editor-actions">
            <button
              onClick={() => navigate(-1)}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={`save-button ${isSaving ? 'saving' : ''}`}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>

        <div className="editor-content">
          {/* Study Set Details */}
          <div className="section">
            <h2>Study Set Details</h2>
            
            <div className="form-group">
              <label htmlFor="title">Title *</label>
              <input
                type="text"
                id="title"
                value={studySet.title}
                onChange={(e) => handleStudySetChange('title', e.target.value)}
                className={errors.title ? 'error' : ''}
                placeholder="Enter study set title"
              />
              {errors.title && <span className="error-message">{errors.title}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={studySet.description}
                onChange={(e) => handleStudySetChange('description', e.target.value)}
                placeholder="Optional description for your study set"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={studySet.is_public}
                  onChange={(e) => handleStudySetChange('is_public', e.target.checked)}
                />
                Make this study set public (others can discover and study it)
              </label>
            </div>

            <div className="form-group">
              <label>Tags</label>
              <div className="tags-input">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleTagInputKeyPress}
                  placeholder="Add a tag and press Enter"
                  maxLength={50}
                />
                <button type="button" onClick={addTag} disabled={!tagInput.trim()}>
                  Add
                </button>
              </div>
              <div className="tags-list">
                {studySet.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {studySet.tags.length >= 10 && (
                <span className="tag-limit">Maximum of 10 tags allowed</span>
              )}
            </div>
          </div>

          {/* Questions Section */}
          <div className="section">
            <div className="section-header">
              <h2>Questions ({questions.length})</h2>
              <div className="question-actions">
                <label className="csv-import">
                  📁 Import CSV
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportCSV}
                    style={{ display: 'none' }}
                  />
                </label>
                <button onClick={addQuestion} className="add-question-button">
                  + Add Question
                </button>
              </div>
            </div>

            <div className="questions-list">
              {questions.map((question, questionIndex) => (
                <div key={questionIndex} className="question-item">
                  <div className="question-header">
                    <h3>Question {questionIndex + 1}</h3>
                    {questions.length > 1 && (
                      <button
                        onClick={() => removeQuestion(questionIndex)}
                        className="remove-question-button"
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Question Text *</label>
                    <textarea
                      value={question.question_text}
                      onChange={(e) => handleQuestionChange(questionIndex, 'question_text', e.target.value)}
                      className={errors[`question_${questionIndex}_question_text`] ? 'error' : ''}
                      placeholder="Enter your question"
                      rows={2}
                    />
                    {errors[`question_${questionIndex}_question_text`] && (
                      <span className="error-message">
                        {errors[`question_${questionIndex}_question_text`]}
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Correct Answer *</label>
                    <input
                      type="text"
                      value={question.correct_answer}
                      onChange={(e) => handleQuestionChange(questionIndex, 'correct_answer', e.target.value)}
                      className={errors[`question_${questionIndex}_correct_answer`] ? 'error' : ''}
                      placeholder="Enter the correct answer"
                    />
                    {errors[`question_${questionIndex}_correct_answer`] && (
                      <span className="error-message">
                        {errors[`question_${questionIndex}_correct_answer`]}
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Wrong Answers *</label>
                    {question.wrong_answers.map((wrongAnswer, answerIndex) => (
                      <input
                        key={answerIndex}
                        type="text"
                        value={wrongAnswer}
                        onChange={(e) => handleWrongAnswerChange(questionIndex, answerIndex, e.target.value)}
                        className={errors[`question_${questionIndex}_wrong_answer_${answerIndex}`] ? 'error' : ''}
                        placeholder={`Wrong answer ${answerIndex + 1}`}
                      />
                    ))}
                    {errors[`question_${questionIndex}_wrong_answer_0`] && (
                      <span className="error-message">All wrong answers are required</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {errors.submit && (
            <div className="error-message submit-error">
              {errors.submit}
            </div>
          )}

          <div className="editor-footer">
            <button
              onClick={handleSave}
              className={`save-button primary ${isSaving ? 'saving' : ''}`}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : isEditing ? 'Update Study Set' : 'Create Study Set'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudySetEditor;
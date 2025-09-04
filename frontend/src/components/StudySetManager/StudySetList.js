import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiCall } from '../../services/api';
import './StudySetList.css';

const StudySetList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studySets, setStudySets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, public, private
  const [sortBy, setSortBy] = useState('recent'); // recent, popular, alphabetical

  useEffect(() => {
    loadStudySets();
  }, [filter, sortBy]);

  const loadStudySets = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('filter', filter);
      }
      params.append('sort', sortBy);

      const response = await apiCall(`/studysets/my?${params}`);
      setStudySets(response.studySets || []);
    } catch (error) {
      console.error('Error loading study sets:', error);
      setStudySets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (studySetId) => {
    if (!window.confirm('Are you sure you want to delete this study set? This action cannot be undone.')) {
      return;
    }

    try {
      await apiCall(`/studysets/${studySetId}`, {
        method: 'DELETE'
      });
      
      // Remove from local state
      setStudySets(prev => prev.filter(set => set.id !== studySetId));
    } catch (error) {
      console.error('Error deleting study set:', error);
      alert('Failed to delete study set. Please try again.');
    }
  };

  const handleDuplicate = async (studySetId) => {
    try {
      const response = await apiCall(`/studysets/${studySetId}/fork`, {
        method: 'POST'
      });
      
      // Navigate to the new study set editor
      navigate(`/study-set/edit/${response.studySet.id}`);
    } catch (error) {
      console.error('Error duplicating study set:', error);
      alert('Failed to duplicate study set. Please try again.');
    }
  };

  const handleToggleVisibility = async (studySetId, currentVisibility) => {
    try {
      const response = await apiCall(`/studysets/${studySetId}`, {
        method: 'PUT',
        body: JSON.stringify({
          is_public: !currentVisibility
        })
      });
      
      // Update local state
      setStudySets(prev => 
        prev.map(set => 
          set.id === studySetId 
            ? { ...set, is_public: response.studySet.is_public }
            : set
        )
      );
    } catch (error) {
      console.error('Error updating study set visibility:', error);
      alert('Failed to update visibility. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getFilteredAndSortedStudySets = () => {
    let filtered = studySets;

    // Apply filter
    if (filter === 'public') {
      filtered = studySets.filter(set => set.is_public);
    } else if (filter === 'private') {
      filtered = studySets.filter(set => !set.is_public);
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'popular':
          return (b.play_count || 0) - (a.play_count || 0);
        case 'recent':
        default:
          return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
      }
    });

    return sorted;
  };

  const filteredStudySets = getFilteredAndSortedStudySets();

  return (
    <div className="study-set-list">
      <div className="study-set-list-header">
        <div className="header-main">
          <h1>My Study Sets</h1>
          <Link to="/study-set/create" className="create-button">
            + Create New Study Set
          </Link>
        </div>
        
        <div className="header-controls">
          <div className="filter-controls">
            <label htmlFor="filter">Filter:</label>
            <select
              id="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All ({studySets.length})</option>
              <option value="public">Public ({studySets.filter(s => s.is_public).length})</option>
              <option value="private">Private ({studySets.filter(s => !s.is_public).length})</option>
            </select>
          </div>

          <div className="sort-controls">
            <label htmlFor="sort">Sort by:</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="recent">Most Recent</option>
              <option value="alphabetical">A-Z</option>
              <option value="popular">Most Popular</option>
            </select>
          </div>
        </div>
      </div>

      <div className="study-set-list-content">
        {isLoading ? (
          <div className="loading">Loading your study sets...</div>
        ) : filteredStudySets.length === 0 ? (
          <div className="no-study-sets">
            {studySets.length === 0 ? (
              <div className="empty-state">
                <h3>No study sets yet</h3>
                <p>Create your first study set to get started!</p>
                <Link to="/study-set/create" className="create-button">
                  Create Study Set
                </Link>
              </div>
            ) : (
              <div className="no-filtered-results">
                <p>No study sets match your current filters.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="study-sets-grid">
            {filteredStudySets.map((studySet) => (
              <div key={studySet.id} className="study-set-card">
                <div className="card-header">
                  <div className="card-title-section">
                    <h3 className="study-set-title">
                      <Link to={`/study-set/${studySet.id}`}>
                        {studySet.title}
                      </Link>
                    </h3>
                    <div className="study-set-meta">
                      <span className={`visibility-badge ${studySet.is_public ? 'public' : 'private'}`}>
                        {studySet.is_public ? '🌐 Public' : '🔒 Private'}
                      </span>
                      <span className="question-count">
                        {studySet.questionCount || 0} questions
                      </span>
                    </div>
                  </div>

                  <div className="card-menu">
                    <button className="menu-button">⋮</button>
                    <div className="dropdown-menu">
                      <Link to={`/study-set/edit/${studySet.id}`} className="menu-item">
                        ✏️ Edit
                      </Link>
                      <Link to={`/study/${studySet.id}`} className="menu-item">
                        📚 Study
                      </Link>
                      <button
                        onClick={() => handleDuplicate(studySet.id)}
                        className="menu-item"
                      >
                        📋 Duplicate
                      </button>
                      <button
                        onClick={() => handleToggleVisibility(studySet.id, studySet.is_public)}
                        className="menu-item"
                      >
                        {studySet.is_public ? '🔒 Make Private' : '🌐 Make Public'}
                      </button>
                      <button
                        onClick={() => handleDelete(studySet.id)}
                        className="menu-item delete"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>

                {studySet.description && (
                  <p className="study-set-description">
                    {studySet.description.slice(0, 120)}
                    {studySet.description.length > 120 ? '...' : ''}
                  </p>
                )}

                {studySet.tags && studySet.tags.length > 0 && (
                  <div className="study-set-tags">
                    {studySet.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                    {studySet.tags.length > 3 && (
                      <span className="tag-more">+{studySet.tags.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="card-footer">
                  <div className="study-set-stats">
                    <span className="stat">
                      📊 {studySet.play_count || 0} plays
                    </span>
                    <span className="stat">
                      🍴 {studySet.fork_count || 0} forks
                    </span>
                  </div>
                  <div className="study-set-dates">
                    <span className="date">
                      Updated {formatDate(studySet.updated_at || studySet.created_at)}
                    </span>
                  </div>
                </div>

                <div className="card-actions">
                  <Link
                    to={`/study/${studySet.id}`}
                    className="action-button primary"
                  >
                    Study Now
                  </Link>
                  <Link
                    to={`/study-set/edit/${studySet.id}`}
                    className="action-button secondary"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudySetList;
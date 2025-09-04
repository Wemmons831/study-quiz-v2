import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiCall } from '../../services/api';
import './DiscoverPage.css';

const DiscoverPage = () => {
  const [activeTab, setActiveTab] = useState('popular');
  const [studySets, setStudySets] = useState([]);
  const [tags, setTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0
  });

  useEffect(() => {
    loadStudySets();
    if (activeTab === 'popular' || activeTab === 'recent') {
      loadTags();
    }
  }, [activeTab, selectedTag]);

  const loadStudySets = async (page = 1) => {
    setIsLoading(true);
    try {
      let endpoint = '';
      const params = new URLSearchParams({ page, limit: 12 });

      switch (activeTab) {
        case 'popular':
          endpoint = '/discover/popular';
          break;
        case 'recent':
          endpoint = '/discover/recent';
          break;
        case 'search':
          if (!searchQuery.trim()) {
            setStudySets([]);
            setPagination({ currentPage: 1, totalPages: 1, totalItems: 0 });
            return;
          }
          endpoint = '/discover/search';
          params.append('q', searchQuery);
          break;
        case 'tag':
          if (!selectedTag) {
            setStudySets([]);
            setPagination({ currentPage: 1, totalPages: 1, totalItems: 0 });
            return;
          }
          endpoint = `/discover/tag/${encodeURIComponent(selectedTag)}`;
          break;
        default:
          endpoint = '/discover/popular';
      }

      const response = await apiCall(`${endpoint}?${params}`);
      setStudySets(response.studySets || []);
      setPagination(response.pagination || { currentPage: 1, totalPages: 1, totalItems: 0 });
    } catch (error) {
      console.error('Error loading study sets:', error);
      setStudySets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const response = await apiCall('/discover/tags?limit=20');
      setTags(response.tags || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setActiveTab('search');
    await loadStudySets(1);
  };

  const handleTagSelect = (tagName) => {
    setSelectedTag(tagName);
    setActiveTab('tag');
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadStudySets(newPage);
    }
  };

  const formatPlayCount = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <div className="discover-page">
      <div className="discover-container">
        <div className="discover-header">
          <h1>Discover Study Sets</h1>
          <p>Explore public study sets created by the community</p>
        </div>

        <div className="discover-controls">
          <div className="search-section">
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                placeholder="Search study sets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="search-button">
                🔍
              </button>
            </form>
          </div>

          <div className="tabs-section">
            <div className="tabs">
              <button
                className={`tab ${activeTab === 'popular' ? 'active' : ''}`}
                onClick={() => setActiveTab('popular')}
              >
                🔥 Popular
              </button>
              <button
                className={`tab ${activeTab === 'recent' ? 'active' : ''}`}
                onClick={() => setActiveTab('recent')}
              >
                🆕 Recent
              </button>
              {searchQuery && (
                <button
                  className={`tab ${activeTab === 'search' ? 'active' : ''}`}
                  onClick={() => setActiveTab('search')}
                >
                  🔍 Search: "{searchQuery}"
                </button>
              )}
              {selectedTag && (
                <button
                  className={`tab ${activeTab === 'tag' ? 'active' : ''}`}
                  onClick={() => setActiveTab('tag')}
                >
                  🏷️ Tag: {selectedTag}
                </button>
              )}
            </div>
          </div>

          {tags.length > 0 && (activeTab === 'popular' || activeTab === 'recent') && (
            <div className="tags-section">
              <h3>Browse by Tag</h3>
              <div className="tags-grid">
                {tags.slice(0, 15).map((tag) => (
                  <button
                    key={tag.name}
                    className="tag-button"
                    onClick={() => handleTagSelect(tag.name)}
                  >
                    {tag.name} ({tag.usageCount})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="discover-content">
          {isLoading ? (
            <div className="loading">Loading study sets...</div>
          ) : studySets.length === 0 ? (
            <div className="no-results">
              {activeTab === 'search' && searchQuery ? (
                <p>No study sets found for "{searchQuery}"</p>
              ) : activeTab === 'tag' && selectedTag ? (
                <p>No study sets found with tag "{selectedTag}"</p>
              ) : (
                <p>No study sets available</p>
              )}
            </div>
          ) : (
            <>
              <div className="study-sets-grid">
                {studySets.map((studySet) => (
                  <div key={studySet.id} className="study-set-card">
                    <div className="card-header">
                      <h3 className="study-set-title">
                        <Link to={`/study-set/${studySet.id}`}>
                          {studySet.title}
                        </Link>
                      </h3>
                      <div className="study-set-stats">
                        <span className="question-count">
                          {studySet.questionCount || 0} questions
                        </span>
                        <span className="play-count">
                          {formatPlayCount(studySet.play_count || 0)} plays
                        </span>
                      </div>
                    </div>

                    {studySet.description && (
                      <p className="study-set-description">
                        {studySet.description.slice(0, 100)}
                        {studySet.description.length > 100 ? '...' : ''}
                      </p>
                    )}

                    {studySet.tags && studySet.tags.length > 0 && (
                      <div className="study-set-tags">
                        {studySet.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="tag"
                            onClick={() => handleTagSelect(tag)}
                          >
                            {tag}
                          </span>
                        ))}
                        {studySet.tags.length > 3 && (
                          <span className="tag-more">+{studySet.tags.length - 3}</span>
                        )}
                      </div>
                    )}

                    <div className="card-footer">
                      <div className="creator-info">
                        <span className="creator-name">
                          by {studySet.owner?.display_name || studySet.owner?.username || 'Anonymous'}
                        </span>
                        <span className="created-date">
                          {new Date(studySet.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="card-actions">
                        <Link
                          to={`/study/${studySet.id}`}
                          className="study-button"
                        >
                          Study
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {pagination.totalPages > 1 && (
                <div className="pagination">
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={pagination.currentPage === 1}
                    className="pagination-button"
                  >
                    ← Previous
                  </button>
                  
                  <span className="pagination-info">
                    Page {pagination.currentPage} of {pagination.totalPages}
                    ({pagination.totalItems} total)
                  </span>
                  
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={pagination.currentPage === pagination.totalPages}
                    className="pagination-button"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscoverPage;
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import  Sidebar  from './components/Sidebar/Sidebar';
import  Login  from './components/Auth/Login';
import  Register  from './components/Auth/Register';
import  ProfilePage  from './components/ProfilePage/ProfilePage';
import  DiscoverPage  from './components/DiscoverPage/DiscoverPage';
import  Leaderboard  from './components/Leaderboard/Leaderboard';
import  StudySetList  from './components/StudySetManager/StudySetList';
import  StudySetEditor  from './components/StudySetManager/StudySetEditor';
import  QuizView  from './components/QuizView/QuizView';
import  { useAuth }  from './contexts/AuthContext';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Public Route (redirects to dashboard if authenticated)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

// Main App Layout with Sidebar
const AppLayout = ({ children }) => {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

// App Component
function App() {
  return (
    <AuthProvider>
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="app">
            <Routes>
              {/* Public Routes */}
              <Route 
                path="/login" 
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } 
              />
              <Route 
                path="/register" 
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                } 
              />
              
              {/* Protected Routes with Sidebar */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      {/* Dashboard - Study Sets List */}
                      <Route path="/dashboard" element={<StudySetList />} />
                      <Route path="/studysets" element={<StudySetList />} />
                      
                      {/* Study Set Management */}
                      <Route path="/studysets/new" element={<StudySetEditor />} />
                      <Route path="/studysets/:id/edit" element={<StudySetEditor />} />
                      
                      {/* Quiz View */}
                      <Route path="/quiz/:id" element={<QuizView />} />
                      
                      {/* Discovery */}
                      <Route path="/discover" element={<DiscoverPage />} />
                      
                      {/* Leaderboards */}
                      <Route path="/leaderboards" element={<Leaderboard />} />
                      
                      {/* Profile */}
                      <Route path="/profile" element={<ProfilePage />} />
                      
                      {/* Default redirect */}
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
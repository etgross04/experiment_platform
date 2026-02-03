import React, { useState, useEffect } from 'react';
import ExperimentBuilder from './components/ExperimentBuilder';
import ExperimentRunner from './components/ExperimentRunner';
import ExperimenterInterface from './components/ExperimenterInterface';  
import SubjectInterface from './components/SubjectInterface';            
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('home');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    if (view === 'builder') {
      setCurrentView('builder');
    } else if (view === 'runner') {
      setCurrentView('runner');
    }
  }, []);

  useEffect(() => {
  const path = window.location.pathname;
  
  // Only attach shutdown handlers for home/builder/runner views
  if (path.includes('/experimenter') || path.includes('/subject')) {
    return;
  }

  // Clear the navigation flag if it exists (from previous navigation)
  if (sessionStorage.getItem('internalNavigation') === 'true') {
    sessionStorage.removeItem('internalNavigation');
  }

  const handleBeforeUnload = (event) => {
    const isInternal = sessionStorage.getItem('internalNavigation') === 'true';
    
    if (isInternal) {
      // DON'T remove it here - let it persist through reload
      return; // Don't show warning
    }

    const message = 'Are you sure you want to close? This will shut down the experiment platform.';
    event.preventDefault();
    event.returnValue = message;
    return message;
  };

  const handleUnload = () => {
    const isInternal = sessionStorage.getItem('internalNavigation') === 'true';
    
    if (isInternal) {
      // DON'T remove it here - let the next page load clear it
      return; // Don't shutdown server
    }

    fetch('http://localhost:5001/api/shutdown', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        source: 'app_close'
      }),
      keepalive: true
    }).catch(error => {
      console.error('Shutdown failed:', error);
    });
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('unload', handleUnload);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('unload', handleUnload);
  };
}, []); // Note: empty dependency array - only runs once on mount

  const path = window.location.pathname;
  if (path.includes('/experimenter')) {
    return <ExperimenterInterface />;
  }
  if (path.includes('/subject')) {
    return <SubjectInterface />;
  }

  const renderCurrentView = () => {
    switch(currentView) {
      case 'builder':
        return <ExperimentBuilder onBack={() => {
          setCurrentView('home');
          window.history.replaceState({}, document.title, window.location.pathname);
        }} />;
      case 'runner':
        return <ExperimentRunner onBack={() => setCurrentView('home')} />;
      default:
        return (
          <div className="home-page">
            <h1>Cognitive Science Experiment Platform</h1>
            <p>Build and run your cognitive science experiments</p>
            <div className="main-buttons">
              <button 
                className="main-button builder-button"
                onClick={() => setCurrentView('builder')}
              >
                <h3>Build Experiment</h3>
                <p>Create and design new experiments</p>
              </button>
              <button 
                className="main-button runner-button"
                onClick={() => setCurrentView('runner')}
              >
                <h3>Run Experiment</h3>
                <p>Load and execute saved experiments</p>
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="App">
      {renderCurrentView()}
    </div>
  );
}

export default App;
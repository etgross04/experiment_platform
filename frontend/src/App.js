import React, { useState, useEffect } from 'react';
import ExperimentBuilder from './components/ExperimentBuilder';
import ExperimentRunner from './components/ExperimentRunner';
import ExperimenterInterface from './components/ExperimenterInterface';  
import SubjectInterface from './components/SubjectInterface';            
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('home');

  // Check URL parameters on mount to handle deep linking
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    
    if (view === 'builder') {
      setCurrentView('builder');
    } else if (view === 'runner') {
      setCurrentView('runner');
    }
  }, []);

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
          // Clear URL parameters when going back
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
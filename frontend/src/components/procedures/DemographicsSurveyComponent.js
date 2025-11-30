/**
 * DemographicsSurveyComponent renders a demographics survey for participants.
 * 
 * Depending on the survey method specified in the procedure configuration, it either:
 * - Opens an external survey link in a new window, or
 * - Embeds a Google Form with autofilled participant information.
 * 
 * The component handles loading states, error handling, and provides instructions for completing the survey.
 *
 * Props:
 * @param {Object} procedure - The procedure object containing survey configuration.
 * @param {string} sessionId - The current participant's session ID, used for autofilling survey data.
 *
 * State:
 * - surveyUrl: The URL of the survey to display or open.
 * - loading: Indicates if the survey URL is being loaded.
 * - error: Stores any error message encountered during loading.
 * - externalWindowOpened: Tracks if the external survey window has been opened.
 *
 * Usage:
 * Renders instructions, handles survey loading, and displays either an external link button or an embedded survey form.
 */

import React, { useState, useEffect, useCallback } from 'react';
import './SurveyComponent.css';

const DemographicsSurveyComponent = ({ procedure, sessionId }) => {
  const [surveyUrl, setSurveyUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [externalWindowOpened, setExternalWindowOpened] = useState(false);

  const getSurveyMethod = useCallback(() => {
    return procedure?.configuration?.['survey-method']?.surveyMethod || 'external';
  }, [procedure]);

  const loadSurveyUrl = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const surveyMethod = getSurveyMethod();
      const surveyLinkConfig = procedure?.configuration?.['survey-link'];

      if (surveyMethod === 'external') {
        if (!surveyLinkConfig?.externalLink) {
          setError('External survey link not configured. Please contact the experimenter.');
          setLoading(false);
          return;
        }
        setSurveyUrl(surveyLinkConfig.externalLink);
        setLoading(false);
      } else if (surveyMethod === 'google_embedded') {
        if (!surveyLinkConfig?.googleFormUrl) {
          setError('Google Forms URL not configured. Please contact the experimenter.');
          setLoading(false);
          return;
        }

        const response = await fetch('/api/get-autofilled-survey-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: sessionId,
            survey_name: 'Demographics Survey',
            survey_url: surveyLinkConfig.googleFormUrl
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setSurveyUrl(data.autofilled_url);
        } else {
          setError(data.error || 'Failed to load survey URL');
        }
      }
    } catch (error) {
      console.error('Error loading survey URL:', error);
      setError('Failed to load survey. Please contact the experimenter.');
    } finally {
      setLoading(false);
    }
  }, [procedure, sessionId, getSurveyMethod]);

  useEffect(() => {
    loadSurveyUrl();
  }, [loadSurveyUrl]);

  const handleOpenExternalLink = () => {
    if (surveyUrl) {
      window.open(surveyUrl, 'demographics-survey', 'width=1000,height=800,scrollbars=yes,resizable=yes');
      setExternalWindowOpened(true);
    }
  };

  const surveyMethod = getSurveyMethod();
  const isExternal = surveyMethod === 'external';

  return (
    <div className="survey-component">
      <div className="procedure-header">
        <div className="procedure-title">
          <h2>Demographics Survey</h2>
          <h3>Please complete the demographics information</h3>
        </div>
      </div>

      <div className="procedure-content">
        <div className="task-instructions">
          <h4>Instructions</h4>
          <ul>
            <li>Please provide accurate demographic information</li>
            <li>All responses are confidential and will only be used for research purposes</li>
            {isExternal ? (
              <>
                <li>Click the button below to open the survey in a new window</li>
                <li>Complete the survey in the new window</li>
                <li>Once submitted, click "Task Complete" to continue</li>
              </>
            ) : (
              <>
                <li>Complete the embedded survey form below</li>
                <li>Your participant information has been pre-filled</li>
                <li>Once you submit the survey, click "Task Complete" to continue</li>
              </>
            )}
          </ul>
        </div>

        <div className="survey-interface">
          {loading && (
            <div className="survey-loading">
              <div className="loading-spinner">⏳</div>
              <p>Loading survey...</p>
            </div>
          )}

          {error && (
            <div className="survey-error">
              <div className="error-icon">❌</div>
              <h4>Survey Loading Error</h4>
              <p>{error}</p>
              <button onClick={loadSurveyUrl} className="retry-btn">
                🔄 Retry
              </button>
            </div>
          )}

          {!loading && !error && surveyUrl && (
            <>
              {isExternal ? (
                <div className="external-survey-container">
                  <div className="external-survey-card">
                    <h4>Open Demographics Survey</h4>
                    <p>Click the button below to open the survey in a new window.</p>
                    <button 
                      onClick={handleOpenExternalLink} 
                      className="open-external-btn"
                    >
                      🔗 Open Survey
                    </button>
                    {externalWindowOpened && (
                      <div className="external-survey-note">
                        <p>✅ Survey window opened</p>
                        <p>Complete the survey in the new window, then click "Task Complete" below.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="survey-container">
                  <div className="survey-frame-container">
                    <iframe
                      src={surveyUrl}
                      width="100%"
                      height="600"
                      frameBorder="0"
                      title="Demographics Survey"
                      className="survey-iframe"
                    >
                      Loading survey...
                    </iframe>
                  </div>
                  
                  <div className="survey-completion-note">
                    <p><strong>Important:</strong> After submitting your responses in the survey above, please click the "Task Complete" button below to continue with the experiment.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DemographicsSurveyComponent;
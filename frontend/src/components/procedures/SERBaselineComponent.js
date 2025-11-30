/**
 * SERBaselineComponent
 * 
 * React component for conducting a Speech Emotion Recognition (SER) baseline recording session.
 * 
 * This component guides the user through a series of spoken questions, records their responses,
 * and manages the flow of the SER baseline procedure. It interacts with backend endpoints to
 * initialize the session, fetch questions, process answers, and handle completion.
 * 
 * Props:
 * @param {string} sessionId - Unique identifier for the current session.
 * @param {function} onTaskComplete - Callback function invoked when the SER baseline task is completed.
 * @param {object} procedure - Procedure configuration object containing question set information.
 * 
 * State:
 * - hasStarted: Indicates if the baseline recording session has started.
 * - currentQuestion: The current question being displayed to the user.
 * - isRecording: Indicates if audio recording is active.
 * - recordingStatus: Status message for the recording process.
 * - taskCompleted: Indicates if all questions have been answered and the task is complete.
 * - questionIndex: Index of the current question in the sequence.
 * - isSubmitting: Indicates if an answer is being submitted.
 * 
 * Usage:
 * Renders instructions, manages recording controls, displays questions, and handles user interaction
 * for submitting answers and completing the baseline session.
 */

import React, { useState, useEffect, useRef } from 'react';
import { startRecording, setEventMarker } from '../utils/helpers.js';
import './SERBaselineComponent.css';

const SERBaselineComponent = ({ sessionId, onTaskComplete, procedure }) => {
  const [hasStarted, setHasStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('');
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const componentMountedRef = useRef(true);

  useEffect(() => {
    setEventMarker('ser_baseline');
  }, []);

  const getQuestionSet = () => {
    const questionSet = procedure?.configuration?.['question-set']?.questionSet;
    return questionSet || 'ser_1';
  };

  const handleBegin = async () => {
    try {
        setRecordingStatus('Starting...');
        setEventMarker('ser_baseline');
    
        const questionSet = getQuestionSet();
        await fetch('/initialize_ser_baseline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionSet })
        });
      
        await startRecording();
        setIsRecording(true);
        setHasStarted(true);
        setRecordingStatus('Recording... Please speak clearly.');
        
        setTimeout(async () => {
            await fetchNextQuestion();
        }, 200);
        
    } catch (error) {
        console.error('Error starting SER baseline:', error);
        setRecordingStatus('Error starting recording. Please try again.');
        alert('Error starting recording: ' + error.message);
    }
};

  const fetchNextQuestion = async () => {
    try {
        console.log('🔍 fetchNextQuestion called');
        const questionSet = getQuestionSet();
        console.log('📝 Question set:', questionSet);
        
        const response = await fetch('/get_ser_question', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ questionSet })
        });
        
        console.log('📡 Response status:', response.status);
        const data = await response.json();
        console.log('📦 Response data:', data);
        
        if (data.message === 'SER task completed.') {
            console.log('✅ Task completed');
            setIsRecording(false);
            setTaskCompleted(true);
            setCurrentQuestion('No more questions. Please click "Task Complete" to proceed to the next step.');
            setRecordingStatus('Task completed.');
        } else if (data.question) {
            console.log('Setting question:', data.question);
        
            setTimeout(() => {
                setCurrentQuestion(data.question);
                setRecordingStatus('Recording... Please speak clearly. Press "Submit Answer" when finished.');
                
                if (data.question_index !== undefined) {
                    setQuestionIndex(data.question_index + 1);
                }
            }, 100);
        } else {
            console.log('❌ No question in response, data:', data);
            setRecordingStatus('Error loading question.');
        }
        
    } catch (error) {
        console.error('Error fetching question:', error);
        setRecordingStatus('Error loading question. Please try again.');
    }
};

  const handleSubmitAnswer = async () => {
    if (isSubmitting || taskCompleted) return;
    
    setIsSubmitting(true);
    setRecordingStatus('Processing answer...');
    
    try {
      const response = await fetch('/process_ser_answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!componentMountedRef.current) return;
      
      if (data.status === 'error') {
        setRecordingStatus(data.message);
        setIsSubmitting(false);
        return;
      }
      
      setRecordingStatus(data.status);
      console.log('Answer processed:', data.message);
      
      try {
        await startRecording();
        setIsRecording(true);
        await fetchNextQuestion();
      } catch (error) {
        console.error('Error starting next recording:', error);
        setRecordingStatus('Error starting next recording.');
      }
      
    } catch (error) {
      console.error('Error submitting answer:', error);
      setRecordingStatus('Error submitting answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTaskComplete = () => {
    setEventMarker('subject_idle');
    if (onTaskComplete) {
      onTaskComplete();
    }
  };

  return (
    <div className="ser-baseline-component">
      <div className="procedure-header">
        <div className="procedure-title">
          <h2>SER Baseline Recording</h2>
          {/* <h3>Speech Emotion Recognition - {getQuestionSetDisplayName()}</h3> */}
        </div>
        <div className="procedure-meta">
          {hasStarted && !taskCompleted && (
            <div className="question-progress">
              Question {questionIndex} in progress
            </div>
          )}
        </div>
      </div>

      <div className="procedure-content">
        <div className="task-instructions">
          <h4>Instructions</h4>
          <ul>
            <li>Press "Begin" to start recording</li>
            <li>Speak your answer to each question aloud</li>
            <li>Press "Submit Answer" to register your answer and receive the next question</li>
          </ul>
        </div>

        <div className="task-interface">
          {!hasStarted && !taskCompleted && (
            <div className="start-section">
              <div className="start-content">
                <h3>Ready to Begin?</h3>
                <p>When you're ready, click the button below to start the baseline recording session.</p>
                <button 
                  onClick={handleBegin}
                  className="begin-btn"
                  disabled={false}
                >
                  🎤 Begin SER Baseline
                </button>
              </div>
            </div>
          )}

          {hasStarted && !taskCompleted && (
            <div className="question-section">
              <div className="question-display">
                <h3>Current Question</h3>
                <div className="question-text">
                  {currentQuestion || 'Loading question...'}
                </div>
                
                <div className="recording-controls">
                  <button
                    onClick={handleSubmitAnswer}
                    className={`submit-btn ${isSubmitting ? 'submitting' : ''}`}
                    disabled={isSubmitting || !currentQuestion}
                  >
                    {isSubmitting ? '⏳ Submitting...' : '✅ Submit Answer'}
                  </button>
                </div>
                
                <div className="recording-status">
                  <div className={`status-indicator ${isRecording ? 'recording' : ''}`}>
                    {isRecording && <span className="recording-dot"></span>}
                    {recordingStatus}
                  </div>
                </div>
              </div>
            </div>
          )}

          {taskCompleted && (
            <div className="completion-section">
              <div className="completion-content">
                <h3>✅ SER Baseline Complete</h3>
                <p>Thank you for completing the Speech Emotion Recognition baseline recording.</p>
                <p>All questions have been answered and recorded successfully.</p>
                <div className="completion-stats">
                  <p><strong>Questions Completed:</strong> {questionIndex}</p>
                </div>
                <button 
                  onClick={handleTaskComplete}
                  className="complete-btn"
                >
                  Task Complete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="task-status">
        <div className="status-indicator">
          <div className={`status-dot ${isRecording ? 'active' : ''}`}></div>
          <span>
            {taskCompleted ? 'Task completed' : 
             isRecording ? 'Recording in progress...' : 
             hasStarted ? 'Ready for next question' : 
             'Ready to begin'}
          </span>
        </div>
        <div className="progress-info">
          {hasStarted && (
            <span>
              {taskCompleted ? `Completed ${questionIndex} questions` : 
               `Question ${questionIndex} ${isRecording ? 'recording' : 'ready'}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SERBaselineComponent;
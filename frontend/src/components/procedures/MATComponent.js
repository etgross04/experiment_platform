import React, { useState, useEffect, useCallback, useRef } from 'react';

class AudioPlayer {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    
    this.buffer = null;
    this.source = null;
    this.startTime = 0;
    this.pauseTime = 0;
    this.isPlaying = false;
    this.isPaused = false;
  }

  async load(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    this.buffer = await this.audioContext.decodeAudioData(arrayBuffer);
  }

  play(loop = false) {
    if (!this.buffer) {
      console.error('Sound not loaded.');
      return;
    }

    if (this.isPlaying && !this.isPaused) {
      this.stop();
    }

    this.source = this.audioContext.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.loop = loop;
    this.source.connect(this.gainNode);

    const offset = this.isPaused ? this.pauseTime : 0;
    this.startTime = this.audioContext.currentTime - offset;
    this.source.start(0, offset);

    this.isPlaying = true;
    this.isPaused = false;
  }

  stop() {
    if (this.source) {
      this.source.stop();
      this.source = null;
      this.isPlaying = false;
      this.isPaused = false;
      this.pauseTime = 0;
    }
  }

  setVolume(value) {
    this.gainNode.gain.setValueAtTime(value, this.audioContext.currentTime);
  }
}

const MATComponent = ({ procedure, sessionId, onTaskComplete }) => {
  const getTestConfig = () => {
    console.log('=== MAT DEBUG ===');
    console.log('Full procedure object:', procedure);
    console.log('procedure.customDuration:', procedure?.customDuration);
    console.log('procedure.configuration:', procedure?.configuration);
    console.log('stressor-type config:', procedure?.configuration?.['stressor-type']);
    console.log('matQuestionSet value:', procedure?.configuration?.['stressor-type']?.matQuestionSet);

    const duration = procedure?.customDuration || procedure?.duration || 5; // minutes
    const selectedSet = procedure?.configuration?.['stressor-type']?.matQuestionSet || 'mat_1';
    
    // Map question set IDs to test numbers
    const setToTestNumber = {
      'mat_practice': 0,
      'mat_1': 1,
      'mat_2': 2
    };
    
    const testNumber = setToTestNumber[selectedSet] ?? 1;
    console.log('testNumber:', testNumber);
    console.log('=================');
    
    // Get configuration based on test number
    const testConfigs = {
      0: {
        testNumber: 0,
        eventMarker: 'practice_stressor_test',
        restartNumber: "20",
        numToSubtract: "5",
        initialTime: duration * 60,
        countdownTime: 10,
        duration: duration,
        description: 'Practice Test (Subtract 5 from 20)'
      },
      1: {
        testNumber: 1,
        eventMarker: 'stressor_test_1',
        restartNumber: "1,009",
        numToSubtract: "13",
        initialTime: duration * 60,
        countdownTime: 10,
        duration: duration,
        description: 'Test 1 (Subtract 13 from 1,009)'
      },
      2: {
        testNumber: 2,
        eventMarker: 'stressor_test_2',
        restartNumber: "1,059",
        numToSubtract: "17",
        initialTime: duration * 60,
        countdownTime: 10,
        duration: duration,
        description: 'Test 2 (Subtract 17 from 1,059)'
      }
    };
    
    return testConfigs[testNumber];
  };

  const testConfig = getTestConfig();
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState('');
  const [result, setResult] = useState('');
  const [clockStatus, setClockStatus] = useState('');
  
  // Test State
  const [testStarted, setTestStarted] = useState(false);
  const [testEnded, setTestEnded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [manualStop, setManualStop] = useState(false);
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(testConfig.initialTime);
  const [countdownTimeLeft, setCountdownTimeLeft] = useState(testConfig.countdownTime);
  const [timerEnded, setTimerEnded] = useState(false);
  const [pendingTimerExpiration, setPendingTimerExpiration] = useState(false);
  const abortControllerRef = useRef(null);
  
  // Audio State
  const [transcription, setTranscription] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [currentVolumeStage, setCurrentVolumeStage] = useState(0);
  const [speedMessagePlayed, setSpeedMessagePlayed] = useState(false);
  const [accuracyMessagePlayed, setAccuracyMessagePlayed] = useState(false);

  const audioContextRef = useRef(null);
  const audioPlayersRef = useRef({});
  const timerIntervalRef = useRef(null);
  const processAnswerRef = useRef(null);
  const isPausedRef = useRef(false);

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    
    const audioPlayers = {
      tickingSound: new AudioPlayer(audioContextRef.current),
      speedMessage: new AudioPlayer(audioContextRef.current),
      accuracyMessage: new AudioPlayer(audioContextRef.current),
      correctSound: new AudioPlayer(audioContextRef.current),
      incorrectSound: new AudioPlayer(audioContextRef.current),
      restartSound: new AudioPlayer(audioContextRef.current)
    };
    
    audioPlayersRef.current = audioPlayers;

    return () => {
      Object.values(audioPlayers).forEach(player => player.stop());
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const confirmTranscription = useCallback(async (timeUpParam) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
    try {
      const response = await fetch('/confirm_transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_up: timeUpParam, test_status: testEnded }),
        signal: controller.signal
      });
      
      const data = await response.json();
      setTranscription(data.transcription);
      
      if (!timeUpParam) {
        setShowConfirmation(true);
      } else {
        if (processAnswerRef.current) {
          processAnswerRef.current();
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.log('Transcription confirmation timed out or aborted');
        setTestStatus("Connection issue - please try again.");
        return;
      }
      console.error('Error:', error);
    } finally {
      clearTimeout(timeoutId);
    }
  }, [testEnded]);

  const processAnswer = useCallback(async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    abortControllerRef.current = new AbortController();
    
    if (!timeUp && !manualStop) {
      setTestStatus("Analyzing Answer...");
    }
    
    try {
      const response = await fetch('/process_answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_status: testEnded || manualStop }),
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'complete' || manualStop) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        isPausedRef.current = true; // Update ref
        audioPlayersRef.current.tickingSound.stop();
        setTestStatus(data.message || 'Task completed manually');
        setResult(data.result || 'Task stopped');
        setTestStarted(false);
        
        await fetch('/set_event_marker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_marker: 'subject_idle' })
        });
        
        if (onTaskComplete) {
          setTimeout(() => {
            onTaskComplete();
          }, 1000);
        }
        return;
      }
      
      if (timeUp) {
        audioPlayersRef.current.incorrectSound.play(false);
        audioPlayersRef.current.restartSound.play(false);
        setResult(`Please start again from ${testConfig.restartNumber}.`);
        setTestStatus("Recording... Speak your answer and submit when ready.");
      } else if (data.result === 'correct') {
        audioPlayersRef.current.correctSound.play(false);
        setResult(`Correct. Now subtract ${testConfig.numToSubtract} from your answer.`);
        setTestStatus("Recording... Speak your answer and submit when ready.");
      } else if (data.result === 'incorrect') {
        audioPlayersRef.current.incorrectSound.play(false);
        audioPlayersRef.current.restartSound.play(false);
        setResult(`Incorrect. Please start again from ${testConfig.restartNumber}.`);
        setTestStatus("Recording... Speak your answer and submit when ready.");
      }
      
      // Reset for next question
      setCountdownTimeLeft(testConfig.countdownTime);
      setTimerEnded(false);
      setTimeUp(false);
      setShowConfirmation(false);
      isPausedRef.current = false; // Update ref
      audioPlayersRef.current.tickingSound.setVolume(0.2);
      setCurrentVolumeStage(0);
      
    } catch (error) {
      // Don't show error if request was aborted due to timer expiration
      if (error.name === 'AbortError') {
        console.log('Request aborted due to timer expiration');
        return;
      }
      
      console.error('Error:', error);
      setTestStatus("Something went wrong. Please repeat your answer.");
      setCountdownTimeLeft(testConfig.countdownTime);
      setTimerEnded(false);
      isPausedRef.current = false; // Update ref
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
      
      // Check if timer expired while we were processing
      if (pendingTimerExpiration) {
        console.log("Processing complete - handling pending timer expiration");
        setPendingTimerExpiration(false);
        confirmTranscription(true);
        return; // Don't execute normal completion logic
      }
    }
  }, [isProcessing, timeUp, testEnded, manualStop, testConfig.restartNumber, testConfig.numToSubtract, testConfig.countdownTime, onTaskComplete, pendingTimerExpiration, confirmTranscription]);

  useEffect(() => {
    processAnswerRef.current = processAnswer;
  }, [processAnswer]);

  const endTest = useCallback(async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    isPausedRef.current = true; // Update ref
    audioPlayersRef.current.tickingSound.stop();
    setTestEnded(true);
    setTestStarted(false);
    
    setTestStatus('Time is up! Please let the experimenter know that you have completed this section.');
    
    await fetch('/set_event_marker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_marker: 'subject_idle' })
    });
  }, []);

  const setupAudio = useCallback(async () => {
    const { tickingSound, correctSound, incorrectSound, restartSound, speedMessage, accuracyMessage } = audioPlayersRef.current;
    const safeLoad = async (audioPlayer, url, description) => {
      try {
        console.log(`Attempting to load ${description} from ${url}`);
        await audioPlayer.load(url);
        console.log(`✓ Successfully loaded ${description}`);
        return true;
      } catch (error) {
        console.warn(`⚠️ Could not load ${description} from ${url}:`, error.message);
        
        const context = audioPlayer.audioContext;
        const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.1), context.sampleRate);
        audioPlayer.buffer = buffer;
        console.log(`→ Created silent fallback for ${description}`);
        return false;
      }
    };

    try {
      await safeLoad(tickingSound, '/test_audio/ticking.mp3', 'ticking sound');
      await safeLoad(correctSound, '/test_audio/correct_v2.mp3', 'correct sound');
      await safeLoad(incorrectSound, '/test_audio/incorrect_v2.mp3', 'incorrect sound');
      
      tickingSound.setVolume(0.2);
      correctSound.setVolume(0.4);
      incorrectSound.setVolume(0.4);
      
      if (testConfig.testNumber === 0) {
        await safeLoad(restartSound, '/test_audio/Practice_Test_Restart.mp3', 'practice restart sound');
      } else if (testConfig.testNumber === 1) {
        await safeLoad(restartSound, '/test_audio/Test1_Restart.mp3', 'test 1 restart sound');
        await safeLoad(speedMessage, '/test_audio/speed_1.mp3', 'speed message 1');
        await safeLoad(accuracyMessage, '/test_audio/accuracy_1.mp3', 'accuracy message 1');
      } else if (testConfig.testNumber === 2) {
        await safeLoad(restartSound, '/test_audio/Test2_Restart.mp3', 'test 2 restart sound');
        await safeLoad(speedMessage, '/test_audio/speed_2.mp3', 'speed message 2');
        await safeLoad(accuracyMessage, '/test_audio/accuracy_2.mp3', 'accuracy message 2');
      }
      
      if (restartSound.buffer) restartSound.setVolume(0.8);
      if (speedMessage.buffer) speedMessage.setVolume(0.8);
      if (accuracyMessage.buffer) accuracyMessage.setVolume(0.8);
      
      console.log('Audio setup completed');
      
    } catch (error) {
      console.error('Error setting up audio system:', error);
    }
  }, [testConfig.testNumber]);

  const setTest = useCallback(async () => {
    try {
      const response = await fetch('/set_current_test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_number: testConfig.testNumber })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(data);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to set test number.');
    }
  }, [testConfig.testNumber]);

  const startClock = useCallback(() => {
    if (!timerIntervalRef.current) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          if (newTime < 0) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
            endTest();
            return 0;
          }
          return newTime;
        });
        
        if (!isPausedRef.current) {
          setCountdownTimeLeft(prev => {
            const newCountdown = prev - 1;
            
            if (newCountdown <= 7 && newCountdown > 5 && currentVolumeStage !== 1) {
              audioPlayersRef.current.tickingSound.setVolume(0.35);
              setCurrentVolumeStage(1);
            } else if (newCountdown <= 5 && newCountdown > 3 && currentVolumeStage !== 2) {
              audioPlayersRef.current.tickingSound.setVolume(0.65);
              setCurrentVolumeStage(2);
            } else if (newCountdown <= 3 && newCountdown > 0 && currentVolumeStage !== 3) {
              audioPlayersRef.current.tickingSound.setVolume(1.0);
              setCurrentVolumeStage(3);
            }
            
            if (newCountdown <= 0 && !timerEnded) {
              isPausedRef.current = true; 
              setTimerEnded(true);
              setTimeUp(true);
              setClockStatus("Time's up!");
              setResult(`Please start over at ${testConfig.restartNumber}.`);
              
              if (isProcessing) {
                setPendingTimerExpiration(true);

                console.log("Timer expired while processing - marking as pending");

                if (abortControllerRef.current) {
                  abortControllerRef.current.abort();
                }
              } else {
                confirmTranscription(true);
              }
            }
            
            return Math.max(0, newCountdown);
          });
        }
        
        if (testConfig.testNumber !== 0 && timeLeft > 0) {
          if (timeLeft <= 180 && !speedMessagePlayed) {
            audioPlayersRef.current.speedMessage.play(false);
            setSpeedMessagePlayed(true);
          } else if (timeLeft <= 60 && !accuracyMessagePlayed) {
            audioPlayersRef.current.accuracyMessage.play(false);
            setAccuracyMessagePlayed(true);
          }
        }
      }, 1000);
    }
  }, [timerEnded, isProcessing, timeLeft, currentVolumeStage, speedMessagePlayed, accuracyMessagePlayed, testConfig.testNumber, testConfig.restartNumber, endTest, confirmTranscription]);

  const stopClock = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopClock();
    };
  }, [stopClock]);

  const startTest = useCallback(async () => {
    if (testStarted) {
      alert("Test already started.");
      return;
    }

    setIsLoading(true);
    setTestStatus('Please wait...');
    
    try {
      await setTest();
      await setupAudio();
      
      await fetch('/set_event_marker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_marker: testConfig.eventMarker })
      });
      
      const response = await fetch('/get_first_question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(data);
      
      setIsLoading(false);
      setTestStatus('Recording... Speak your answer and submit when ready.');
      setClockStatus('');
      setTestStarted(true);
      startClock();
      audioPlayersRef.current.tickingSound.play(true);
      
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to start test.');
      setIsLoading(false);
    }
  }, [testStarted, testConfig.eventMarker, setTest, setupAudio, startClock]);

  const submitAnswer = useCallback(async () => {
    isPausedRef.current = true; 
    setClockStatus('');
    setTestStatus('');
    
    await confirmTranscription(false);
  }, [confirmTranscription]);

  const startRecording = useCallback(async () => {
    try {
      const response = await fetch('/start_recording', {
        method: 'POST'
      });
      const data = await response.json();
      console.log("Recording started", data.status);
    } catch (error) {
      console.error('Recording Error:', error);
    }
  }, []);

  const handleConfirmationYes = useCallback(() => {
    setShowConfirmation(false);
    processAnswer();
  }, [processAnswer]);

  const handleConfirmationNo = useCallback(async () => {
    setShowConfirmation(false);
    isPausedRef.current = false; 
    await startRecording();
    setTestStatus("Recording... Please repeat your answer and submit when ready.");
  }, [startRecording]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mat-component">
      <div className="procedure-header">
        <div className="procedure-title">
          <h2>Mental Arithmetic Task</h2>
          <h3>{testConfig.description}</h3>
        </div>
        <div className="procedure-meta">
          <div className="duration">Duration: {testConfig.duration} minutes</div>
        </div>
      </div>

      <div className="procedure-content">
        <div className="task-instructions">
          <h4>Instructions</h4>
          <ul>
            <li>Start with the number {testConfig.restartNumber}. For your first answer, subtract {testConfig.numToSubtract} from {testConfig.restartNumber}.</li>
            <li>Continue subtracting {testConfig.numToSubtract} from each new result until the screen prompts you to stop.</li>
            <li>Speak each answer aloud using single digit responses for best result (e.g. "One, Nine, Six" for 196) and press the "Submit" button to check your answer.</li>
            <li>If your answer is incorrect, the screen will inform you and prompt you to restart from {testConfig.restartNumber}.</li>
            <li>Try to be as accurate and fast as possible while completing the task.</li>
          </ul>
        </div>

        <div className="task-interface">
          {!testStarted ? (
            <div className="task-controls">
              <button 
                onClick={startTest} 
                disabled={isLoading}
                className="response-btn primary"
              >
                {isLoading ? 'Loading...' : 'Start Test'}
              </button>
            </div>
          ) : (
            <div className="task-area-single-column">
              <div className="stimulus-display">
                <div className="timer-display">
                  <div className="main-timer">
                    <h3>Total Time: {formatTime(timeLeft)}</h3>
                  </div>
                  <div className="countdown-timer">
                    <h4>Response Time: {countdownTimeLeft}</h4>
                  </div>
                  <div className="clock-status" style={{ color: 'red' }}>{clockStatus}</div>
                </div>
                
                <div className="result-display">
                  <div className="test-status">{testStatus || '\u00A0'}</div>
                  <div className="result-text">{result || '\u00A0'}</div>
                </div>

              </div>

              <div className="response-area">
                <div className="response-instructions">
                  <h4>Your Response</h4>
                  <p>Speak your answer clearly and press Submit</p>
                </div>

                <div className="response-controls-fixed">
                  <div className={`confirmation-dialog-fixed ${showConfirmation ? 'visible' : 'hidden'}`}>
                    <p className="transcription-text">{transcription || '\u00A0'}</p>
                    <div className="confirmation-buttons-fixed">
                      <button 
                        onClick={handleConfirmationYes} 
                        className="response-btn primary"
                        disabled={!showConfirmation}
                        style={{ visibility: showConfirmation ? 'visible' : 'hidden' }}
                      >
                        Yes
                      </button>
                      <button 
                        onClick={handleConfirmationNo} 
                        className="response-btn secondary"
                        disabled={!showConfirmation}
                        style={{ visibility: showConfirmation ? 'visible' : 'hidden' }}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  <div className="submit-button-container-fixed">
                    <button 
                      onClick={submitAnswer} 
                      disabled={isProcessing || showConfirmation}
                      className="response-btn primary submit-btn-fixed"
                    >
                      Submit Answer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="task-status">
        <div className="status-indicator">
          <div className={`status-dot ${testStarted ? 'active' : ''}`}></div>
          <span>{testStarted ? 'Test Active' : 'Test Ready'}</span>
        </div>
      </div>
    </div>
  );
};

export default MATComponent;
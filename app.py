"""
Flask Application - Experimental Psychology Platform Backend Server

DESCRIPTION:
    Main Flask application serving as the backend for an experimental psychology platform.
    Handles experiment management, session control, real-time data streaming, hardware
    sensor integration (EmotiBit, Polar HR, Vernier), audio recording, transcription,
    speech emotion recognition (SER), and database operations.

GLOBAL STATE:
    session_queues (dict): SSE message queues per session {session_id: Queue}
    session_completions (dict): Procedure completion tracking {session_id: {completed_procedures, current_procedure}}
    experimenter_heartbeats (dict): Heartbeat timestamps for cleanup monitoring {session_id: {last_seen, missed_beats}}
    update_event (threading.Event): Global event for SSE broadcasting
    update_message (dict): Current broadcast message for SSE
    ACTIVE_SESSIONS (dict): Active experiment sessions {session_id: session_data}
    
    Manager instances:
        event_manager (EventManager): EmotiBit event marker management
        subject_manager (SubjectManager): Participant data management
        audio_file_manager (AudioFileManager): Audio file storage
        recording_manager (RecordingManager): Audio recording control
        test_manager (TestManager): Mental Arithmetic Task (MAT) question management
        ser_manager (SERManager): Speech emotion recognition
        form_manager (FormManager): Google Forms URL customization
        vernier_manager (VernierManager): Respiratory sensor streaming
        polar_manager (PolarManager): Polar H10 heart rate streaming
        lsl_manager (LSLManager): Lab Streaming Layer markers
        transcription_manager (TranscriptionManager): Audio-to-text conversion

CONSTANTS:
    EXPERIMENT_TEMPLATES_DIR (str): "experiments/templates" - Saved experiment designs
    EXPERIMENT_SUBJECT_DATA_DIR (str): "experiments/subject_data" - Participant data storage
    TEST_FILES_DIR (str): "static/test_files" - Uploaded test configuration files
    CONSENT_FORMS_DIR (str): "static/consent_forms" - Consent form PDFs
    HEARTBEAT_TIMEOUT (int): 60 seconds - Max time between heartbeats before stale
    HEARTBEAT_GRACE_ATTEMPTS (int): 3 - Missed heartbeats before cleanup
    SHUTDOWN_FLAG (threading.Event): Signal for graceful shutdown

CONFIGURATION:
    Database config loaded from .env:
        DB_HOST: PostgreSQL host (default: localhost)
        DB_NAME: Database name (default: exp_platform_db)
        DB_USER: Database user (default: exp_user)
        DB_PASSWORD: Database password
        DB_PORT: Database port (default: 5432)

    Flask config:
        DEBUG: True
        static_folder: 'static'
        static_url_path: ''

    CORS enabled for /api/* routes

API ENDPOINTS:

=== EXPERIMENT MANAGEMENT ===

GET /api/experiment-config
    DESCRIPTION: Serves experiment configuration from experiments/experiment-config.json
    RETURNS: {procedures, categories, paradigms, wizardSteps}
    ERRORS: 404 if config not found, 500 on server error

GET /api/experiments
    DESCRIPTION: Lists all saved experiment templates
    RETURNS: [{id, name, description, created_at, estimated_duration, procedure_count, procedures}]
    NOTES: Sorted by created_at descending

POST /api/experiments
    DESCRIPTION: Saves new experiment template
    REQUEST: {name, procedures, dataCollectionMethods, created_at, estimated_duration}
    RETURNS: {success: true, id, message, filepath}
    ERRORS: 400 if name/procedures missing, 500 on save error
    PROCESSING:
        - Generates unique experiment ID from name + timestamp
        - Processes procedures through process_procedure_for_psychopy()
        - Sorts procedures by position
        - Saves to EXPERIMENT_TEMPLATES_DIR/{id}.json

GET /api/experiments/{experiment_id}
    DESCRIPTION: Retrieves specific experiment template
    RETURNS: Complete experiment object with procedures
    ERRORS: 404 if not found

PUT /api/experiments/{experiment_id}
    DESCRIPTION: Updates existing experiment template
    REQUEST: {name, procedures, dataCollectionMethods, created_at, estimated_duration}
    RETURNS: {success: true, id, message, filepath}
    ERRORS: 404 if not found, 400 if validation fails
    NOTES: Preserves original created_at, updates updated_at

POST /api/experiments/{experiment_id}/run
    DESCRIPTION: Creates new experiment session from template
    REQUEST: {participant_id: "anonymous"}
    RETURNS: {success: true, session_id, experiment_name}
    PROCESSING:
        - Loads experiment template
        - Generates session_id: {experiment_id}_{timestamp}
        - Creates ACTIVE_SESSIONS entry
        - Initializes session_completions
        - Calls instantiate_modules() to setup managers
    ERRORS: 404 if template not found, 500 on error

POST /api/save-template
    DESCRIPTION: Saves experiment as reusable paradigm template
    REQUEST: {name, description, category, color, procedures}
    RETURNS: {success: true, message, template_id}
    PROCESSING:
        - Generates template_id from name (lowercase, hyphenated)
        - Adds to experiment-config.json paradigms section
        - Appends timestamp if template_id already exists
    ERRORS: 400 if name/category missing

POST /api/add-psychopy-procedure
    DESCRIPTION: Adds custom external platform procedure to config
    REQUEST: {name, duration, category, platform, required, instructionSteps}
    RETURNS: {success: true, message, procedure, instruction_steps_added}
    PROCESSING:
        - Validates name, duration (1-120), platform, instruction steps
        - Generates procedure_id from name
        - Adds to experiment-config.json procedures
        - Creates wizard steps for psychopy-setup and task-description
        - Saves instruction steps to instruction-steps.json
    ERRORS: 400 if validation fails, 500 on server error

=== SESSION MANAGEMENT ===

POST /api/sessions/{session_id}/set-experiment-trial
    DESCRIPTION: Sets experiment/trial metadata for session
    REQUEST: {experiment_name, trial_name, student_first_name, student_last_name}
    RETURNS: {success: true, experiment_folder, trial_name}
    PROCESSING:
        - Sanitizes experiment_name and trial_name (lowercase, underscores)
        - Creates directory: EXPERIMENT_SUBJECT_DATA_DIR/{experiment_name}/{trial_name}
        - Updates subject_manager, vernier_manager, event_manager, polar_manager metadata
    ERRORS: 404 if session not found, 400 if fields missing

POST /api/sessions/{session_id}/participant
    DESCRIPTION: Saves participant registration information
    REQUEST: {participantInfo: {firstName, lastName, email, emailConfirm, pid, sonaClass}, timestamp}
    RETURNS: {success: true, message, subject_folder, subject_dir}
    PROCESSING:
        - Validates email is present
        - Creates subject_folder_name: {iso_date}_{sanitized_email}
        - Creates directory: {trial_dir}/{subject_folder_name}
        - Initializes all managers with subject metadata
        - Saves session.json to subject directory
        - Broadcasts participant_registered event via SSE
    ERRORS: 404 if session not found, 400 if experiment/trial not set

GET /api/sessions/{session_id}/info
    DESCRIPTION: Retrieves session metadata
    RETURNS: {success: true, session_data: {session_id, experiment_name, experiment_folder_name, trial_name, subject_folder, status, has_participant_info}}
    ERRORS: 404 if session not found

POST /api/sessions/{session_id}/heartbeat
    DESCRIPTION: Experimenter heartbeat to prevent stale session cleanup
    PROCESSING:
        - Updates experimenter_heartbeats[session_id] with current timestamp
        - Resets missed_beats counter
    RETURNS: {success: true}
    NOTES: Should be called every 5 seconds from experimenter interface

GET /api/sessions/{session_id}/check-active
    DESCRIPTION: Checks if session is still active (for subject reconnection)
    RETURNS: {success: true, active: bool, current_procedure, completed_procedures}
    THREAD-SAFE: Uses cleanup_lock for read

POST /api/sessions/{session_id}/cleanup-experimenter
    DESCRIPTION: Cleans up session when experimenter closes window
    PROCESSING:
        - Sets _cleanup_in_progress flag to prevent double-cleanup
        - Stops all running managers (event, vernier, polar, recording)
        - Saves session_terminated.json to subject directory
        - Broadcasts session_terminated event
        - Calls reset_experiment_managers()
        - Removes from session_queues, session_completions, experimenter_heartbeats, ACTIVE_SESSIONS
    RETURNS: {success: true, message}
    THREAD-SAFE: Uses cleanup_lock
    ERRORS: 500 on cleanup error

POST /api/sessions/{session_id}/complete-experiment
    DESCRIPTION: Marks experiment complete and resets system
    REQUEST: {timestamp, total_procedures, completed_procedures}
    PROCESSING:
        - Updates session with completion data
        - Saves session_final.json
        - Broadcasts experiment_completed event
        - Calls reset_experiment_managers()
        - Deletes session from all tracking dictionaries
    RETURNS: {success: true, message, experiment_name, subject_folder}
    ERRORS: 404 if session not found

POST /api/sessions/{session_id}/record-consent
    DESCRIPTION: Records participant consent for session
    REQUEST: {consentGiven: bool, consentMethod: str, timestamp}
    PROCESSING:
        - Saves consent record with IP address and user agent
        - Updates session status to 'consent_completed'
        - Saves consent_record.json to subject directory
    RETURNS: {success: true, message, consent_given}
    ERRORS: 404 if session not found

=== SSE (SERVER-SENT EVENTS) ===

GET /api/sessions/{session_id}/stream
    DESCRIPTION: Server-Sent Events stream for real-time updates
    EVENT TYPES:
        - procedure_changed: {event_type, session_id, current_procedure, completed_procedures}
        - audio_test_started: {event_type, session_id}
        - task_completed: {event_type, session_id, task_type, completed_procedures, current_procedure}
        - experiment_completed: {event_type, session_id}
        - participant_registered: {event_type, session_id}
        - session_terminated: {event_type, session_id, reason}
    HEADERS: Cache-Control: no-cache, Connection: keep-alive
    NOTES: Watches global update_event and update_message

POST /api/sessions/{session_id}/trigger-audio-test
    DESCRIPTION: Triggers audio test on subject interface
    PROCESSING: Broadcasts audio_test_started event via SSE
    RETURNS: {success: true}

POST /api/sessions/{session_id}/complete-procedure
    DESCRIPTION: Marks current procedure as complete
    REQUEST: {completed: bool, task_type: str, timestamp}
    PROCESSING:
        - Adds current_procedure to completed_procedures
        - Broadcasts task_completed event
    RETURNS: {success: true, completed_procedures}

POST /api/sessions/{session_id}/set-current-procedure
    DESCRIPTION: Updates current procedure index
    REQUEST: {current_procedure: int, procedure_name: str, timestamp}
    PROCESSING:
        - Updates session_completions[session_id]['current_procedure']
        - Broadcasts procedure_changed event
    RETURNS: {success: true, current_procedure}
    ERRORS: 500 on update error

GET /api/sessions/{session_id}/get-current-procedure
    DESCRIPTION: Gets current procedure index
    RETURNS: {success: true, current_procedure, completed_procedures}
    ERRORS: 404 if session not found

POST /api/sessions/{session_id}/close
    DESCRIPTION: Closes SSE connection for session
    PROCESSING:
        - Sends None to session queue
        - Deletes from session_queues and session_completions
    RETURNS: {success: true}

=== HARDWARE MANAGERS ===

POST /start_event_manager
    DESCRIPTION: Starts EmotiBit event marker collection
    PROCESSING:
        - Checks if data_folder is set
        - Initializes HDF5 file
        - Starts event_manager and lsl_manager
    RETURNS: {success: true, message}
    ERRORS: 400 if data_folder not set, 500 on error

POST /stop_event_manager
    DESCRIPTION: Stops EmotiBit event marker collection
    PROCESSING: Stops event_manager and lsl_manager
    RETURNS: {success: true, message}
    ERRORS: 500 on error

POST /start_polar_manager
    DESCRIPTION: Starts Polar H10 heart rate streaming
    PROCESSING:
        - Checks if polar_manager initialized and data_folder set
        - Initializes HDF5 file if not opened
        - Starts Polar device
    RETURNS: {success: true, message} OR {success: false, warning, message} if device not connected
    ERRORS: 400 if not initialized or data_folder not set

POST /stop_polar_manager
    DESCRIPTION: Stops Polar H10 heart rate streaming
    RETURNS: {success: true, message}
    ERRORS: 400 if not initialized

POST /start_vernier_manager
    DESCRIPTION: Starts Vernier respiratory sensor streaming
    PROCESSING:
        - Checks if vernier_manager initialized and data_folder set
        - Initializes HDF5 file if not opened
        - Starts Vernier device
        - Starts data collection thread
    RETURNS: {success: true, message} OR {success: false, warning, message} if device not connected
    ERRORS: 400 if not initialized or data_folder not set

POST /stop_vernier_manager
    DESCRIPTION: Stops Vernier respiratory sensor streaming
    RETURNS: {success: true, message}
    ERRORS: 400 if not initialized

GET /api/manager-status
    DESCRIPTION: Gets running status of all managers
    RETURNS: {success: true, status: {event_manager: bool, vernier_manager: bool, polar_manager: bool}, any_running: bool}
    ERRORS: 500 on error

POST /set_event_marker
    DESCRIPTION: Sets event marker for managers
    REQUEST: {event_marker: str}
    PROCESSING:
        - Sets event_marker on event_manager, vernier_manager, polar_manager
        - Sends marker via lsl_manager
    RETURNS: {status: "Event marker set."}
    ERRORS: 400 on error

POST /set_condition
    DESCRIPTION: Sets experimental condition
    REQUEST: {condition: str}
    PROCESSING: Sets event_manager.condition
    RETURNS: {success: true, message}
    ERRORS: 400 if condition empty, 500 on error

=== AUDIO MANAGEMENT ===

GET /get_audio_devices
    DESCRIPTION: Gets available audio input devices
    RETURNS: {devices: [{index, name}]}
    ERRORS: 400 if recording_manager not initialized, 500 on error

POST /set_device
    DESCRIPTION: Sets active audio input device
    REQUEST: {device_index: int}
    PROCESSING: Calls recording_manager.set_device(device_index)
    RETURNS: {message: "Device index set."}
    ERRORS: 400 if invalid index or error

POST /start_recording
    DESCRIPTION: Starts audio recording
    PROCESSING:
        - Calls recording_manager.start_recording()
        - Waits up to 10 seconds for stream to become active
    RETURNS: {status: "Recording started."} (200)
    ERRORS: 400 if timeout or error

POST /reset_audio
    DESCRIPTION: Resets audio system
    PROCESSING: Calls recording_manager.reset_audio_system()
    RETURNS: {message: "Audio system reset successfully..."}
    ERRORS: 400 if not initialized

POST /test_audio
    DESCRIPTION: Tests audio recording and transcription
    PROCESSING:
        - Stops current recording
        - Resamples to 16kHz
        - Transcribes audio
    RETURNS: {result: transcription_text}
    ERRORS: 400 if managers not initialized, 500 on error

POST /record_task_audio
    DESCRIPTION: Records audio for specific task question
    REQUEST: {action: "start"|"stop", question: str, event_marker: str, condition: str}
    PROCESSING:
        - action=start: Starts recording, sets event marker, sends LSL marker
        - action=stop: Stops recording, saves audio file, logs to subject_manager
    RETURNS: {message: "Recording started/stopped."}
    ERRORS: 400 on error

=== TRANSCRIPTION & SER ===

POST /process_audio_files
    DESCRIPTION: Batch processes all audio files in subject folder
    PROCESSING:
        - Lists all .wav files matching {subject_id}_* pattern
        - Transcribes each file (240s timeout)
        - Predicts top 3 emotions with confidence scores via SER
        - Writes CSV with columns: experiment_name, trial_name, subject_id, experimenter_name,
          timestamp_unix, timestamp_iso, file_name, transcription, SER_Emotion_Label_1-3,
          SER_Confidence_1-3
        - Saves to: {subject_folder}/{date}_{experiment}_{trial}_{subject}_SER.csv
    RETURNS: {message: "Audio files processed successfully.", path: csv_path}
    ERRORS: 500 on processing error

=== SER BASELINE PROCEDURE ===

POST /initialize_ser_baseline
    DESCRIPTION: Initializes SER baseline procedure with question set
    REQUEST: {questionSet: str} (default: "ser_1")
    PROCESSING: Calls test_manager.reset_ser_baseline(question_set)
    RETURNS: {status: "SER baseline initialized", question_set, total_questions}
    ERRORS: 400 if test_manager not initialized

POST /get_ser_question
    DESCRIPTION: Gets next SER baseline question
    REQUEST: {questionSet: str} (optional)
    PROCESSING:
        - Retrieves current question from test_manager
        - Increments question index
        - Stops recording if no more questions
    RETURNS: {message: "Question found", question: text, question_set, question_index} OR
             {message: "SER task completed.", question_set, total_completed}
    ERRORS: 400 on error

POST /process_ser_answer
    DESCRIPTION: Processes SER baseline answer
    PROCESSING:
        - Stops recording
        - Generates filename: {subject_id}_{timestamp}_ser_baseline_{question_set}_question_{index}.wav
        - Saves audio file
        - Logs to subject_manager
    RETURNS: {status: "Answer processed successfully.", question_set, question_index}
    ERRORS: 400 if recording_manager not initialized

POST /reset_ser_baseline
    DESCRIPTION: Resets SER baseline question index
    REQUEST: {questionSet: str} (default: "ser_1")
    PROCESSING: Calls test_manager.reset_ser_baseline(question_set)
    RETURNS: {status: "SER baseline reset successfully", question_set, total_questions}
    ERRORS: 400 if test_manager not initialized

GET /get_ser_question_sets
    DESCRIPTION: Gets available SER question sets and counts
    RETURNS: {status: "success", question_sets: {set_name: count}, current_set}
    ERRORS: 400 if test_manager not initialized

=== VR ROOM TASK ===

POST /api/vr-room/stop-recording
    DESCRIPTION: Stops recording for VR Room Task step
    REQUEST: {stepName: str, eventMarker: str, condition: str}
    PROCESSING:
        - Stops recording
        - Generates filename: {subject_id}_{timestamp}_vr_room_task_{stepName}.wav
        - Saves audio file
        - Logs to subject_manager
    RETURNS: {status: "Recording stopped and saved.", file_name}
    ERRORS: 400 if recording_manager not initialized

GET /api/vr-room-audio/{audio_set}
    DESCRIPTION: Gets list of audio files for VR room task audio set
    RETURNS: {success: true, files: [sorted_filenames], audio_set}
    NOTES: Files sorted by numeric prefix (e.g., "01-", "02-")
    ERRORS: 404 if directory not found

GET /api/vr-room-config/{audio_set}
    DESCRIPTION: Gets configuration JSON for VR room task
    RETURNS: {success: true, config: json_data}
    ERRORS: 404 if config.json not found

POST /api/upload-vr-room-audio
    DESCRIPTION: Uploads audio files for VR room task
    REQUEST: FormData with audioFiles (multiple), audioSetName
    PROCESSING:
        - Sanitizes audio_set_name (alphanumeric + underscore/hyphen, lowercase)
        - Creates directory: static/audio_files/vr_room_audio/{audio_set_name}
        - Saves each file with secure_filename
    RETURNS: {success: true, message, audioSetName, files}
    ERRORS: 400 if no files or audioSetName missing

POST /api/upload-vr-room-config
    DESCRIPTION: Uploads configuration JSON for VR room task
    REQUEST: FormData with configFile, audioSetName, configName (optional)
    PROCESSING:
        - Validates JSON format
        - Generates unique filename: config_{configName}_{timestamp}.json
        - Saves to: static/audio_files/vr_room_audio/{audio_set_name}/
    RETURNS: {success: true, message, config, config_filename}
    ERRORS: 400 if validation fails

=== MAIN TASK (AUDIO-BASED EXPERIMENTAL TASK) ===

POST /api/upload-main-task-audio
    DESCRIPTION: Uploads audio files for main experimental task
    REQUEST: FormData with audioFiles (multiple), questionSetName
    PROCESSING:
        - Sanitizes questionSetName (alphanumeric + underscore/hyphen, lowercase)
        - Creates directory: static/audio_files/main_task_audio/{question_set_name}
        - Validates required files: 1-Intro, 2-PreQuestions, Question files, Wait_For_Instructions
        - Saves each file
    RETURNS: {success: true, message, questionSetName, files}
    ERRORS: 400 if required files missing

GET /api/main-task-audio/{question_set}
    DESCRIPTION: Gets list of audio files for main task question set
    RETURNS: {success: true, files: [sorted_filenames], question_set}
    NOTES: Files sorted by numeric prefix, excludes 1-PRS-Intro.mp3 and Wait_For_Instructions.mp3
    ERRORS: 404 if directory not found

GET /api/audio-files/{question_set}
    DESCRIPTION: Gets audio files for PRS or other audio-based procedures
    RETURNS: {success: true, question_files: [sorted_filenames], total_questions, question_set}
    NOTES: Excludes 1-PRS-Intro.mp3 and Wait_For_Instructions.mp3
    ERRORS: 404 if directory not found

=== MENTAL ARITHMETIC TASK (MAT) ===

GET /api/mat-question-sets
    DESCRIPTION: Gets available Mental Arithmetic Task question sets
    RETURNS: {success: true, question_sets: {mat_practice, mat_1, mat_2}}

POST /set_current_test
    DESCRIPTION: Sets current MAT test number
    REQUEST: {test_number: int}
    PROCESSING:
        - Sets test_manager.current_test_index
        - Resets test_manager.current_question_index to 0
    RETURNS: {message: "Test set to {test_number}."}
    ERRORS: 400 if test_number missing or invalid

POST /get_first_question
    DESCRIPTION: Gets first MAT question and starts recording
    PROCESSING:
        - Sets current_question_index to 0
        - Starts recording
        - Retrieves first question
    RETURNS: {message: "Question found.", question, test_index}
    ERRORS: 400 if managers not initialized

POST /confirm_transcription
    DESCRIPTION: Stops recording and transcribes MAT answer
    REQUEST: {test_status: bool, time_up: bool}
    PROCESSING:
        - Stops recording
        - If time_up: sets answer to "Time up."
        - Else: transcribes audio
    RETURNS: {transcription, status, message}
    ERRORS: 400 on error

POST /process_answer
    DESCRIPTION: Processes MAT answer and advances question
    REQUEST: {test_status: bool}
    PROCESSING:
        - Checks answer correctness
        - Saves audio file (if not practice test)
        - Logs to subject_manager
        - If correct: advances question index
        - If incorrect: resets to question 0
        - Starts recording for next question
    RETURNS: {status, message, result: "correct"|"incorrect"|"complete"}
    ERRORS: 500 on error

=== DATA PROCESSING ===

POST /api/convert-hdf5-to-csv
    DESCRIPTION: Converts HDF5 data files to CSV format
    REQUEST: {session_id: str}
    PROCESSING:
        - Calls hdf5_to_csv() on event_manager, vernier_manager, polar_manager
        - Collects success/error results
    RETURNS: {success: true, message, converted_files, errors}
    ERRORS: 400 if no active managers, 500 on error

POST /api/push-to-database
    DESCRIPTION: Pushes CSV data to PostgreSQL database
    REQUEST: {session_id: str}
    PROCESSING:
        - Loads database config from environment
        - Creates DatabaseUploader instance
        - Calls upload_subject_directory() with session metadata
    RETURNS: {success: true, message, details, subject_dir}
    ERRORS: 400 if session/subject_dir not found, 500 on error

POST /api/parse-event-markers
    DESCRIPTION: Parses LSL event markers from EmotiBit ground truth CSV
    REQUEST: {session_id: str}
    PROCESSING:
        - Finds most recent *_emotibit_ground_truth.csv in subject directory
        - Parses LSL marker lines (type code 'LM')
        - Extracts: EmotiBitTimestamp, PacketNumber, LslLocalTimestamp, LslMarkerSourceTimestamp,
          LslMarkerRxTimestamp, MarkerData
        - Saves CSV: {timestamp}_{subject_id}_emotibit_event_markers.csv
    RETURNS: {success: true, message, markers_count, file_path, source_file}
    ERRORS: 400 if no ground truth file or no markers found, 500 on error

POST /import_emotibit_csv
    DESCRIPTION: Imports EmotiBit ground truth CSV from SD card
    REQUEST: FormData with emotibit_file or emotibit_files (multiple)
    PROCESSING:
        - Validates CSV file type
        - Renames to: {time_started}_{subject_id}_emotibit_ground_truth[_{N}].csv
        - Handles duplicate filenames with counter
        - Saves to event_manager.data_folder
    RETURNS: {success: true, message, file_path(s), uploaded_files} OR
             {success: false, message, errors}
    ERRORS: 400 if no files or invalid type

=== FORM & SURVEY MANAGEMENT ===

POST /api/upload-survey
    DESCRIPTION: Uploads survey file
    REQUEST: FormData with file
    PROCESSING:
        - Saves to surveys/ directory
        - Uses secure_filename
    RETURNS: {success: true, filename}
    ERRORS: 400 if no file

POST /api/get-autofilled-survey-url
    DESCRIPTION: Generates autofilled Google Forms URL with subject ID
    REQUEST: {session_id, survey_name, survey_url}
    PROCESSING:
        - Gets subject_id from subject_manager
        - Calls form_manager.customize_form_url(survey_url, subject_id)
        - Replaces "Sample+ID" placeholder with actual subject ID
    RETURNS: {success: true, autofilled_url, survey_name}
    ERRORS: 400 if session/subject_id not found, 500 on error

=== CONSENT FORMS ===

POST /api/upload-consent-form
    DESCRIPTION: Uploads consent form PDF
    REQUEST: FormData with file, experiment_name
    PROCESSING:
        - Validates PDF file type
        - Sanitizes experiment_name (lowercase, underscores)
        - Creates directory: static/consent_forms/{experiment_name}
        - Saves with secure_filename
    RETURNS: {success: true, message, filePath, filename, experiment_name}
    ERRORS: 400 if validation fails, 500 on error

GET /static/consent_forms/{experiment_name}/{filename}
    DESCRIPTION: Serves consent form PDFs
    RETURNS: PDF file
    ERRORS: 404 if not found

=== EXTERNAL APPLICATION LAUNCHERS ===

POST /api/launch-emotibit-osc
    DESCRIPTION: Launches EmotiBit Oscilloscope application
    PROCESSING: Opens executables/EmotiBitOscilloscope.app via subprocess
    RETURNS: {success: true, message}
    ERRORS: 500 on launch error

POST /api/launch-emotibit-parser
    DESCRIPTION: Launches EmotiBit DataParser application
    PROCESSING: Opens executables/EmotiBitDataParser.app via subprocess
    RETURNS: {success: true, message}
    ERRORS: 500 on launch error

=== FILE UPLOADS ===

POST /api/upload-config
    DESCRIPTION: Uploads test configuration JSON file
    REQUEST: FormData with file, configType
    PROCESSING:
        - Validates JSON file type
        - Generates unique filename: {configType}_{uuid}_{original_name}
        - Saves to TEST_FILES_DIR
        - Validates JSON format
    RETURNS: {success: true, message, filePath, filename}
    ERRORS: 400 if validation fails, 500 on error

=== SERVER MANAGEMENT ===

POST /api/shutdown
    DESCRIPTION: Gracefully shuts down Flask server
    PROCESSING:
        - Checks for active sessions (refuses if any exist)
        - Sets SHUTDOWN_FLAG
        - Stops all managers (event, vernier, polar, recording)
        - Waits for heartbeat monitor thread to stop
        - Sends SIGTERM to process
    RETURNS: {success: true, message}
    ERRORS: 400 if active sessions exist, 500 on error

=== STATIC FILE SERVING ===

GET /experiments/{filename}
    DESCRIPTION: Serves files from experiments directory
    NOTES: Used for instruction-steps.json, experiment-config.json, etc.

GET / OR /{path}
    DESCRIPTION: Serves React frontend application
    NOTES: Catches all non-API routes for client-side routing

=== HELPER FUNCTIONS ===

FUNCTION: get_database_config()
    DESCRIPTION: Validates and returns database configuration from .env
    RETURNS: {host, database, user, password, port}
    RAISES: DatabaseConfigError if required vars missing or invalid

FUNCTION: validate_environment()
    DESCRIPTION: Validates database config at startup, prints warnings if misconfigured
    NOTES: Called on module load

FUNCTION: generate_experiment_id(experiment_name="")
    DESCRIPTION: Generates unique experiment ID from name + timestamp
    PROCESSING:
        - Sanitizes name (alphanumeric + space/hyphen/underscore)
        - Converts to lowercase, replaces spaces with underscores
        - Truncates to 30 characters
        - Appends timestamp: YYYYMMDD_HHMMSS
    RETURNS: "{clean_name}_{timestamp}" or "experiment_{timestamp}"

FUNCTION: broadcast_to_session(session_id, event_data)
    DESCRIPTION: Broadcasts SSE event to specific session
    PROCESSING:
        - Sets global update_message and triggers update_event
        - Puts event_data in session_queues[session_id] if available

FUNCTION: instantiate_modules(template_path)
    DESCRIPTION: Initializes manager instances based on experiment procedures
    PROCESSING:
        - Loads experiment template from template_path
        - Checks dataCollectionMethods configuration
        - Analyzes procedures for required modules:
            - audio_ser: recording_manager, audio_file_manager, transcription_manager, ser_manager
            - respiratory: vernier_manager
            - polar_hr: polar_manager
            - emotibit: lsl_manager
            - Mental Arithmetic Task: test_manager
            - VR Room Task: audio_ser components
        - Initializes only required managers
    NOTES: Called during /api/experiments/{id}/run

FUNCTION: process_procedure_for_psychopy(proc_data)
    DESCRIPTION: Processes procedure data to extract configuration and wizard data
    PROCESSING:
        - Extracts platform from configuration['psychopy-setup']['platform'] or top-level
        - Builds wizardData object with all configuration fields
        - Preserves rawConfiguration for reference
    RETURNS: Processed procedure object with id, instanceId, name, duration, configuration, wizardData, platform

FUNCTION: reset_experiment_managers()
    DESCRIPTION: Resets all manager instances for new experiment
    PROCESSING:
        - Stops all running managers
        - Sets all manager globals to None (except subject_manager, event_manager, form_manager)
        - Reinitializes SubjectManager, EventManager, FormManager
    NOTES: Called during experiment completion and cleanup

FUNCTION: transcribe_audio(file, timeout_seconds=30)
    DESCRIPTION: Transcribes audio file using TranscriptionManager
    PROCESSING:
        - Stops recording if active
        - Resamples to 16kHz
        - Calls transcription_manager.transcribe()
    RETURNS: Transcription text or error message
    NOTES: Used internally, not a route

FUNCTION: allowed_file(filename)
    DESCRIPTION: Checks if filename has allowed extension
    ALLOWED_EXTENSIONS: {'json'}
    RETURNS: Boolean

FUNCTION: validate_json_file(filepath)
    DESCRIPTION: Validates that file contains valid JSON
    RETURNS: Boolean

=== BACKGROUND THREADS ===

THREAD: check_stale_sessions()
    DESCRIPTION: Monitors for stale sessions where experimenter closed without cleanup
    PROCESSING:
        - Runs every 5 seconds
        - Checks experimenter_heartbeats for sessions with no heartbeat for HEARTBEAT_TIMEOUT (60s)
        - Increments missed_beats counter
        - After HEARTBEAT_GRACE_ATTEMPTS (3) missed beats, initiates cleanup_experimenter_session()
    THREAD-SAFE: Uses cleanup_lock
    SHUTDOWN: Waits on SHUTDOWN_FLAG event

    Started on app startup as daemon thread named "HeartbeatMonitorThread"

=== SESSION DATA STRUCTURE ===

ACTIVE_SESSIONS[session_id]:
    session_id (str): Unique session identifier
    experiment_id (str): Template experiment ID
    experiment_name (str): Experiment display name
    status (str): Session status (created, experiment_trial_set, participant_registered, consent_completed, completed)
    created_at (str): ISO timestamp
    updated_at (str): ISO timestamp
    template (dict): Full experiment template object
    experiment_folder_name (str): Sanitized experiment folder name
    trial_name (str): Sanitized trial name
    experimenter_name (str): "{first_name} {last_name}"
    subject_folder (str): Subject folder name (date_sanitized_email)
    subject_dir (str): Full path to subject directory
    participant_info (dict): {first_name, last_name, email, pid, sona_class, form_completed_at}
    consent_record (dict): {consent_given, consent_method, timestamp, ip_address, user_agent}
    _cleanup_in_progress (bool): Flag to prevent double cleanup

session_completions[session_id]:
    completed_procedures (list[int]): Indices of completed procedures
    current_procedure (int): Current procedure index

experimenter_heartbeats[session_id]:
    last_seen (float): Unix timestamp of last heartbeat
    missed_beats (int): Consecutive missed heartbeats

=== MANAGER LIFECYCLE ===

Initialization Flow:
    1. Application starts → Validates environment → Initializes SubjectManager, EventManager
    2. Experiment run → instantiate_modules() → Initializes required managers
    3. Participant registration → Sets metadata on all managers
    4. Managers create HDF5 files when started

Cleanup Flow:
    1. Experimenter heartbeat stops → check_stale_sessions() detects
    2. cleanup_experimenter_session() called → Stops all managers
    3. reset_experiment_managers() → Sets managers to None
    4. Session deleted from ACTIVE_SESSIONS

=== THREADING & SYNCHRONIZATION ===

cleanup_lock (threading.Lock): Protects ACTIVE_SESSIONS and experimenter_heartbeats access
update_event (threading.Event): Signals new SSE message available
SHUTDOWN_FLAG (threading.Event): Signals graceful shutdown

Thread-safe operations:
    - ACTIVE_SESSIONS reads/writes
    - experimenter_heartbeats updates
    - Session cleanup operations

=== ERROR HANDLING ===

Database configuration errors:
    - Validates .env at startup
    - Prints detailed instructions if config invalid
    - Operations fail gracefully with error messages

Hardware manager errors:
    - Polar/Vernier managers return warnings if device not connected
    - Allow experiment to continue without data collection
    - User informed via UI

Session errors:
    - 404 if session not found
    - 400 if required fields missing or validation fails
    - 500 for unexpected server errors

=== SECURITY CONSIDERATIONS ===

File uploads:
    - Uses secure_filename() for all uploaded files
    - Validates file types (JSON, PDF, CSV, audio)
    - Sanitizes all user-provided names
    - Validates JSON format before accepting

Session management:
    - Session IDs generated from experiment ID + timestamp (not predictable)
    - Heartbeat mechanism prevents stale sessions
    - Cleanup prevents resource leaks

Database:
    - Credentials loaded from environment variables (.env)
    - Not committed to version control

=== STARTUP SEQUENCE ===

1. Load environment variables (.env)
2. Validate database configuration
3. Initialize directories (templates, subject_data, test_files, consent_forms)
4. Initialize SubjectManager and EventManager
5. Configure Flask app with CORS
6. Start heartbeat monitor thread (check_stale_sessions)
7. Run Flask server on 127.0.0.1:5001

=== SHUTDOWN SEQUENCE ===

1. Check for active sessions (refuse if any)
2. Set SHUTDOWN_FLAG
3. Stop all managers (event, vernier, polar, recording)
4. Wait for heartbeat monitor thread (2s timeout)
5. Send SIGTERM to process

=== NOTES ===

- Server runs on port 5001 to avoid conflicts
- Debug mode enabled for development
- All audio files stored in subject-specific directories
- HDF5 files converted to CSV before database upload
- LSL markers sent alongside EmotiBit event markers
- Session restoration supported via check-active endpoint
- Multiple EmotiBit CSVs can be imported per session
- Question sets for MAT and SER baseline configurable
- VR Room Task supports multiple audio sets with unique configs
- PsychoPy integration supports custom external platforms
- Experimenter interface controls main workflow
- Subject interface displays procedures and collects responses
- SSE provides real-time synchronization between interfaces
"""

from flask import Flask, send_from_directory, send_file, jsonify, request, Response
from flask_cors import CORS
import os
import sys
import signal
from EventManager import EventManager
import TimestampManager as tm
from RecordingManager import RecordingManager
from SubjectManager import SubjectManager
from TestManager import TestManager
from AudioFileManager import AudioFileManager
from FormManager import FormManager
from SERManager import SERManager
from VernierManager import VernierManager
from PolarManager import PolarManager
from LSLManager import LSLManager
from datetime import datetime, timezone
import json
import threading
from queue import Queue
import time
from werkzeug.utils import secure_filename
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from TranscriptionManager import TranscriptionManager
import re
import subprocess
from dotenv import load_dotenv

load_dotenv()

class DatabaseConfigError(Exception):
    """Raised when database configuration is invalid or incomplete"""
    pass

def get_database_config():
    """Get and validate database configuration from environment variables."""
    required_vars = {
        'DB_HOST': os.getenv('DB_HOST'),
        'DB_NAME': os.getenv('DB_NAME'),
        'DB_USER': os.getenv('DB_USER'),
        'DB_PASSWORD': os.getenv('DB_PASSWORD'),
        'DB_PORT': os.getenv('DB_PORT')
    }
    
    missing = [key for key, value in required_vars.items() if not value]
    
    if missing:
        raise DatabaseConfigError(
            f"Missing required database environment variables: {', '.join(missing)}. "
            f"Please ensure these are set in your .env file."
        )
    
    try:
        port = int(required_vars['DB_PORT'])
        if port < 1 or port > 65535:
            raise ValueError("Port must be between 1 and 65535")
    except ValueError as e:
        raise DatabaseConfigError(f"Invalid DB_PORT: {e}")
    
    return {
        'host': required_vars['DB_HOST'],
        'database': required_vars['DB_NAME'],
        'user': required_vars['DB_USER'],
        'password': required_vars['DB_PASSWORD'],
        'port': required_vars['DB_PORT']
    }

def validate_environment():
    """Validate that all required environment variables are set at startup"""
    try:
        get_database_config()
        print("✓ Database configuration validated successfully")
    except DatabaseConfigError as e:
        print("\n" + "="*70)
        print("CRITICAL: Database configuration error!")
        print("="*70)
        print(f"Error: {e}")
        print("\nPlease create/update your .env file with:")
        print("  DB_HOST=localhost")
        print("  DB_NAME=exp_platform_db")
        print("  DB_USER=exp_user")
        print("  DB_PASSWORD=your_secure_password")
        print("  DB_PORT=5432")
        print("="*70 + "\n")
        print("WARNING: Database operations will fail until this is fixed\n")

validate_environment()

# SSE connection management
session_queues = {}
session_completions = {}

# heartbeat monitoring
experimenter_heartbeats = {}  # {session_id: last_heartbeat_timestamp}
cleanup_lock = threading.Lock()
HEARTBEAT_TIMEOUT = 60
HEARTBEAT_GRACE_ATTEMPTS = 3  
SHUTDOWN_FLAG = threading.Event()
heartbeat_monitor_thread = None

# Global event system for broadcasting
update_event = threading.Event()
update_message = None

EXPERIMENT_TEMPLATES_DIR = "experiments/templates"
EXPERIMENT_SUBJECT_DATA_DIR = "experiments/subject_data"
TEST_FILES_DIR = "static/test_files"
CONSENT_FORMS_DIR = "static/consent_forms"

os.makedirs(EXPERIMENT_TEMPLATES_DIR, exist_ok=True)
os.makedirs(EXPERIMENT_SUBJECT_DATA_DIR, exist_ok=True)
os.makedirs(TEST_FILES_DIR, exist_ok=True)
os.makedirs(CONSENT_FORMS_DIR, exist_ok=True)

ACTIVE_SESSIONS = {}

print("Timestamp Manager initialized with current timestamp:", tm.get_timestamp(type="iso"))

event_manager = EventManager()
subject_manager = SubjectManager()

audio_file_manager = None
recording_manager = None
test_manager = None
ser_manager = None
form_manager = None
vernier_manager = None
polar_manager = None
lsl_manager = None

app = Flask(__name__, static_folder='static', static_url_path='')
app.config['DEBUG'] = True

import logging
log = logging.getLogger('werkzeug')

class HeartbeatFilter(logging.Filter):
    def filter(self, record):
        return 'heartbeat' not in record.getMessage()

log.addFilter(HeartbeatFilter())

CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Cache-Control"]
    }
})

@app.route('/experiments/<path:filename>')
def serve_experiments(filename):
    experiments_dir = os.path.join(os.getcwd(), 'experiments')
    return send_from_directory(experiments_dir, filename)

@app.route('/api/launch-psychopy-task', methods=['POST'])
def launch_psychopy_task():
    """Launch a PsychoPy task as a subprocess with participant/session info."""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        task_id = data.get('task_id')

        if not session_id or session_id not in ACTIVE_SESSIONS:
            return jsonify({'success': False, 'error': 'Invalid or missing session ID'}), 400

        session_data = ACTIVE_SESSIONS[session_id]

        PSYCHOPY_TASKS = {
            'two-afc': {
                'script': os.path.join(os.getcwd(), 'psychopy_tasks', 'two_afc', 'two_afc_task.py'),
                'cwd': os.path.join(os.getcwd(), 'psychopy_tasks', 'two_afc'),
            }
        }

        if task_id not in PSYCHOPY_TASKS:
            return jsonify({'success': False, 'error': f'Unknown PsychoPy task: {task_id}'}), 400

        task_config = PSYCHOPY_TASKS[task_id]
        script_path = task_config['script']

        if not os.path.exists(script_path):
            return jsonify({'success': False, 'error': f'Task script not found: {script_path}'}), 404

        participant_info = session_data.get('participant_info', {})
        participant_id = participant_info.get('pid') or participant_info.get('email', 'unknown')
        participant_id = "".join(c for c in participant_id if c.isalnum() or c in ('_', '-')).strip() or 'unknown'

        output_dir = session_data.get('subject_dir')

        cmd = [
            sys.executable,
            script_path,
            '--participant', participant_id,
            '--session', session_id.split('_')[-1] if '_' in session_id else '001',
        ]
        if output_dir and os.path.isdir(output_dir):
            cmd.extend(['--output-dir', output_dir])

        print(f"Launching PsychoPy task: {' '.join(cmd)}")
        process = subprocess.Popen(cmd, cwd=task_config['cwd'])

        return jsonify({
            'success': True,
            'message': f'PsychoPy task "{task_id}" launched',
            'pid': process.pid,
        }), 200

    except Exception as e:
        print(f"Error launching PsychoPy task: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/launch-emotibit-osc', methods=['POST'])
def launch_emotibit_osc():
    try:
        executable_path = os.path.join(os.getcwd(), 'executables', 'EmotiBitOscilloscope.app')
        
        subprocess.Popen(['open', executable_path])
        
        return jsonify({
            "success": True, 
            "message": "Oscilloscope launched successfully"
        }), 200
        
    except Exception as e:
        print(f"Error launching EmotiBit Oscilloscope: {e}")
        return jsonify({
            "success": False, 
            "error": str(e)
        }), 500
    
@app.route('/api/launch-emotibit-parser', methods=['POST'])
def launch_emotibit_parser():
    try:
        # TODO This will need to account for windows extenstions when ported
        executable_path = os.path.join(os.getcwd(), 'executables', 'EmotiBitDataParser.app')
        subprocess.Popen(['open', executable_path])
        
        return jsonify({
            "success": True, 
            "message": "Oscilloscope launched successfully"
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False, 
            "error": str(e)
        }), 500

@app.route('/api/parse-event-markers', methods=['POST'])
def parse_event_markers():
    """
    Parse LSL markers from EmotiBit ground truth CSV file.
    Looks for the most recent ground truth file in the subject's directory.
    """
    global event_manager, subject_manager
    
    try:
        data = request.json
        session_id = data.get('session_id')
        
        if not session_id or session_id not in ACTIVE_SESSIONS:
            return jsonify({'error': 'Invalid or missing session ID'}), 400
        
        session_data = ACTIVE_SESSIONS[session_id]
        subject_dir = session_data.get('subject_dir')
        
        if not subject_dir or not os.path.exists(subject_dir):
            return jsonify({'error': 'Subject directory not found'}), 400
        
        # Find the most recent ground truth CSV file
        ground_truth_files = [
            f for f in os.listdir(subject_dir) 
            if f.endswith('_emotibit_ground_truth.csv')
        ]
        
        if not ground_truth_files:
            return jsonify({'error': 'No EmotiBit ground truth file found. Please import EmotiBit data first.'}), 400
        
        # Sort by modification time and get the most recent
        ground_truth_files.sort(
            key=lambda f: os.path.getmtime(os.path.join(subject_dir, f)), 
            reverse=True
        )
        ground_truth_file = os.path.join(subject_dir, ground_truth_files[0])
        
        # Parse the file for LSL markers
        markers = []
        with open(ground_truth_file, 'r', encoding='utf-8') as f:
            for line in f:
                # Skip comment lines
                if line.startswith(('%', '#')):
                    continue
                
                parts = line.strip().split(',')
                if len(parts) < 7:
                    continue
                
                # Check if this is an LSL marker line (type code 'LM')
                if parts[3] == 'LM':
                    # Parse the payload key-value pairs
                    payload = {}
                    for i in range(6, len(parts) - 1, 2):
                        if i + 1 < len(parts):
                            key = parts[i].strip()
                            value = parts[i + 1].strip()
                            if key and value:
                                payload[key] = value
                    
                    # If we found marker data, add it to our list
                    if 'LD' in payload:
                        markers.append({
                            'EmotiBitTimestamp': int(parts[0]),
                            'PacketNumber': int(parts[1]),
                            'LslLocalTimestamp': float(payload.get('LC', 0)),
                            'LslMarkerSourceTimestamp': float(payload.get('LM', 0)),
                            'LslMarkerRxTimestamp': float(payload.get('LR', 0)),
                            'MarkerData': payload['LD']
                        })
        
        if not markers:
            return jsonify({
                'success': False,
                'error': 'No LSL markers found in the ground truth file'
            }), 400
        
        # Create output filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        subject_id = subject_manager.subject_id or 'unknown'
        output_filename = f"{timestamp}_{subject_id}_emotibit_event_markers.csv"
        output_filepath = os.path.join(subject_dir, output_filename)
        
        # Write markers to CSV
        import csv
        with open(output_filepath, 'w', newline='', encoding='utf-8') as csvfile:
            if markers:
                fieldnames = markers[0].keys()
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(markers)
        
        print(f"Parsed {len(markers)} event markers from {ground_truth_files[0]}")
        print(f"Saved to: {output_filepath}")
        
        return jsonify({
            'success': True,
            'message': 'Event markers parsed successfully',
            'markers_count': len(markers),
            'file_path': output_filepath,
            'source_file': ground_truth_files[0]
        }), 200
        
    except Exception as e:
        print(f"Error parsing event markers: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to parse event markers: {str(e)}'
        }), 500
          
@app.route('/api/manager-status', methods=['GET'])
def get_manager_status():
    """Get the running status of all managers"""
    global event_manager, vernier_manager, polar_manager
    
    try:
        status = {
            'event_manager': event_manager.is_streaming if event_manager else False,
            'vernier_manager': vernier_manager._running if vernier_manager else False,
            'polar_manager': polar_manager._running if polar_manager else False
        }
        
        return jsonify({
            'success': True,
            'status': status,
            'any_running': any(status.values())
        })
    except Exception as e:
        print(f"Error checking manager status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
@app.route('/api/convert-hdf5-to-csv', methods=['POST'])
def convert_hdf5_to_csv():
    global event_manager, vernier_manager, polar_manager
    
    try:
        data = request.json
        session_id = data.get('session_id')
        
        if not session_id or session_id not in ACTIVE_SESSIONS:
            return jsonify({'error': 'Invalid or missing session ID'}), 400
        
        converted_files = []
        errors = []
        
        if event_manager and hasattr(event_manager, 'hdf5_to_csv'):
            try:
                event_manager.hdf5_to_csv()
                converted_files.append('EmotiBit event data')
                print("✓ EventManager HDF5 converted to CSV")
            except Exception as e:
                errors.append(f"EventManager conversion failed: {str(e)}")
                print(f"✗ EventManager conversion error: {e}")
    
        if vernier_manager and hasattr(vernier_manager, 'hdf5_to_csv'):
            try:
                vernier_manager.hdf5_to_csv()
                converted_files.append('Vernier respiratory data')
                print("✓ VernierManager HDF5 converted to CSV")
            except Exception as e:
                errors.append(f"VernierManager conversion failed: {str(e)}")
                print(f"✗ VernierManager conversion error: {e}")
        
        if polar_manager and hasattr(polar_manager, 'hdf5_to_csv'):
            try:
                polar_manager.hdf5_to_csv()
                converted_files.append('Polar HR data')
                print("✓ PolarManager HDF5 converted to CSV")
            except Exception as e:
                errors.append(f"PolarManager conversion failed: {str(e)}")
                print(f"✗ PolarManager conversion error: {e}")
        
        if not converted_files and not errors:
            return jsonify({
                'success': False,
                'error': 'No active data managers found'
            }), 400
        
        message = f"Successfully converted {len(converted_files)} file(s) to CSV"
        if errors:
            message += f". {len(errors)} error(s) occurred."
        
        return jsonify({
            'success': True,
            'message': message,
            'converted_files': converted_files,
            'errors': errors if errors else None
        })
        
    except Exception as e:
        print(f"Error in convert_hdf5_to_csv: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Conversion failed: {str(e)}'}), 500


@app.route('/api/push-to-database', methods=['POST'])
def push_to_database():
    """
    Push CSV data to PostgreSQL database.
    Uses DatabaseUploader to handle all database operations.
    """
    from DatabaseUploader import DatabaseUploader
    
    try:
        data = request.json
        session_id = data.get('session_id')
        
        if not session_id or session_id not in ACTIVE_SESSIONS:
            return jsonify({'error': 'Invalid or missing session ID'}), 400
        
        session_data = ACTIVE_SESSIONS[session_id]
        subject_dir = session_data.get('subject_dir')
        
        if not subject_dir or not os.path.exists(subject_dir):
            return jsonify({'error': 'Subject directory not found'}), 400
        
        db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'database': os.getenv('DB_NAME', 'exp_platform_db'),
            'user': os.getenv('DB_USER', 'exp_user'),
            'password': os.getenv('DB_PASSWORD'),
            'port': os.getenv('DB_PORT', '5432') 
        }
        
        uploader = DatabaseUploader(db_config)
        
        try:
            session_metadata = {
                'experiment_name': session_data.get('experiment_folder_name'),
                'trial_name': session_data.get('trial_name'),
                'experimenter_name': session_data.get('experimenter_name'),
                'subject_id': session_data.get('participant_info', {}).get('email'),
                'pid': session_data.get('participant_info', {}).get('pid'),
                'class_name': session_data.get('participant_info', {}).get('sona_class')
            }
            
            result = uploader.upload_subject_directory(subject_dir, session_metadata)
            
            return jsonify({
                'success': True,
                'message': f"Uploaded {result['uploaded_count']} file(s) to database",
                'details': result,
                'subject_dir': subject_dir
            })
            
        finally:
            uploader.close()
        
    except Exception as e:
        print(f"Error in push_to_database: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Database push failed: {str(e)}'}), 500
      
@app.route('/api/upload-survey', methods=['POST'])
def upload_survey():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    surveys_dir = os.path.join(os.getcwd(), 'surveys')
    os.makedirs(surveys_dir, exist_ok=True)
    
    filename = secure_filename(file.filename)
    file_path = os.path.join(surveys_dir, filename)
    file.save(file_path)
    
    return jsonify({'success': True, 'filename': filename})

@app.route('/api/upload-main-task-audio', methods=['POST'])
def upload_main_task_audio():
    """Upload audio files for main task procedure"""
    try:
        if 'audioFiles' not in request.files:
            return jsonify({'success': False, 'error': 'No files provided'}), 400
        
        question_set_name = request.form.get('questionSetName', '').strip()
        if not question_set_name:
            return jsonify({'success': False, 'error': 'Question set name is required'}), 400
        
        question_set_name = "".join(c for c in question_set_name if c.isalnum() or c in ('_', '-')).lower()
        
        audio_dir = os.path.join('static', 'audio_files', 'main_task_audio', question_set_name)
        os.makedirs(audio_dir, exist_ok=True)
        
        files = request.files.getlist('audioFiles')
        uploaded_files = []
        
        has_intro = False
        has_pre_questions = False
        has_questions = False
        has_wait = False
        
        for file in files:
            if file.filename == '':
                continue
            
            filename = secure_filename(file.filename)
            
            if filename.startswith('1-') and 'intro' in filename.lower():
                has_intro = True
            elif filename.startswith('2-') and 'pre' in filename.lower():
                has_pre_questions = True
            elif 'question_' in filename.lower():
                has_questions = True
            elif 'wait_for_instructions' in filename.lower():
                has_wait = True
            
            filepath = os.path.join(audio_dir, filename)
            file.save(filepath)
            uploaded_files.append(filename)
        
        if not (has_intro and has_pre_questions and has_questions and has_wait):
            return jsonify({
                'success': False,
                'error': 'Missing required files. Please ensure you have: 1-Intro, 2-PreQuestions, Question files, and Wait_For_Instructions'
            }), 400
        
        print(f"Uploaded {len(uploaded_files)} files to {audio_dir}")
        
        return jsonify({
            'success': True,
            'message': f'Successfully uploaded {len(uploaded_files)} files',
            'questionSetName': question_set_name,
            'files': uploaded_files
        })
        
    except Exception as e:
        print(f"Upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'Server error: {str(e)}'}), 500
    
@app.route('/api/main-task-audio/<question_set>', methods=['GET'])
def get_main_task_audio_files(question_set):
    """Get list of audio files for a specific main task question set"""
    try:
        audio_dir = os.path.join('static', 'audio_files', 'main_task_audio', question_set)
        
        if not os.path.exists(audio_dir):
            return jsonify({
                'success': False,
                'error': f'Audio directory not found: {audio_dir}'
            }), 404
        
        # Get all mp3/wav files
        all_files = [f for f in os.listdir(audio_dir) 
                     if f.endswith(('.mp3', '.wav'))]
        
        # Sort files by numeric prefix
        def get_sort_key(filename):
            match = re.match(r'^(\d+)-', filename)
            if match:
                return int(match.group(1))
            # Put wait file last
            if 'wait' in filename.lower():
                return 9999
            return 0
        
        all_files.sort(key=get_sort_key)
        
        return jsonify({
            'success': True,
            'files': all_files,
            'question_set': question_set
        })
        
    except Exception as e:
        print(f"Error getting audio files for {question_set}: {e}")
        return jsonify({
            'success': False,
            'error': f'Failed to get audio files: {str(e)}'
        }), 500

@app.route('/api/vr-room-audio/<audio_set>', methods=['GET'])
def get_vr_room_audio_files(audio_set):
    """Get list of audio files for a specific VR room task audio set"""
    try:
        audio_dir = os.path.join('static', 'audio_files', 'vr_room_audio', audio_set)
        
        if not os.path.exists(audio_dir):
            return jsonify({
                'success': False,
                'error': f'Audio directory not found: {audio_dir}'
            }), 404
        
        # Get all audio files, sorted by step number
        all_files = [f for f in os.listdir(audio_dir) 
                     if f.endswith(('.mp3', '.wav'))]
        
        def get_sort_key(filename):
            match = re.match(r'^(\d+)-', filename)
            if match:
                return int(match.group(1))
            return 0
        
        all_files.sort(key=get_sort_key)
        
        return jsonify({
            'success': True,
            'files': all_files,
            'audio_set': audio_set
        })
        
    except Exception as e:
        print(f"Error getting VR room audio files for {audio_set}: {e}")
        return jsonify({
            'success': False,
            'error': f'Failed to get audio files: {str(e)}'
        }), 500

@app.route('/api/vr-room-config/<audio_set>', methods=['GET'])
def get_vr_room_config(audio_set):
    """Get configuration for a specific VR room task audio set"""
    try:
        config_path = os.path.join('static', 'audio_files', 'vr_room_audio', audio_set, 'config.json')
        
        if not os.path.exists(config_path):
            return jsonify({
                'success': False,
                'error': f'Configuration file not found: {config_path}'
            }), 404
        
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        return jsonify({
            'success': True,
            'config': config
        })
        
    except Exception as e:
        print(f"Error getting VR room config for {audio_set}: {e}")
        return jsonify({
            'success': False,
            'error': f'Failed to get configuration: {str(e)}'
        }), 500

@app.route('/api/upload-vr-room-audio', methods=['POST'])
def upload_vr_room_audio():
    """Upload audio files for VR room task"""
    try:
        if 'audioFiles' not in request.files:
            return jsonify({'success': False, 'error': 'No files provided'}), 400
        
        audio_set_name = request.form.get('audioSetName', '').strip()
        if not audio_set_name:
            return jsonify({'success': False, 'error': 'Audio set name is required'}), 400
        
        # Sanitize audio set name
        audio_set_name = "".join(c for c in audio_set_name if c.isalnum() or c in ('_', '-')).lower()
        
        audio_dir = os.path.join('static', 'audio_files', 'vr_room_audio', audio_set_name)
        os.makedirs(audio_dir, exist_ok=True)
        
        files = request.files.getlist('audioFiles')
        uploaded_files = []
        
        for file in files:
            if file.filename == '':
                continue
            
            filename = secure_filename(file.filename)
            filepath = os.path.join(audio_dir, filename)
            file.save(filepath)
            uploaded_files.append(filename)
        
        print(f"Uploaded {len(uploaded_files)} files to {audio_dir}")
        
        return jsonify({
            'success': True,
            'message': f'Successfully uploaded {len(uploaded_files)} files',
            'audioSetName': audio_set_name,
            'files': uploaded_files
        })
        
    except Exception as e:
        print(f"Upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'Server error: {str(e)}'}), 500

@app.route('/api/upload-vr-room-config', methods=['POST'])
def upload_vr_room_config():
    """Upload configuration file for VR room task"""
    try:
        if 'configFile' not in request.files:
            return jsonify({'success': False, 'error': 'No config file provided'}), 400
        
        audio_set_name = request.form.get('audioSetName', '').strip()
        if not audio_set_name:
            return jsonify({'success': False, 'error': 'Audio set name is required'}), 400
        
        # Get optional config name (defaults to generic config.json)
        config_name = request.form.get('configName', 'config').strip()
        config_name = "".join(c for c in config_name if c.isalnum() or c in ('_', '-')).lower()
        
        audio_set_name = "".join(c for c in audio_set_name if c.isalnum() or c in ('_', '-')).lower()
        
        config_file = request.files['configFile']
        
        # Read and validate JSON
        config_data = json.load(config_file.stream)
        
        # Save to audio set directory with unique name
        audio_dir = os.path.join('static', 'audio_files', 'vr_room_audio', audio_set_name)
        os.makedirs(audio_dir, exist_ok=True)
        
        # Generate unique config filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        config_filename = f"config_{config_name}_{timestamp}.json"
        config_path = os.path.join(audio_dir, config_filename)
        
        with open(config_path, 'w') as f:
            json.dump(config_data, f, indent=2)
        
        print(f"Saved configuration to {config_path}")
        
        return jsonify({
            'success': True,
            'message': 'Configuration uploaded successfully',
            'config': config_data,
            'config_filename': config_filename
        })
    
    except Exception as e:
        print(f"Error uploading VR room config: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route('/set_event_marker', methods=['POST'])
def set_event_marker():
    """Set event marker for the event manager"""
    global event_manager, vernier_manager, polar_manager, lsl_manager
    data = request.get_json()
    event_marker = data.get('event_marker')

    if vernier_manager is not None:
        vernier_manager.event_marker = event_marker
    if polar_manager is not None:
        polar_manager.event_marker = event_marker
    
    try:
        event_manager.event_marker = event_marker

        if lsl_manager is not None:
            lsl_manager.send_marker(event_marker, event_manager.condition)

        print("Event marker set to: ", event_marker)
        return jsonify({'status': 'Event marker set.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

def set_condition():
    """Set condition for the event manager"""
    global event_manager
    data = request.get_json()
    condition = data.get('condition')
    try:
        event_manager.condition = condition
        print("Condition set to: ", condition)
        return jsonify({'status': 'Condition set.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400
        
@app.route('/record_task_audio', methods=['POST'])
def record_task_audio():
    global recording_manager, audio_file_manager, subject_manager, vernier_manager, event_manager, lsl_manager
    data = request.get_json()
    action = data.get('action')
    question = data.get('question')
    event_marker = data.get('event_marker')
    condition = data.get('condition')
    event_marker = f"{event_marker}_{question}"
    
    try:
        if action == 'start':
            recording_manager.start_recording()
            event_manager.event_marker = event_marker
            lsl_manager.send_marker(event_marker, condition)
            vernier_manager.event_marker = event_marker

            start_time = 10 # seconds
            while not recording_manager.stream_is_active:
                if time.time() - start_time > 10:
                    return jsonify({'message': 'Error starting recording.'}), 400
                time.sleep(0.5)

            return jsonify({'message': 'Recording started...'}), 200
        
        elif action == 'stop':
            recording_manager.stop_recording()
            ts = recording_manager.timestamp
            uts = recording_manager.unix_timestamp
            end_time = recording_manager.end_timestamp_iso
            end_time_unix = recording_manager.end_timestamp_unix

            id = subject_manager.subject_id

            file_name = f"{id}_{ts}_{event_marker}.wav"

            subject_manager.append_data({
                                            'unix_timestamp': uts,
                                            'timestamp': ts, 
                                            'time_stopped': end_time, 
                                            'time_stopped_unix': end_time_unix,
                                            'event_marker': event_marker, 
                                            'condition': condition, 
                                            'audio_file': file_name
                                        })
            
            audio_file_manager.save_audio_file(file_name)

            return jsonify({'message': 'Recording stopped.'}), 200
        else:
            return jsonify({'message': 'Invalid action.'}), 400
        
    except Exception as e:
        return jsonify({'error': 'Error processing request.'}), 400
    
@app.route('/get_audio_devices', methods=['GET'])
def get_audio_devices() -> Response:
    global recording_manager
    
    if recording_manager is None:
        return jsonify({'error': 'Recording manager not initialized', 'devices': []}), 400
    
    try:
        audio_devices = recording_manager.get_audio_devices()
        return jsonify(audio_devices)
    except Exception as e:
        return jsonify({'error': f'Failed to get audio devices: {str(e)}', 'devices': []}), 500

@app.route('/api/audio-files/<question_set>', methods=['GET'])
def get_audio_files(question_set):
    try:
        audio_dir = os.path.join('static', 'audio_files', question_set)
        
        if not os.path.exists(audio_dir):
            return jsonify({'error': f'Audio directory not found: {audio_dir}'}), 404
        
        all_files = [f for f in os.listdir(audio_dir) if f.endswith('.mp3')]
        
        excluded_files = {
            '1-PRS-Intro.mp3',
            'Wait_For_Instructions.mp3'
        }
        
        question_files = [f for f in all_files if f not in excluded_files]
        question_files.sort()
        
        return jsonify({
            'success': True,
            'question_files': question_files,
            'total_questions': len(question_files),
            'question_set': question_set
        })
        
    except Exception as e:
        print(f"Error getting audio files for {question_set}: {e}")
        return jsonify({'error': f'Failed to get audio files: {str(e)}'}), 500
    
@app.route('/process_audio_files', methods=['POST'])
def process_audio_files() -> Response:
    """
    Processes audio files in the current subject's audio folder, transcribes them, 
    predicts the top 3 emotion and confidence scores, and writes the results to a CSV file.
    
    Returns:
        Response: A JSON response indicating the success of the operation with a message.
    """
    import csv, datetime
    global subject_manager, audio_file_manager, ser_manager
    
    try:
        data_rows = []

        subject_id = subject_manager.subject_id
        audio_folder = audio_file_manager.audio_folder
        experiment_name = subject_manager.experiment_name
        trial_name = subject_manager.trial_name
        experimenter_name = subject_manager.experimenter_name

        date = datetime.datetime.now().strftime("%Y-%m-%d")

        for file in os.listdir(audio_folder):
            if file.endswith(".wav"):
                parts = file.split("_")
                if parts[0] == subject_id and len(parts) > 2:
                    transcription = transcribe_audio(os.path.join(audio_folder, file), timeout_seconds=240)
                    emo_list = ser_manager.predict_emotion(os.path.join(audio_folder, file))
                    timestamp_iso = parts[1]
                    
                    try:
                        timestamp_iso_clean = timestamp_iso.replace('Z', '+00:00')
                        dt = datetime.datetime.fromisoformat(timestamp_iso_clean)
                        timestamp_unix = dt.timestamp()
                    except Exception as parse_error:
                        print(f"Warning: Could not parse timestamp from {file}: {parse_error}")
                        timestamp_unix = None 

                    emotion1, confidence1 = emo_list[0][0], emo_list[0][1]
                    emotion2, confidence2 = emo_list[1][0], emo_list[1][1]
                    emotion3, confidence3 = emo_list[2][0], emo_list[2][1]

                    data_rows.append([
                        experiment_name,      # 1. experiment_name
                        trial_name,           # 2. trial_name
                        subject_id,           # 3. subject_id
                        experimenter_name,    # 4. experimenter_name
                        timestamp_unix,       # 5. timestamp_unix 
                        timestamp_iso,        # 6. timestamp_iso (was timestamp)
                        file,                 # 7. file_name
                        transcription,        # 8. transcription
                        emotion1,             # 9. SER_Emotion_Label_1
                        confidence1,          # 10. SER_Confidence_1
                        emotion2,             # 11. SER_Emotion_Label_2
                        confidence2,          # 12. SER_Confidence_2
                        emotion3,             # 13. SER_Emotion_Label_3
                        confidence3           # 14. SER_Confidence_3
                    ])

        data_rows.sort(key=lambda x: x[4] if x[4] is not None else 0)   # Sort by timestamp
        
        csv_path = os.path.join(subject_manager.subject_folder, f"{date}_{experiment_name}_{trial_name}_{subject_id}_SER.csv")

        with open(csv_path, mode='w', newline='') as file:
            writer = csv.writer(file)
            
            writer.writerow([
                "experiment_name", 
                "trial_name", 
                "subject_id", 
                "experimenter_name", 
                "timestamp_unix",         
                "timestamp_iso",          
                "file_name", 
                "transcription", 
                "SER_Emotion_Label_1", 
                "SER_Confidence_1", 
                "SER_Emotion_Label_2", 
                "SER_Confidence_2", 
                "SER_Emotion_Label_3", 
                "SER_Confidence_3" 
            ])
            
            for row in data_rows:
                writer.writerow(row)   

        print(f"CSV file created: {csv_path}")
        return jsonify({'message': 'Audio files processed successfully.', 'path': csv_path}), 200
    
    except Exception as e:
        print(f"Error processing audio files: {e}")
        return jsonify({'error': f'Failed to process audio files: {str(e)}'}), 500

@app.route('/set_device', methods=['POST'])
def set_device() -> Response:
    global recording_manager
    data = request.get_json()
    try:
        device_index = int(data.get('device_index'))
    except (TypeError, ValueError):
        return jsonify({'message': 'Invalid device index'}), 400

    try:
        recording_manager.set_device(device_index)
        return jsonify({'message': 'Device index set.'})
    except Exception as e:
        return jsonify({'message': f'Error setting device index: {str(e)}'}), 400

@app.route('/start_recording', methods=['POST'])    
def start_recording() -> Response:
    global recording_manager
    try:
        recording_manager.start_recording()
        start_time = time.time()

        timeout = 10 # seconds
        while not recording_manager.stream_is_active:
            if time.time() - start_time > timeout:
                return jsonify({'status': 'Error starting recording.'}), 400
            time.sleep(0.5)

        return jsonify({'status': 'Recording started.'}), 200
    except Exception as e:
        return jsonify({'status': 'Error starting recording.'}), 400

@app.route('/reset_audio', methods=['POST'])
def reset_audio():
    """Reset the audio system"""
    global recording_manager
    if recording_manager is None:
        return jsonify({'error': 'Recording manager not initialized'}), 400
    
    try:
        recording_manager.reset_audio_system()
        return jsonify({'message': 'Audio system reset successfully. Please test input and output before proceeding.'}), 200
    except Exception as e:
        return jsonify({'message': f'Error resetting audio system: {str(e)}'}), 400

@app.route('/test_audio', methods=['POST'])
def test_audio():
    global recording_manager, transcription_manager, audio_file_manager

    if recording_manager is None:
        return jsonify({'error': 'Recording manager not initialized'}), 400
    if transcription_manager is None:
        return jsonify({'error': 'Transcription manager not initialized'}), 400
    
    try:
        recording_manager.stop_recording()
        original_file = recording_manager.recording_file
        
        transcription_file = audio_file_manager.resample(original_file, 16000)
        
        result = transcription_manager.transcribe(transcription_file)
        
        if result and result.get("success"):
            return jsonify({'result': result["text"]})
        else:
            return jsonify({'result': 'Sorry, I could not understand the response.'})
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

def transcribe_audio(file, timeout_seconds=30):
    global transcription_manager, recording_manager, audio_file_manager
    
    if recording_manager is None:
        print("❌ Recording manager not initialized")
        return 
    if transcription_manager is None:
        print("❌ Transcription manager not initialized")
        return 
    
    try:
        if recording_manager.stream_is_active:
            recording_manager.stop_recording()
        
        original_file = recording_manager.recording_file
        transcription_file = audio_file_manager.resample(original_file, 16000)

        result = transcription_manager.transcribe(transcription_file)
        
        if result and result.get("success"):
            return result["text"]
        else:
            return 'Sorry, I could not understand the response.'
            
    except Exception as e:
        print(f"❌ Ultra-fast transcription exception: {str(e)}")
        return "Sorry, something went wrong with the transcription."
              
def generate_experiment_id(experiment_name=""):
    clean_name = "".join(c for c in experiment_name if c.isalnum() or c in (' ', '-', '_')).strip()
    clean_name = clean_name.replace(' ', '_').lower()
    
    if len(clean_name) > 30:
        clean_name = clean_name[:30]

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    
    if clean_name:
        return f"{clean_name}_{timestamp}"
    else:
        return f"experiment_{timestamp}"

def broadcast_to_session(session_id, event_data):
    """Broadcast an event to all SSE connections for a specific session"""
    global update_message, update_event
    
    # Set global message for this session
    update_message = event_data
    update_event.set()
    
    # Also use queue if available
    if session_id in session_queues:
        try:
            session_queues[session_id].put(event_data, timeout=1)
        except Exception as e:
            print(f"Failed to send event via queue: {e}")

@app.route('/api/sessions/<session_id>/trigger-audio-test', methods=['POST'])
def trigger_audio_test(session_id):
    global update_message, update_event
    
    update_message = {
        'event_type': 'audio_test_started',
        'session_id': session_id
    }
    update_event.set()
    
    return jsonify({'success': True})


@app.route('/api/experiments', methods=['GET'])
def list_experiments():
    experiments = []
    
    try:
        for filename in os.listdir(EXPERIMENT_TEMPLATES_DIR):
            if filename != 'paradigms.json' and filename.endswith('.json'):
                filepath = os.path.join(EXPERIMENT_TEMPLATES_DIR, filename)
                
                with open(filepath, 'r') as f:
                    experiment = json.load(f)
                    created_at = experiment.get('created_at')

                    if created_at is None:
                        file_mtime = os.path.getmtime(filepath)
                        created_at = datetime.fromtimestamp(file_mtime, timezone.utc).isoformat()
                    
                    experiments.append({
                        'id': experiment.get('id'),
                        'name': experiment.get('name'),
                        'description': experiment.get('description', ''),
                        'created_at': created_at,
                        'estimated_duration': experiment.get('estimated_duration', 0),
                        'procedure_count': len(experiment.get('procedures', [])),
                        'procedures': [
                            {
                                'name': proc.get('name'),
                                'duration': proc.get('duration', 0)
                            } 
                            for proc in experiment.get('procedures', [])
                        ]
                    })
        
        experiments.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return jsonify(experiments)
        
    except Exception as e:
        print(f"Error loading experiments: {e}")
        return jsonify([])

def strip_internal_fields(procedures):
    """Remove UI-only fields that should never be persisted."""
    for proc in procedures:
        config = proc.get('configuration', {})
        config.pop('_allProcedures', None)
        wizard = proc.get('wizardData', {})
        raw = wizard.get('rawConfiguration', {})
        if isinstance(raw, dict):
            raw.pop('_allProcedures', None)
    return procedures

@app.route('/api/experiments/<experiment_id>/run', methods=['POST'])
def run_experiment(experiment_id):
    try:
        template_path = os.path.join(EXPERIMENT_TEMPLATES_DIR, f"{experiment_id}.json")
        
        if not os.path.exists(template_path):
            return jsonify({'error': 'Experiment template not found'}), 404
        
        with open(template_path, 'r') as f:
            template = json.load(f)
        
        template['procedures'] = strip_internal_fields(template.get('procedures', []))
        
        session_timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        session_id = f"{experiment_id}_{session_timestamp}"
        
        ACTIVE_SESSIONS[session_id] = {
            'session_id': session_id,
            'experiment_id': experiment_id,
            'experiment_name': template['name'],
            'status': 'created',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'template': template,
            'experiment_folder_name': None,  
            'trial_name': None,  
            'subject_folder': None,  
            'participant_info': None
        }
    
        session_completions[session_id] = {
            'completed_procedures': [],
            'current_procedure': 0
        }
        
        print(f"Session {session_id} created")
        
        instantiate_modules(template_path)

        return jsonify({
            'success': True,
            'session_id': session_id,
            'experiment_name': template['name']
        })
        
    except Exception as e:
        print(f"Error starting experiment {experiment_id}: {e}")
        return jsonify({'error': f'Failed to start experiment: {str(e)}'}), 500
    
@app.route('/api/sessions/<session_id>/set-experiment-trial', methods=['POST'])
def set_experiment_trial(session_id):
    try:
        if session_id not in ACTIVE_SESSIONS:
            return jsonify({'error': 'Session not found'}), 404
        
        data = request.json
        experiment_folder_name = data.get('experiment_name', '').strip()
        trial_name = data.get('trial_name', '').strip()
        student_first_name = data.get('student_first_name', '').strip()
        student_last_name = data.get('student_last_name', '').strip()
        
        if not experiment_folder_name or not trial_name or not student_first_name or not student_last_name:
            return jsonify({'error': 'Experiment name, trial name, and student names are all required'}), 400
        
        experiment_folder_name = "".join(c for c in experiment_folder_name if c.isalnum() or c in (' ', '-', '_')).strip()
        experiment_folder_name = experiment_folder_name.replace(' ', '_').lower()
        
        trial_name = "".join(c for c in trial_name if c.isalnum() or c in (' ', '-', '_')).strip()
        trial_name = trial_name.replace(' ', '_').lower()

        ACTIVE_SESSIONS[session_id]['experiment_folder_name'] = experiment_folder_name
        ACTIVE_SESSIONS[session_id]['trial_name'] = trial_name
        ACTIVE_SESSIONS[session_id]['experimenter_name'] = f"{student_first_name} {student_last_name}"
        ACTIVE_SESSIONS[session_id]['status'] = 'experiment_trial_set'
        
        experiment_dir = os.path.join(EXPERIMENT_SUBJECT_DATA_DIR, experiment_folder_name)
        trial_dir = os.path.join(experiment_dir, trial_name)
        
        os.makedirs(trial_dir, exist_ok=True)
        
        subject_manager.experiment_name = experiment_folder_name
        subject_manager.trial_name = trial_name
        subject_manager.experimenter_name = f"{student_first_name} {student_last_name}"

        if vernier_manager is not None:
            vernier_manager.experimenter_name = f"{student_first_name} {student_last_name}"
        if event_manager is not None:
            event_manager.experimenter = f"{student_first_name} {student_last_name}"
        if polar_manager is not None:
            polar_manager.experimenter_name = f"{student_first_name} {student_last_name}"

        print(f"Experiment and trial set for session {session_id}: {experiment_folder_name}/{trial_name}")
        
        return jsonify({
            'success': True,
            'experiment_folder': experiment_folder_name,
            'trial_name': trial_name
        })
        
    except Exception as e:
        print(f"Error setting experiment/trial for session {session_id}: {e}")
        return jsonify({'error': f'Failed to set experiment/trial: {str(e)}'}), 500
    
@app.route('/api/experiments', methods=['POST'])
def save_experiment():
    """
    Handles the saving of an experiment template from a JSON request.
    Validates the incoming request data to ensure that the experiment name and at least one procedure are provided.
    Generates a unique experiment ID, constructs the experiment object, processes each procedure, and sorts them by position.
    Saves the experiment as a JSON file in the designated templates directory.
    Returns:
        Response: A JSON response indicating success and experiment details if saved successfully,
                  or an error message with appropriate HTTP status code if validation fails or an exception occurs.
    """
    
    try:
        data = request.json
        
        if not data.get('name'):
            return jsonify({'error': 'Experiment name is required'}), 400
        
        if not data.get('procedures') or len(data.get('procedures', [])) == 0:
            return jsonify({'error': 'At least one procedure is required'}), 400
        
        experiment_id = generate_experiment_id(data['name'])
        
        experiment = {
            'id': experiment_id,
            'name': data['name'],
            'description': data.get('description', f"Experiment: {data['name']}"),
            'created_at': data.get('created_at', datetime.now(timezone.utc).isoformat()),
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'estimated_duration': data.get('estimated_duration', 0),
            'dataCollectionMethods': data.get('dataCollectionMethods', {}),
            'procedures': []
        }
        
        for proc_data in data['procedures']:
            procedure = process_procedure_for_psychopy(proc_data)
            experiment['procedures'].append(procedure)
        
        experiment['procedures'].sort(key=lambda x: x.get('position', 0))
        
        filename = f"{experiment_id}.json"
        filepath = os.path.join(EXPERIMENT_TEMPLATES_DIR, filename)
        
        with open(filepath, 'w') as f:
            json.dump(experiment, f, indent=2)
        
        return jsonify({
            'success': True,
            'id': experiment_id,
            'message': 'Experiment saved successfully',
            'filepath': filepath
        })
        
    except Exception as e:
        print(f"Error saving experiment: {e}")
        return jsonify({'error': f'Failed to save experiment: {str(e)}'}), 500

@app.route('/api/save-template', methods=['POST'])
def save_template():
    try:
        data = request.json
        
        if not data.get('name'):
            return jsonify({'error': 'Template name is required'}), 400
        
        if not data.get('category'):
            return jsonify({'error': 'Category is required'}), 400
        
        template_name = data['name'].strip()
        template_id = re.sub(r'[^a-zA-Z0-9\s-]', '', template_name.lower())
        template_id = re.sub(r'\s+', '-', template_id)
        template_id = template_id.strip('-')
        
        if not template_id:
            return jsonify({'error': 'Invalid template name'}), 400
        
        config_path = os.path.join('experiments', 'experiment-config.json')
        
        if not os.path.exists(config_path):
            return jsonify({'error': 'experiment-config.json not found'}), 500
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # Ensure paradigms section exists
        if 'paradigms' not in config:
            config['paradigms'] = {}
        
        # Check if template already exists
        if template_id in config['paradigms']:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            template_id = f"{template_id}_{timestamp}"
        
        # Create template entry
        config['paradigms'][template_id] = {
            'name': data['name'],
            'description': data.get('description', f"Experimental paradigm: {data['name']}"),
            'color': data.get('color', '#8B5CF6'),
            'procedures': data.get('procedures', [])
        }
        
        # Save updated config
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        print(f"Template saved: {template_id}")
        
        return jsonify({
            'success': True,
            'message': 'Template saved successfully',
            'template_id': template_id
        })
        
    except Exception as e:
        print(f"Error saving template: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500
    
@app.route('/api/add-psychopy-procedure', methods=['POST'])
def add_psychopy_procedure():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        required_fields = ['name', 'duration', 'category', 'platform']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'error': f'{field} is required'}), 400
    
        instruction_steps = data.get('instructionSteps', [])
        if not instruction_steps or len(instruction_steps) == 0:
            return jsonify({'success': False, 'error': 'At least one instruction step is required'}), 400
        
        for i, step in enumerate(instruction_steps):
            if not step.strip():
                return jsonify({'success': False, 'error': f'Instruction step {i+1} cannot be empty'}), 400
    
        try:
            duration = int(data['duration'])
            if duration < 1:
                return jsonify({'success': False, 'error': 'Duration must be at least 1 minute'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'error': 'Duration must be a valid number'}), 400
        
        procedure_name = data['name'].strip()
        platform = data['platform'].strip().lower()
        procedure_id = re.sub(r'[^a-zA-Z0-9\s-]', '', procedure_name.lower())
        procedure_id = re.sub(r'\s+', '-', procedure_id)
        procedure_id = procedure_id.strip('-')
        
        if not procedure_id:
            return jsonify({'success': False, 'error': 'Invalid procedure name'}), 400
        
        config_path = os.path.join('experiments')
        os.makedirs(config_path, exist_ok=True)
        config_path = os.path.join(config_path, 'experiment-config.json')

        if not os.path.exists(config_path):
            return jsonify({'success': False, 'error': 'experiment-config.json not found'}), 500
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        if procedure_id in config.get('procedures', {}):
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            procedure_id = f"{procedure_id}_{timestamp}"
        
        new_procedure = {
            'id': procedure_id,
            'name': procedure_name,
            'duration': duration,
            'required': data.get('required', False),
            'category': data['category'].strip(),
            'platform': platform 
        }
        
        if 'procedures' not in config:
            config['procedures'] = {}
        config['procedures'][procedure_id] = new_procedure
        
        if 'wizardSteps' not in config:
            config['wizardSteps'] = {}
        
        config['wizardSteps'][procedure_id] = [
            {
                'id': 'psychopy-setup',
                'title': 'PsychoPy Setup',
                'description': 'Configure PsychoPy integration options'
            },
            {
                'id': 'task-description',
                'title': 'Task Configuration',
                'description': 'Define task parameters and settings'
            }
        ]
        
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        instructions_path = os.path.join('experiments', 'instruction-steps.json')
        instructions = {}
        
        if os.path.exists(instructions_path):
            with open(instructions_path, 'r', encoding='utf-8') as f:
                instructions = json.load(f)
        
        formatted_steps = []
        for i, step_content in enumerate(instruction_steps):
            step_num = i + 1
            formatted_steps.append({
                'id': f'step{step_num}',
                'title': f'Step {step_num}',
                'label': f'{procedure_name} - Step {step_num}' if len(instruction_steps) > 1 else f'{procedure_name} Instructions',
                'content': step_content.strip()
            })
        
        instructions[procedure_id] = {
            'title': f'{procedure_name}',
            'steps': formatted_steps
        }
        
        with open(instructions_path, 'w', encoding='utf-8') as f:
            json.dump(instructions, f, indent=2, ensure_ascii=False)
        
        return jsonify({
            'success': True,
            'message': 'PsychoPy procedure added successfully',
            'procedure': new_procedure,
            'instruction_steps_added': len(instruction_steps)
        })
        
    except json.JSONDecodeError as e:
        return jsonify({'success': False, 'error': f'JSON parsing error: {str(e)}'}), 500
    except Exception as e:
        print(f"Error adding PsychoPy procedure: {str(e)}")
        return jsonify({'success': False, 'error': f'Server error: {str(e)}'}), 500
    
def process_procedure_for_psychopy(proc_data):
    """
    Process procedure data for external software. Function needs renaming.
    """
    # Strip internal UI-only fields before saving
    config = proc_data.get('configuration', {})
    config.pop('_allProcedures', None)
    
    config_platform = config.get('psychopy-setup', {}).get('platform')
    top_level_platform = proc_data.get('platform')
    
    # Prioritize configuration platform over top-level
    final_platform = config_platform if config_platform else top_level_platform
    
    procedure = {
        'id': proc_data.get('id'),
        'instanceId': proc_data.get('instanceId'),
        'name': proc_data.get('name'),
        'duration': proc_data.get('duration'),
        'customDuration': proc_data.get('customDuration'),
        'color': proc_data.get('color'),
        'required': proc_data.get('required'),
        'platform': final_platform,  # ← Use the extracted platform
        'position': proc_data.get('position'),
        
        'configuration': proc_data.get('configuration', {}),
        
        'wizardData': {
            # Existing wizard data fields...
            'surveyFiles': proc_data.get('configuration', {}).get('file-upload', {}).get('surveyFiles'),
            'standardFields': proc_data.get('configuration', {}).get('standard-fields', {}).get('standardFields'),
            'questionOrder': proc_data.get('configuration', {}).get('order', {}).get('questionOrder'),
            'enableBranching': proc_data.get('configuration', {}).get('order', {}).get('enableBranching'),
            
            # Consent wizard data
            'consentMethod': proc_data.get('configuration', {}).get('document', {}).get('consentMethod'),
            'consentDocument': proc_data.get('configuration', {}).get('document', {}).get('consentFile'),
            'consentFilePath': proc_data.get('configuration', {}).get('document', {}).get('consentFilePath'),
            'consentLink': proc_data.get('configuration', {}).get('document', {}).get('consentLink'),
            'requireSignature': proc_data.get('configuration', {}).get('document', {}).get('requireSignature'),
            
            # Sensor wizard data
            'selectedSensors': proc_data.get('configuration', {}).get('sensors', {}).get('selectedSensors'),
            
            # Duration/baseline wizard data
            'recordingDuration': proc_data.get('configuration', {}).get('duration', {}).get('duration'),
            'baselineTask': proc_data.get('configuration', {}).get('duration', {}).get('baselineTask'),
            
            # PsychoPy integration fields (NEW)
            'usePsychoPy': proc_data.get('configuration', {}).get('psychopy-setup', {}).get('usePsychoPy', False),
            'psychopyInstructions': proc_data.get('configuration', {}).get('psychopy-setup', {}).get('psychopyInstructions'),
            'platform': final_platform,  # ← Also update in wizardData
            
            # SART specific fields (NEW)
            'sartVersion': proc_data.get('configuration', {}).get('task-setup', {}).get('sartVersion'),
            'targetDigit': proc_data.get('configuration', {}).get('task-setup', {}).get('targetDigit'),
            
            # VR Room Task specific fields
            'vrRoomSessionType': proc_data.get('configuration', {}).get('session-type-selection', {}).get('sessionType'),
            'vrRoomAudioSet': proc_data.get('configuration', {}).get('audio-set-selection', {}).get('audioSet'),
            'vrRoomSequenceConfig': proc_data.get('configuration', {}).get('audio-set-selection', {}).get('sequenceConfig'),
            'vrRoomEditableConfig': proc_data.get('configuration', {}).get('sequence-editor', {}).get('editableConfig'),
            'vrRoomConditionMarker': proc_data.get('configuration', {}).get('task-description', {}).get('conditionMarker'),
            'vrRoomTaskNotes': proc_data.get('configuration', {}).get('task-description', {}).get('taskNotes'),

            # Store complete configuration for future reference
            'rawConfiguration': proc_data.get('configuration', {}),

            'breakDuration': proc_data.get('configuration', {}).get('duration', {}).get('duration'),
            'selectedVideo': proc_data.get('configuration', {}).get('media-selection', {}).get('selectedVideo'),
        }
    }
    
    return procedure

@app.route('/api/experiments/<experiment_id>', methods=['GET'])
def get_experiment(experiment_id):
    """Get a specific experiment template"""
    try:
        filepath = os.path.join(EXPERIMENT_TEMPLATES_DIR, f"{experiment_id}.json")
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'Experiment not found'}), 404
        
        with open(filepath, 'r') as f:
            experiment = json.load(f)
        
        return jsonify(experiment)
        
    except Exception as e:
        print(f"Error loading experiment {experiment_id}: {e}")
        return jsonify({'error': 'Failed to load experiment'}), 500

@app.route('/api/experiments/<experiment_id>', methods=['PUT'])
def update_experiment(experiment_id):
    """
    Update an existing experiment template.
    
    CONTRACT:
        Route: /api/experiments/<experiment_id>
        Method: PUT
        
    REQUEST JSON:
        {
            "name": str,
            "procedures": list,
            "dataCollectionMethods": dict,
            "created_at": str,
            "estimated_duration": int
        }
    
    RETURNS:
        200: {"success": true, "id": str, "message": str, "filepath": str}
        400: {"error": str}
        404: {"error": "Experiment not found"}
        500: {"error": str}
    """
    try:
        filepath = os.path.join(EXPERIMENT_TEMPLATES_DIR, f"{experiment_id}.json")
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'Experiment not found'}), 404
        
        data = request.json
        
        if not data.get('name'):
            return jsonify({'error': 'Experiment name is required'}), 400
        
        if not data.get('procedures') or len(data.get('procedures', [])) == 0:
            return jsonify({'error': 'At least one procedure is required'}), 400
        
        with open(filepath, 'r') as f:
            existing_experiment = json.load(f)
        
        experiment = {
            'id': experiment_id,
            'name': data['name'],
            'description': data.get('description', f"Experiment: {data['name']}"),
            'created_at': existing_experiment.get('created_at', datetime.now(timezone.utc).isoformat()),
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'estimated_duration': data.get('estimated_duration', 0),
            'dataCollectionMethods': data.get('dataCollectionMethods', {}),
            'procedures': []
        }
        
        for proc_data in data['procedures']:
            procedure = process_procedure_for_psychopy(proc_data)
            experiment['procedures'].append(procedure)
        
        experiment['procedures'].sort(key=lambda x: x.get('position', 0))
        
        with open(filepath, 'w') as f:
            json.dump(experiment, f, indent=2)
        
        print(f"Experiment updated: {experiment_id}")
        
        return jsonify({
            'success': True,
            'id': experiment_id,
            'message': 'Experiment updated successfully',
            'filepath': filepath
        })
        
    except Exception as e:
        print(f"Error updating experiment: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to update experiment: {str(e)}'}), 500
    
@app.route('/import_emotibit_csv', methods=['POST'])
def import_emotibit_csv() -> Response:
    global event_manager, subject_manager
    
    if event_manager.data_folder is None:
        print("EmotiBit data folder not set.")
        return jsonify({'message': 'Subject information is not set.'}), 400
    
    files = []
    if 'emotibit_file' in request.files:
        files = [request.files['emotibit_file']]
    elif 'emotibit_files' in request.files:
        files = request.files.getlist('emotibit_files')
    else:
        return jsonify({'message': 'No file part.'}), 400
    
    if not files:
        return jsonify({'message': 'No files selected.'}), 400
    
    uploaded_files = []
    errors = []
    
    for i, file in enumerate(files):
        print(f"Processing file {i+1}: {file.filename}")
        
        if not file.filename or not file.filename.lower().endswith(".csv"):
            errors.append(f"File '{file.filename}': Invalid file type. Only CSV files are allowed.")
            continue
        
        if i == 0:
            new_filename = f"{event_manager.time_started_iso}_{subject_manager.subject_id}_emotibit_ground_truth.csv"
        else:
            new_filename = f"{event_manager.time_started_iso}_{subject_manager.subject_id}_emotibit_ground_truth_{i+1}.csv"
        
        file_path = os.path.join(event_manager.data_folder, new_filename)
        
        counter = 1
        
        while os.path.exists(file_path):
            base_name = new_filename.rsplit('.csv', 1)[0]
            if i == 0:
                file_path = os.path.join(event_manager.data_folder, f"{base_name}_{counter}.csv")
            else:
                if f"_{i+1}" in base_name:
                    base_name = base_name.replace(f"_{i+1}", "")
                file_path = os.path.join(event_manager.data_folder, f"{base_name}_{i+1}_{counter}.csv")
            counter += 1
        
        try:
            file.save(file_path)
            uploaded_files.append({
                'original_name': file.filename,
                'saved_name': os.path.basename(file_path),
                'file_path': file_path
            })
            print(f"File saved: {file_path}")
        except Exception as e:
            errors.append(f"File '{file.filename}': Error saving file - {str(e)}")
            print(f"Error saving file {file.filename}: {e}")

    if uploaded_files and not errors:
        if len(uploaded_files) == 1:
            return jsonify({
                "success": True, 
                "message": "File uploaded successfully.", 
                "file_path": uploaded_files[0]['file_path']
            }), 200
        else:
            file_paths = [f['file_path'] for f in uploaded_files]
            return jsonify({
                "success": True, 
                "message": f"{len(uploaded_files)} files uploaded successfully.", 
                "file_paths": file_paths,
                "uploaded_files": uploaded_files
            }), 200
    
    elif uploaded_files and errors:
        file_paths = [f['file_path'] for f in uploaded_files]
        return jsonify({
            "success": True, 
            "message": f"{len(uploaded_files)} files uploaded successfully, {len(errors)} failed.", 
            "file_paths": file_paths,
            "uploaded_files": uploaded_files,
            "errors": errors
        }), 200
    
    else:
        return jsonify({
            "success": False, 
            "message": "All file uploads failed.", 
            "errors": errors
        }), 400

@app.route('/api/experiment-config', methods=['GET'])
def get_experiment_config():
    """Serve experiment configuration from backend"""
    try:
        config_path = os.path.join('experiments', 'experiment-config.json')
        
        if not os.path.exists(config_path):
            return jsonify({'error': 'Configuration not found'}), 404
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        return jsonify(config)
        
    except Exception as e:
        print(f"Error loading config: {e}")
        return jsonify({'error': 'Failed to load configuration'}), 500
     
@app.route('/api/upload-consent-form', methods=['POST'])
def upload_consent_form():
    """Upload consent form PDF and save to experiment-specific directory"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        experiment_name = request.form.get('experiment_name', 'default')
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'success': False, 'error': 'Invalid file type. Only PDF files are allowed'}), 400
        
        clean_experiment_name = "".join(c for c in experiment_name if c.isalnum() or c in (' ', '-', '_')).strip()
        clean_experiment_name = clean_experiment_name.replace(' ', '_').lower()
        
        experiment_consent_dir = os.path.join(CONSENT_FORMS_DIR, clean_experiment_name)
        os.makedirs(experiment_consent_dir, exist_ok=True)
        
        filename = secure_filename(file.filename)
        if not filename:
            filename = 'consent_form.pdf'
        
        filepath = os.path.join(experiment_consent_dir, filename)
    
        file.save(filepath)
        
        print(f"Consent form uploaded: {filepath}")
        
        return jsonify({
            'success': True, 
            'message': 'Consent form uploaded successfully',
            'filePath': filepath,
            'filename': filename,
            'experiment_name': clean_experiment_name
        })
        
    except Exception as e:
        print(f"Consent form upload error: {str(e)}")
        return jsonify({'success': False, 'error': f'Server error: {str(e)}'}), 500

@app.route('/static/consent_forms/<experiment_name>/<filename>')
def serve_consent_form(experiment_name, filename):
    """Serve consent form PDFs"""
    try:
        consent_dir = os.path.join(CONSENT_FORMS_DIR, experiment_name)
        return send_from_directory(consent_dir, filename)
    except Exception as e:
        print(f"Error serving consent form: {e}")
        return jsonify({'error': 'Consent form not found'}), 404

@app.route('/api/sessions/<session_id>/record-consent', methods=['POST'])
def record_consent(session_id):
    """Record participant consent for the session"""
    try:
        if session_id not in ACTIVE_SESSIONS:
            return jsonify({'error': 'Session not found'}), 404
        
        data = request.json
        consent_given = data.get('consentGiven', False)
        consent_method = data.get('consentMethod', 'unknown')
        timestamp = data.get('timestamp', datetime.now(timezone.utc).isoformat())
        
        session_data = ACTIVE_SESSIONS[session_id]
        if 'consent_record' not in session_data:
            session_data['consent_record'] = {}
        
        session_data['consent_record'] = {
            'consent_given': consent_given,
            'consent_method': consent_method,
            'timestamp': timestamp,
            'ip_address': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', '')
        }
        
        session_data['status'] = 'consent_completed'
        session_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        if session_data.get('subject_dir'):
            subject_dir = session_data['subject_dir']
            os.makedirs(subject_dir, exist_ok=True)
            
            consent_file = os.path.join(subject_dir, 'consent_record.json')
            with open(consent_file, 'w') as f:
                json.dump(session_data['consent_record'], f, indent=2)
            
            session_file = os.path.join(subject_dir, 'session.json')
            with open(session_file, 'w') as f:
                json.dump(session_data, f, indent=2)
        
        print(f"Consent recorded for session {session_id}: {consent_given}")
        
        return jsonify({
            'success': True,
            'message': 'Consent recorded successfully',
            'consent_given': consent_given
        })
        
    except Exception as e:
        print(f"Error recording consent for session {session_id}: {e}")
        return jsonify({'error': f'Failed to record consent: {str(e)}'}), 500

@app.route('/api/get-autofilled-survey-url', methods=['POST'])
def get_autofilled_survey_url():
    global form_manager, subject_manager
    
    try:
        data = request.json
        session_id = data.get('session_id')
        survey_name = data.get('survey_name')
        survey_url = data.get('survey_url')
        
        print("="*80)
        print("DEBUG: get_autofilled_survey_url called")
        print(f"DEBUG: session_id: {session_id}")
        print(f"DEBUG: survey_name: {survey_name}")
        print(f"DEBUG: Original URL from request: {survey_url}")
        print(f"DEBUG: 'Sample+ID' in original URL: {'Sample+ID' in survey_url}")
        print("="*80)
        
        if not session_id or not survey_name or not survey_url:
            return jsonify({'success': False, 'error': 'Missing required parameters'}), 400
        
        if session_id not in ACTIVE_SESSIONS:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        subject_id = subject_manager.subject_id
        print(f"DEBUG: Subject ID from subject_manager: '{subject_id}'")
        print(f"DEBUG: Subject ID type: {type(subject_id)}")
        print(f"DEBUG: Subject ID is None: {subject_id is None}")
        print(f"DEBUG: Subject ID is empty: {subject_id == '' if subject_id else 'N/A'}")
        
        if not subject_id:
            print("ERROR: Subject ID not available!")
            return jsonify({'success': False, 'error': 'Subject ID not available. Participant form may not be completed.'}), 400
        
        print(f"DEBUG: form_manager exists: {form_manager is not None}")
        
        if form_manager is None:
            form_manager = FormManager()
        
        print(f"DEBUG: Calling customize_form_url with:")
        print(f"  - URL: {survey_url}")
        print(f"  - subject_id: {subject_id}")
        
        autofilled_url = form_manager.customize_form_url(survey_url, subject_id)
        
        print(f"DEBUG: Result from customize_form_url: {autofilled_url}")
        print(f"DEBUG: Still contains 'Sample+ID': {'Sample+ID' in autofilled_url}")
        print(f"DEBUG: URLs are different: {autofilled_url != survey_url}")
        print("="*80)
        
        return jsonify({
            'success': True,
            'autofilled_url': autofilled_url,
            'survey_name': survey_name
        })
        
    except Exception as e:
        print(f"ERROR in get_autofilled_survey_url: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': 'Server error'}), 500

####### SER BASELINE #######
@app.route('/initialize_ser_baseline', methods=['POST'])
def initialize_ser_baseline() -> Response:
    """
    Initialize the SER baseline procedure with a specific question set.
    This should be called when the SER baseline procedure starts.
    """
    global test_manager
    
    if test_manager is None:
        return jsonify({'status': 'error', 'message': 'Test manager not initialized'}), 400
    
    data = request.get_json() or {}
    question_set = data.get('questionSet', 'ser_1')
    
    try:
        test_manager.reset_ser_baseline(question_set)
        total_questions = test_manager.get_ser_question_count(question_set)
        
        print(f"SER Baseline initialized with question set: {question_set}")
        print(f"Total questions in set: {total_questions}")
        
        return jsonify({
            'status': 'SER baseline initialized',
            'question_set': question_set,
            'total_questions': total_questions
        }), 200
        
    except Exception as e:
        print(f"Error initializing SER baseline: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 400
    
@app.route('/get_ser_question', methods=['POST'])
def get_ser_question() -> Response:
    global test_manager, recording_manager
    
    if test_manager is None:
        return jsonify({'status': 'error', 'message': 'Test manager not initialized'}), 400
    
    data = request.get_json() or {}
    question_set = data.get('questionSet')
    
    if question_set and question_set != test_manager.current_ser_question_set:
        test_manager.reset_ser_baseline(question_set)
    
    try:
        current_question = test_manager.get_ser_question_by_set(
            test_manager.current_ser_question_set, 
            test_manager.current_ser_question_index
        )
        
        if current_question is not None:
            if isinstance(current_question, dict):
                question_text = current_question.get('text', str(current_question))
            else:
                question_text = str(current_question)
            
            test_manager.current_ser_question_index += 1

            # DEBUG
            print(f"SER Question Set: {test_manager.current_ser_question_set}")
            print(f"SER Question Index after increment: {test_manager.current_ser_question_index}")
            print(f"SER Question: {question_text}")

            return jsonify({
                'message': 'Question found', 
                'question': question_text,
                'question_set': test_manager.current_ser_question_set,
                'question_index': test_manager.current_ser_question_index - 1  # Return the index of the current question (before increment)
            })
        
        else:
            # No more questions available
            if recording_manager and recording_manager.stream_is_active:
                recording_manager.stop_recording()
            
            print("SER task completed - no more questions")
            return jsonify({
                'message': 'SER task completed.',
                'question_set': test_manager.current_ser_question_set,
                'total_completed': test_manager.current_ser_question_index
            }), 200

    except Exception as e:
        print(f"Error in get_ser_question: {e}") 
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/process_ser_answer', methods=['POST'])  
def process_ser_answer() -> Response:
    global subject_manager, recording_manager, audio_file_manager, test_manager

    if recording_manager is None:
        return jsonify({'status': 'error', 'message': 'Recording manager not initialized'}), 400

    try:
        recording_manager.stop_recording()
        
        ts = recording_manager.timestamp
        uts = recording_manager.unix_timestamp
        end_time = recording_manager.end_timestamp_iso
        end_time_unix = recording_manager.end_timestamp_unix
        print(f"Stop time from recording manager: {end_time}")
        
        id = subject_manager.subject_id if subject_manager.subject_id else "unknown"
        question_index = test_manager.current_ser_question_index
        question_set = test_manager.current_ser_question_set
        file_name = f"{id}_{ts}_ser_baseline_{question_set}_question_{question_index}.wav"

        if subject_manager:
            subject_manager.append_data({
                'unix_timestamp': uts,
                'timestamp': ts, 
                'time_stopped': end_time, 
                'time_stopped_unix': end_time_unix,
                'event_marker': f'ser_baseline_{question_set}', 
                'condition': 'None', 
                'audio_file': file_name,
                'question_set': question_set,
                'question_index': question_index
            })
            
        
        if audio_file_manager:
            audio_file_manager.save_audio_file(file_name)

        return jsonify({
            'status': 'Answer processed successfully.',
            'question_set': question_set,
            'question_index': question_index
        })
    
    except Exception as e:
        print(f"Error in process_ser_answer: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/vr-room/stop-recording', methods=['POST'])
def stop_vr_room_recording() -> Response:
    """Stop recording for VR Room Task step and save"""
    global subject_manager, recording_manager, audio_file_manager

    if recording_manager is None:
        return jsonify({'status': 'error', 'message': 'Recording manager not initialized'}), 400

    try:
        data = request.get_json()
        step_name = data.get('stepName', 'unknown_step')
        event_marker = data.get('eventMarker', 'vr_room_task')
        condition = data.get('condition', 'None')
        
        recording_manager.stop_recording()
        
        ts = recording_manager.timestamp
        uts = recording_manager.unix_timestamp
        end_time = recording_manager.end_timestamp_iso
        end_time_unix = recording_manager.end_timestamp_unix
        
        print(f"Stop time from recording manager: {end_time}")
        
        id = subject_manager.subject_id if subject_manager.subject_id else "unknown"
        file_name = f"{id}_{ts}_vr_room_task_{step_name}.wav"

        if subject_manager:
            subject_manager.append_data({
                'unix_timestamp': uts,
                'timestamp': ts, 
                'time_stopped': end_time, 
                'time_stopped_unix': end_time_unix,
                'event_marker': event_marker, 
                'condition': condition, 
                'audio_file': file_name
            })
        
        if audio_file_manager:
            audio_file_manager.save_audio_file(file_name)

        print(f"VR Room recording saved: {file_name}")

        return jsonify({
            'status': 'Recording stopped and saved.',
            'file_name': file_name
        })
    
    except Exception as e:
        print(f"Error in stop_vr_room_recording: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 400
    
@app.route('/reset_ser_baseline', methods=['POST'])
def reset_ser_baseline():
    """Reset the SER baseline question index and optionally change question set"""
    global test_manager
    
    if test_manager is None:
        return jsonify({'status': 'error', 'message': 'Test manager not initialized'}), 400
    
    data = request.get_json() or {}
    question_set = data.get('questionSet', 'ser_1')
    
    try:
        test_manager.reset_ser_baseline(question_set)
        total_questions = test_manager.get_ser_question_count(question_set)
        
        return jsonify({
            'status': 'SER baseline reset successfully',
            'question_set': question_set,
            'total_questions': total_questions
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/get_ser_question_sets', methods=['GET'])
def get_ser_question_sets():
    """Get available SER question sets and their question counts"""
    global test_manager
    
    if test_manager is None:
        return jsonify({'status': 'error', 'message': 'Test manager not initialized'}), 400
    
    try:
        question_sets = {}
        
        if 'questions' in test_manager.ser_questions:
            for question_set in test_manager.ser_questions['questions']:
                question_sets[question_set] = test_manager.get_ser_question_count(question_set)
        
        return jsonify({
            'status': 'success',
            'question_sets': question_sets,
            'current_set': test_manager.current_ser_question_set
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    
@app.route('/start_event_manager', methods=['POST'])
def start_event_manager():
    """Start the event manager"""
    global event_manager, lsl_manager
    try:
        if event_manager.is_streaming:
            return jsonify({'success': True, 'message': 'Event manager is already running'})
        
        if event_manager.data_folder is None:
            return jsonify({'error': 'Data folder not set for event manager'}), 400
        
        event_manager.initialize_hdf5_file()

        event_manager.start()
        if lsl_manager:
            lsl_manager.start()
            print("LSL manager started alongside event manager.")
        return jsonify({'success': True, 'message': 'Event manager started'})
    
    except Exception as e:
        print(f"Error starting event manager: {e}")
        return jsonify({'error': 'Failed to start event manager'}), 500

@app.route('/stop_event_manager', methods=['POST'])
def stop_event_manager():
    """Stop the event manager"""
    global event_manager, lsl_manager
    try:
        event_manager.stop()
        if lsl_manager:
            lsl_manager.stop()
            print("LSL manager stopped alongside event manager.")
        return jsonify({'success': True, 'message': 'Event manager stopped'})
    except Exception as e:
        print(f"Error stopping event manager: {e}")
        return jsonify({'error': 'Failed to stop event manager'}), 500

@app.route('/start_polar_manager', methods=['POST'])
def start_polar_manager():
    """Start the polar manager"""
    global polar_manager
    try:
        if polar_manager is None:
            return jsonify({'success': False, 'error': 'Polar manager not initialized'}), 400
            
        if polar_manager.data_folder is None:
            return jsonify({'success': False, 'error': 'Data folder not set for polar manager'}), 400
        
        if not polar_manager._file_opened:
            polar_manager.initialize_hdf5_file()
        
        result = polar_manager.start()
        
        # Check if device was successfully started
        if polar_manager._device_started:
            return jsonify({'success': True, 'message': result})
        else:
            return jsonify({
                'success': False, 
                'warning': result,
                'message': 'Polar device not connected.'
            }), 200
    
    except Exception as e:
        print(f"Error starting polar manager: {e}")
        return jsonify({
            'success': False, 
            'error': f'Failed to start polar manager: {str(e)}'
        }), 500

@app.route('/stop_polar_manager', methods=['POST'])
def stop_polar_manager():
    """Stop the polar manager"""
    global polar_manager
    try:
        if polar_manager is None:
            return jsonify({'error': 'Polar manager not initialized'}), 400
        
        polar_manager.stop()
        return jsonify({'success': True, 'message': 'Polar manager stopped'})
    
    except Exception as e:
        print(f"Error stopping polar manager: {e}")
        return jsonify({'error': 'Failed to stop polar manager'}), 500

@app.route('/start_vernier_manager', methods=['POST'])
def start_vernier_manager():
    """Start the vernier manager"""
    global vernier_manager
    try:
        if vernier_manager is None:
            return jsonify({'success': False, 'error': 'Vernier manager not initialized'}), 400
            
        if vernier_manager.data_folder is None:
            return jsonify({'success': False, 'error': 'Data folder not set for vernier manager'}), 400
        
        if not vernier_manager._file_opened:
            vernier_manager.initialize_hdf5_file()
        
        result = vernier_manager.start()
        
        # Check if device was successfully started
        if vernier_manager._device_started:
            vernier_manager.run()  # Start the data collection thread
            return jsonify({'success': True, 'message': result})
        else:
            return jsonify({
                'success': False, 
                'warning': result,
                'message': 'Vernier device not connected. You may continue the experiment, but respiratory data will not be collected.'
            }), 200
    
    except Exception as e:
        print(f"Error starting vernier manager: {e}")
        return jsonify({
            'success': False, 
            'error': f'Failed to start vernier manager: {str(e)}'
        }), 500

@app.route('/stop_vernier_manager', methods=['POST'])
def stop_vernier_manager():
    """Stop the vernier manager"""
    global vernier_manager
    try:
        if vernier_manager is None:
            return jsonify({'success': False, 'error': 'Vernier manager not initialized'}), 400
        
        result = vernier_manager.stop()
        return jsonify({'success': True, 'message': result})
    
    except Exception as e:
        print(f"Error stopping vernier manager: {e}")
        return jsonify({'success': False, 'error': f'Failed to stop vernier manager: {str(e)}'}), 500

@app.route('/set_condition', methods=['POST'])
def set_condition():
    """Set a condition for the event manager"""
    global event_manager
    try:
        data = request.get_json()
        condition = data.get('condition', 'None')
        
        if not condition:
            return jsonify({'error': 'Condition cannot be empty'}), 400
        
        event_manager.condition = condition
        print(f"Condition set to: {condition}")

        return jsonify({'success': True, 'message': f'Condition set to {condition}'})
    
    except Exception as e:
        print(f"Error setting condition: {e}")
        return jsonify({'error': 'Failed to set condition'}), 500
    
@app.route('/api/sessions/<session_id>/stream')
def session_stream(session_id):
    def event_stream():
        global update_message
        last_message = None
        while True:
            update_event.wait()
            if update_message != last_message:
                last_message = update_message
                if update_message and update_message.get('session_id') == session_id:
                    yield f"data: {json.dumps(update_message)}\n\n"
            update_event.clear()
    
    return Response(event_stream(), content_type="text/event-stream", 
                   headers={
                       'Cache-Control': 'no-cache',
                       'Connection': 'keep-alive'
                   })

@app.route('/api/sessions/<session_id>/complete-procedure', methods=['POST'])
def complete_procedure(session_id):
    global update_message, update_event
    
    data = request.get_json() or {}
    task_type = data.get('task_type', 'procedure')

    if session_id not in session_completions:
        session_completions[session_id] = {
            'completed_procedures': [],
            'current_procedure': 0
        }
    
    current_proc = session_completions[session_id]['current_procedure']
    if current_proc not in session_completions[session_id]['completed_procedures']:
        session_completions[session_id]['completed_procedures'].append(current_proc)
    
    update_message = {
        'event_type': 'task_completed',
        'session_id': session_id,
        'task_type': task_type,
        'completed_procedures': session_completions[session_id]['completed_procedures'],
        'current_procedure': session_completions[session_id]['current_procedure']
    }
    update_event.set()
    
    return jsonify({
        'success': True,
        'completed_procedures': session_completions[session_id]['completed_procedures']
    })

@app.route('/api/sessions/<session_id>/get-current-procedure', methods=['GET'])
def get_current_procedure(session_id):
    """Get the current procedure for a session"""
    try:
        if session_id not in session_completions:
            return jsonify({'error': 'Session not found'}), 404
        
        current_procedure = session_completions[session_id].get('current_procedure', 0)
        
        return jsonify({
            'success': True,
            'current_procedure': current_procedure,
            'completed_procedures': session_completions[session_id]['completed_procedures']
        })
        
    except Exception as e:
        print(f"Error getting current procedure: {e}")
        return jsonify({'error': 'Failed to get current procedure'}), 500
    
@app.route('/api/sessions/<session_id>/set-current-procedure', methods=['POST'])
def set_current_procedure(session_id):
    global update_message, update_event
    
    try:
        data = request.get_json()
        current_procedure = data.get('current_procedure', 0)
        procedure_name = data.get('procedure_name', '')

        if session_id not in session_completions:
            session_completions[session_id] = {
                'completed_procedures': [],
                'current_procedure': 0
            }
        
        session_completions[session_id]['current_procedure'] = current_procedure
        print(f"Setting current procedure for {session_id} to {current_procedure}")
        
        update_message = {
            'event_type': 'procedure_changed',
            'session_id': session_id,
            'current_procedure': current_procedure,
            'completed_procedures': session_completions[session_id]['completed_procedures']
        }
        update_event.set()
        
        return jsonify({
            'success': True,
            'current_procedure': current_procedure
        })
        
    except Exception as e:
        print(f"Error updating current procedure: {e}")
        return jsonify({'error': 'Failed to update current procedure'}), 500
    
@app.route('/set_current_test', methods=['POST'])
def set_current_test():
    """Set current test number for the test manager"""
    global test_manager
    data = request.get_json()
    test_number = data.get('test_number')
    if test_number is None:
        return jsonify({'error': 'Missing test_number in request'}), 400
    
    try: 
        test_manager.current_test_index = int(test_number)
        test_manager.current_question_index = 0
        print(f"Test set to {test_number}.")
        print(f"Current Question Index: {test_manager.current_question_index}")
        return jsonify({'message': f'Test set to {test_number}.'}), 200
    except ValueError:
        return jsonify({'message': 'Invalid test number.'}), 400
    
@app.route('/get_first_question', methods=['POST'])
def get_first_question():
    """Get the first question and start recording"""
    global test_manager, recording_manager
    
    if test_manager is None:
        return jsonify({'error': 'Test manager not initialized'}), 400
    if recording_manager is None:
        return jsonify({'error': 'Recording manager not initialized'}), 400
    
    test_manager.current_question_index = 0
    questions = test_manager.get_task_questions(test_manager.current_test_index)
    
    try:
        if questions is None:
            return jsonify({"message": "No questions found."})
        else:
            recording_manager.start_recording()
            question = questions[test_manager.current_question_index]
            
            return jsonify({
                'message': 'Question found.', 
                'question': question['question'], 
                'test_index': test_manager.current_test_index
            })
    except Exception as e:
        return jsonify({'message': 'Error getting first question.', 'error': str(e)}), 400

@app.route('/confirm_transcription', methods=['POST'])
def confirm_transcription():
    
    
    global test_manager, recording_manager, audio_file_manager
    
    if recording_manager is None:
        return jsonify({'error': 'Recording manager not initialized'}), 400
    
    if audio_file_manager is None:
        return jsonify({'error': 'Audio file manager not initialized'}), 400
    
    data = request.get_json()
    test_status = data.get('test_status', False)
    time_up = data.get('time_up', False)

    print("Stopping the recording...")
    recording_manager.stop_recording()

    try:
        if time_up:
            print("Recording stopped. Transcription set to 'time up'.")
            test_manager.current_answer = "Time up."
        else:
            print("Recording stopped. Transcribing....")
            test_manager.current_answer = transcribe_audio(recording_manager.recording_file)
            print(f"Transcription result in test manager: {test_manager.current_answer}")

        if test_status:
            return jsonify({
                'transcription': test_manager.current_answer, 
                'status': 'test has ended', 
                'message': 'Answer recorded and processed by endTest function.'
            })
        
        if time_up:
            return jsonify({
                'transcription': test_manager.current_answer, 
                'status': 'time is up.', 
                'message': 'Answer recorded.'
            })
        else:
            return jsonify({
                'transcription': f"I got: {test_manager.current_answer}. Is this correct (Y/N)?", 
                'status': 'Answer transcribed', 
                'message': 'Transcription complete'
            })

    except Exception as e:
        return jsonify({
            'transcription': 'None', 
            'status': 'error', 
            'message': f'Transcription error: {str(e)}'
        }), 400

#### MAT ROUTES ####
@app.route('/api/mat-question-sets', methods=['GET'])
def get_mat_question_sets():
    """Get available Mental Arithmetic Task question sets"""
    question_sets = {
        'mat_practice': {
            'name': 'Practice Test (Subtract 5 from 20)',
            'description': 'Warmup task for participants',
            'difficulty': 'easy',
            'file': 'task_0_data.json'
        },
        'mat_1': {
            'name': 'Test 1 (Subtract 13 from 1,009)',
            'description': 'Standard difficulty arithmetic task',
            'difficulty': 'medium',
            'file': 'task_1_data.json'
        },
        'mat_2': {
            'name': 'Test 2 (Subtract 17 from 1,059)',
            'description': 'Higher difficulty arithmetic task',
            'difficulty': 'hard',
            'file': 'task_2_data.json'
        }
    }
    
    return jsonify({
        'success': True,
        'question_sets': question_sets
    })

@app.route('/process_answer', methods=['POST'])
def process_answer():
    global recording_manager, subject_manager, audio_file_manager, test_manager
    
    if test_manager is None:
        return jsonify({'error': 'Test manager not initialized'}), 400
   
    current_test = test_manager.current_test_index
    current_test_name = f"practice_stressor_test" if current_test == 0 else f"stressor_test_{current_test}"
    
    questions = test_manager.get_task_questions(current_test)
    data = request.get_json()
    test_ended = data.get('test_status', False)
    
    try:
        if test_manager.current_question_index >= len(questions):
            test_manager.current_question_index = 0
            return jsonify({
                'status': 'complete', 
                'message': 'Test complete. Please let the experimenter know that you have completed this section.', 
                'result': 'No more questions.'
            })

        if test_ended:
            recording_manager.stop_recording()
            print("Recording stopped. Transcribing....")
            time.sleep(0.1) 
            if audio_file_manager is not None:
                transcription = transcribe_audio(audio_file_manager.recording_file)
            else:
                transcription = transcribe_audio(recording_manager.recording_file)

            if current_test != 0:
                ts = recording_manager.timestamp
                uts = recording_manager.unix_timestamp
                end_time = recording_manager.end_timestamp_iso
                end_time_unix = recording_manager.end_timestamp_unix
                id = subject_manager.subject_id or "unknown"
                file_name = f"{id}_{ts}_{current_test_name}_question_{test_manager.current_question_index}.wav"

                print("Saving file...")
                if audio_file_manager is not None:
                    audio_file_manager.save_audio_file(file_name)

                print("Saving data...")

                subject_manager.append_data({
                    'unix_timestamp': uts,
                    'timestamp': ts, 
                    'time_stopped': end_time, 
                    'time_stopped_unix': end_time_unix,
                    'event_marker': current_test_name, 
                    'condition': 'None', 
                    'audio_file': file_name, 
                    'transcription': transcription
                })

                return jsonify({
                    'status': 'complete', 
                    'message': 'Test complete. Answer recorded and logged.', 
                    'result': 'None'
                })
            else:
                return jsonify({
                    'status': 'complete', 
                    'message': 'Practice Test complete.', 
                    'result': transcription
                })
        else:
            transcription = test_manager.current_answer

            if current_test != 0:
                ts = recording_manager.timestamp
                uts = recording_manager.unix_timestamp
                end_time = recording_manager.end_timestamp_iso
                end_time_unix = recording_manager.end_timestamp_unix
                id = subject_manager.subject_id or "unknown"
                file_name = f"{id}_{ts}_{current_test_name}_question_{test_manager.current_question_index}.wav"

                print("Saving file...")
                if audio_file_manager is not None:
                    audio_file_manager.save_audio_file(file_name)

                print("Saving data...")
                subject_manager.append_data({
                    'timestamp': ts, 
                    'unix_timestamp': uts,
                    'time_stopped': end_time, 
                    'time_stopped_unix': end_time_unix,
                    'event_marker': current_test_name, 
                    'condition': 'None', 
                    'audio_file': file_name,
                    'transcription': transcription
                })

            correct_answer = questions[test_manager.current_question_index]['answer']
            result = 'incorrect'

            if test_manager.check_answer(transcription, correct_answer):
                result = 'correct'
                test_manager.current_question_index += 1

                if test_manager.current_question_index >= len(questions):
                    test_manager.current_question_index = 0
                    return jsonify({
                        'status': 'complete', 
                        'message': 'Test complete. Please let the experimenter know that you have completed this section.', 
                        'result': result
                    })
                
            if result == 'incorrect':
                test_manager.current_question_index = 0
            
            print(f"Result: {result}")
            print("Starting the recording...")
            recording_manager.start_recording()

            return jsonify({
                'status': 'Answer successfully processed', 
                'message': 'Recording started...', 
                'result': result
            })

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
     
@app.route('/api/sessions/<session_id>/close', methods=['POST'])
def close_session(session_id):
    """Properly close SSE connection for a session"""
    try:
        if session_id in session_queues:
            session_queues[session_id].put(None)
            del session_queues[session_id]
            print(f"Closed SSE connection for session {session_id}")
        
        if session_id in session_completions:
            del session_completions[session_id]
            print(f"Cleaned up session data for {session_id}")
        
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error closing session {session_id}: {e}")
        return jsonify({'error': 'Failed to close session'}), 500

@app.route('/api/sessions/<session_id>/participant', methods=['POST'])
def save_participant_info(session_id):
    try:
        if session_id not in ACTIVE_SESSIONS:
            return jsonify({'error': 'Session not found'}), 404
        
        session_data = ACTIVE_SESSIONS[session_id]
        
        if not session_data.get('experiment_folder_name') or not session_data.get('trial_name'):
            return jsonify({'error': 'Experiment and trial names must be set first'}), 400
        
        data = request.json
        participant_info = data.get('participantInfo', {})
        
        email = participant_info.get('email', '').strip()
        if not email:
            return jsonify({'error': 'Email is required to create subject folder'}), 400
        
        subject_folder_name = email.replace('@', '_at_').replace('.', '_')
        subject_folder_name = "".join(c for c in subject_folder_name if c.isalnum() or c == '_').lower()
        
        date = datetime.now().isoformat()
        subject_folder_name = f"{date}_{subject_folder_name}"

        experiment_dir = os.path.join(EXPERIMENT_SUBJECT_DATA_DIR, session_data['experiment_folder_name'])
        trial_dir = os.path.join(experiment_dir, session_data['trial_name'])
        
        subject_dir = os.path.join(trial_dir, subject_folder_name)
        
        subject_manager.set_subject({
            'name': f"{participant_info.get('firstName', '')} {participant_info.get('lastName', '')}",
            'subject_id': email, # TODO: CHANGE THIS TO UNIQUE ID IF NECESSARY
            'email': participant_info.get('email', ''),
            'pid': participant_info.get('pid', ''),
            'sona_class': participant_info.get('sonaClass', ''),
            'subject_dir': subject_dir
        })

        experiment_name = session_data.get('experiment_folder_name')
        trial_name = session_data.get('trial_name')
        experimenter_name = session_data.get('experimenter_name', 'Unknown')
        
        event_manager.set_metadata(
            experiment_name=experiment_name,
            trial_name=trial_name,
            subject_id=email,
            experimenter_name=experimenter_name
        )
        event_manager.set_data_folder(subject_dir)
        event_manager.set_filenames()

        if vernier_manager is not None:
            vernier_manager.set_metadata(
                experiment_name=experiment_name,
                trial_name=trial_name,
                subject_id=email,
                experimenter_name=experimenter_name
            )
            vernier_manager.set_data_folder(subject_dir)
            vernier_manager.set_filenames()

        if polar_manager is not None:
            polar_manager.set_metadata(
                experiment_name=experiment_name,
                trial_name=trial_name,
                subject_id=email,
                experimenter_name=experimenter_name
            )
            polar_manager.set_data_folder(subject_dir)
            polar_manager.set_filenames()

        if audio_file_manager is not None:
            audio_file_manager.set_audio_folder(subject_dir)
        
        session_data['participant_info'] = {
            'first_name': participant_info.get('firstName', ''),
            'last_name': participant_info.get('lastName', ''),
            'email': participant_info.get('email', ''),
            'pid': participant_info.get('pid', ''),
            'sona_class': participant_info.get('sonaClass', ''),
            'form_completed_at': data.get('timestamp', datetime.now(timezone.utc).isoformat())
        }

        session_data['subject_folder'] = subject_folder_name
        session_data['subject_dir'] = subject_dir
        session_data['status'] = 'participant_registered'
        session_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        session_file = os.path.join(subject_dir, 'session.json')
        with open(session_file, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        print(f"Participant information saved for session {session_id}")
        
        participant_event = {
            'event_type': 'participant_registered',
            'session_id': session_id,
        }

        broadcast_to_session(session_id, participant_event)

        return jsonify({
            'success': True,
            'message': 'Participant information saved successfully',
            'subject_folder': subject_folder_name,
            'subject_dir': subject_dir
        })
        
    except Exception as e:
        print(f"Error saving participant info for session {session_id}: {e}")
        return jsonify({'error': f'Failed to save participant information: {str(e)}'}), 500

@app.route('/api/sessions/<session_id>/info', methods=['GET'])
def get_session_info(session_id):
    try:
        if session_id not in ACTIVE_SESSIONS:
            return jsonify({'error': 'Session not found'}), 404
        
        session_data = ACTIVE_SESSIONS[session_id]
        
        return jsonify({
            'success': True,
            'session_data': {
                'session_id': session_data['session_id'],
                'experiment_name': session_data['experiment_name'],
                'experiment_folder_name': session_data.get('experiment_folder_name'),
                'trial_name': session_data.get('trial_name'),
                'subject_folder': session_data.get('subject_folder'),
                'status': session_data['status'],
                'has_participant_info': session_data.get('participant_info') is not None
            }
        })
        
    except Exception as e:
        print(f"Error getting session info for {session_id}: {e}")
        return jsonify({'error': f'Failed to get session info: {str(e)}'}), 500

def instantiate_modules(template_path):
    print(f"=== INSTANTIATE_MODULES CALLED WITH: {template_path} ===")
    try:
        with open(template_path, 'r') as f:
            data = json.load(f) 
    except Exception as e:
        print(f"Error loading experiment template {template_path}: {e}")
        return

    try:
        if 'procedures' not in data or len(data['procedures']) == 0:
            print("No procedures found in the experiment template.")
            return
        
        needs_audio_ser = False
        needs_respiratory = False
        needs_polar = False
        needs_emotibit = False
        needs_mat = False

        print(f"Processing {len(data['procedures'])} procedures...")

        collection_methods = data.get('dataCollectionMethods', {})
        if collection_methods:
            print(f"\n--- Data Collection Methods Configuration ---")
            print(f"Polar HR: {collection_methods.get('polar_hr', False)}")
            print(f"Vernier Resp: {collection_methods.get('vernier_resp', False)}")
            print(f"EmotiBit: {collection_methods.get('emotibit', False)}")
            print(f"Audio/SER: {collection_methods.get('audio_ser', False)}")
            
            if collection_methods.get('polar_hr'):
                needs_polar = True
                print("✓ Polar HR enabled")
            
            if collection_methods.get('vernier_resp'):
                needs_respiratory = True
                print("✓ Vernier respiration enabled")
            
            if collection_methods.get('emotibit'):
                needs_emotibit = True
                print("✓ EmotiBit enabled")
            
            if collection_methods.get('audio_ser'):
                needs_audio_ser = True
                print("✓ Audio/SER enabled")
        
        for procedure in data.get('procedures', []):
            procedure_name = procedure.get('name', 'Unknown Procedure')
            config_data = procedure.get('configuration', {})
            
            if config_data.get('stressor-type', {}).get('stressorType') == "Mental Arithmetic Task":
                needs_mat = True
                print(f"✓ Mental Arithmetic Task detected in: {procedure_name}")

            if procedure.get('id') == 'vr-room-task':
                needs_audio_ser = True
                print(f"✓ VR Room Task detected in: {procedure_name}")
                
        # DEBUG STATEMENTS
        print(f"\n=== FINAL INSTANTIATION DECISIONS ===")
        print(f"needs_audio_ser: {needs_audio_ser}")
        print(f"needs_respiratory: {needs_respiratory}")
        print(f"needs_polar: {needs_polar}")
        print(f"needs_emotibit: {needs_emotibit}")
        print(f"needs_mat: {needs_mat}")

        global recording_manager, audio_file_manager, vernier_manager, polar_manager
        global test_manager, transcription_manager, ser_manager, lsl_manager
        
        # Initialize audio and SER components together
        if needs_audio_ser:
            print("\n=== Initializing Audio & SER Components ===")
            audio_file_manager = AudioFileManager('tmp/recording.wav', 'tmp')
            recording_manager = RecordingManager('tmp/recording.wav')
            transcription_manager = TranscriptionManager()
            ser_manager = SERManager()
            print("✓ Audio recording initialized")
            print("✓ Transcription manager initialized")
            print("✓ SER manager initialized")

        # Initialize respiratory/vernier if needed
        if needs_respiratory:
            print("\n=== Initializing Vernier Respiration ===")
            vernier_manager = VernierManager()
            print("✓ Vernier respiratory streaming initialized")

        # Initialize Polar HR if needed
        if needs_polar:
            print("\n=== Initializing Polar HR ===")
            polar_manager = PolarManager()
            print("✓ Polar HR manager initialized")

        # Initialize EmotiBit if needed (placeholder for future implementation)
        if needs_emotibit:
            print("\n=== EmotiBit Requested ===")
            lsl_manager = LSLManager()

        # Initialize test manager if MAT is needed
        if needs_mat:
            print("\n=== Initializing Mental Arithmetic Task ===")
            if test_manager is None:
                test_manager = TestManager()
                print("✓ Test manager initialized")

        print("\n=== INSTANTIATE_MODULES COMPLETE ===\n")

    except Exception as e:
        print(f"Error instantiating modules for procedures: {e}")
        import traceback
        traceback.print_exc()

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'json'}
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_json_file(filepath):
    """Validate that the uploaded file is valid JSON"""
    try:
        with open(filepath, 'r') as f:
            json.load(f)
        return True
    except json.JSONDecodeError:
        return False

@app.route('/api/upload-config', methods=['POST'])
def upload_config():
    from werkzeug.utils import secure_filename
    import uuid

    global TEST_FILES_DIR

    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        config_type = request.form.get('configType', 'unknown')
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'error': 'Invalid file type. Only JSON files are allowed'}), 400
        
        original_filename = secure_filename(file.filename)
        unique_id = str(uuid.uuid4())[:8]
        filename = f"{config_type}_{unique_id}_{original_filename}"
        filepath = os.path.join(TEST_FILES_DIR, filename)
        
        file.save(filepath)
        
        if not validate_json_file(filepath):
            os.remove(filepath)  
            return jsonify({'success': False, 'error': 'Invalid JSON format'}), 400
        
        print(f"Config file uploaded: {filename} for {config_type}")
        
        return jsonify({
            'success': True, 
            'message': 'File uploaded successfully',
            'filePath': filepath,
            'filename': filename
        })
        
    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({'success': False, 'error': f'Server error: {str(e)}'}), 500

@app.route('/api/sessions/<session_id>/complete-experiment', methods=['POST'])
def complete_experiment(session_id):
    """Complete an experiment and reset system for new experiment"""
    try:
        if session_id not in ACTIVE_SESSIONS:
            return jsonify({'error': 'Session not found'}), 404
        
        session_data = ACTIVE_SESSIONS[session_id]
        data = request.get_json() or {}
        
        completion_data = {
            'experiment_completed_at': data.get('timestamp', datetime.now(timezone.utc).isoformat()),
            'total_procedures': data.get('total_procedures', 0),
            'completed_procedures': data.get('completed_procedures', 0),
            'completion_status': 'completed_successfully'
        }
        
        session_data.update(completion_data)
        session_data['status'] = 'completed'
        
        if session_data.get('subject_dir') and os.path.exists(session_data['subject_dir']):
            session_file = os.path.join(session_data['subject_dir'], 'session_final.json')
            with open(session_file, 'w') as f:
                json.dump(session_data, f, indent=2)
        
        completion_event = {
            'event_type': 'experiment_completed',
            'session_id': session_id,
            'message': 'Experiment has been completed and system is resetting'
        }
        broadcast_to_session(session_id, completion_event)
        
        reset_experiment_managers()
        
        if session_id in session_queues:
            try:
                session_queues[session_id].put(None)
            except:
                pass
            del session_queues[session_id]
        
        if session_id in session_completions:
            del session_completions[session_id]
        
        del ACTIVE_SESSIONS[session_id]
        
        print(f"Experiment completed and system reset for session: {session_id}")
        
        return jsonify({
            'success': True,
            'message': 'Experiment completed successfully and system reset',
            'experiment_name': session_data.get('experiment_name'),
            'subject_folder': session_data.get('subject_folder')
        })
        
    except Exception as e:
        print(f"Error completing experiment {session_id}: {e}")
        return jsonify({'error': f'Failed to complete experiment: {str(e)}'}), 500

def reset_experiment_managers():
    global recording_manager, audio_file_manager, vernier_manager,test_manager, polar_manager
    global transcription_manager, ser_manager, form_manager, subject_manager, event_manager

    try:
        if event_manager and event_manager.is_streaming:
            event_manager.stop()
        
        if recording_manager and recording_manager.stream_is_active:
            recording_manager.stop_recording()
        
        if vernier_manager and hasattr(vernier_manager, 'stop'):
            vernier_manager.stop()

        if polar_manager and hasattr(polar_manager, 'stop'):
            polar_manager.stop()

        recording_manager = None
        audio_file_manager = None
        vernier_manager = None
        test_manager = None
        transcription_manager = None
        ser_manager = None
        form_manager = None
        subject_manager = None
        event_manager = None
        
        subject_manager = SubjectManager()
        event_manager = EventManager()
        form_manager = FormManager()

        print("All experiment managers reset successfully")
        
    except Exception as e:
        print(f"Error resetting managers: {e}")


### CLEANUP / HEARTBEAT MONTIORING ###
@app.route('/api/sessions/<session_id>/heartbeat', methods=['POST'])
def experimenter_heartbeat(session_id):
    """
    Experimenter window sends this every 5 seconds to indicate it's still open
    """
    with cleanup_lock:
        experimenter_heartbeats[session_id] = {
            'last_seen': time.time(),
            'missed_beats': 0  
        }
    return jsonify({'success': True})

@app.route('/api/sessions/<session_id>/cleanup-experimenter', methods=['POST'])
def cleanup_experimenter_session(session_id):
    """
    Clean up session when experimenter closes their window.
    Protected against double-cleanup.
    """
    with cleanup_lock:  # Prevent simultaneous cleanup
        if session_id not in ACTIVE_SESSIONS:
            return jsonify({
                'success': True, 
                'message': 'Session already cleaned up',
                'already_cleaned': True
            })
        
        session_data = ACTIVE_SESSIONS[session_id]
        if session_data.get('_cleanup_in_progress'):
            return jsonify({
                'success': True,
                'message': 'Cleanup already in progress',
                'already_cleaned': True
            })
        
        session_data['_cleanup_in_progress'] = True
    
    try:
        session_data = ACTIVE_SESSIONS.get(session_id)
        if not session_data:
            return jsonify({'success': True, 'message': 'Session not found'})
        
        global event_manager, vernier_manager, polar_manager, recording_manager
        
        if event_manager and event_manager.is_streaming:
            try:
                event_manager.stop()
                print(f"Stopped event manager for session {session_id}")
            except Exception as e:
                print(f"Error stopping event manager: {e}")
        
        if vernier_manager and hasattr(vernier_manager, '_running') and vernier_manager._running:
            try:
                vernier_manager.stop()
                print(f"Stopped vernier manager for session {session_id}")
            except Exception as e:
                print(f"Error stopping vernier manager: {e}")
        
        if polar_manager and hasattr(polar_manager, '_running') and polar_manager._running:
            try:
                polar_manager.stop()
                print(f"Stopped polar manager for session {session_id}")
            except Exception as e:
                print(f"Error stopping polar manager: {e}")
        
        if recording_manager and hasattr(recording_manager, 'stream_is_active') and recording_manager.stream_is_active:
            try:
                recording_manager.stop_recording()
                print(f"Stopped recording manager for session {session_id}")
            except Exception as e:
                print(f"Error stopping recording manager: {e}")
        
        # Save final session state
        if session_data.get('subject_dir') and os.path.exists(session_data['subject_dir']):
            try:
                session_file = os.path.join(session_data['subject_dir'], 'session_terminated.json')
                session_data['terminated_at'] = datetime.now(timezone.utc).isoformat()
                session_data['termination_reason'] = 'experimenter_window_closed'
                session_data.pop('_cleanup_in_progress', None)  
                with open(session_file, 'w') as f:
                    json.dump(session_data, f, indent=2)
                print(f"Saved session termination record")
            except Exception as e:
                print(f"Error saving session file: {e}")
        
        try:
            termination_event = {
                'event_type': 'session_terminated',
                'session_id': session_id,
                'reason': 'experimenter_closed'
            }
            broadcast_to_session(session_id, termination_event)
        except Exception as e:
            print(f"Error broadcasting termination: {e}")
    
        try:
            reset_experiment_managers()
            print(f"Reset experiment managers")
        except Exception as e:
            print(f"Error resetting managers: {e}")
        
        with cleanup_lock:
            if session_id in session_queues:
                try:
                    session_queues[session_id].put(None)
                except:
                    pass
                del session_queues[session_id]
            
            if session_id in session_completions:
                del session_completions[session_id]
            
            if session_id in experimenter_heartbeats:
                del experimenter_heartbeats[session_id]
            
            if session_id in ACTIVE_SESSIONS:
                del ACTIVE_SESSIONS[session_id]
        
        print(f"Session {session_id} fully cleaned up")
        
        return jsonify({
            'success': True,
            'message': 'Session cleaned up successfully'
        })
        
    except Exception as e:
        print(f"✗ Error cleaning up session {session_id}: {e}")
        import traceback
        traceback.print_exc()
        
        with cleanup_lock:
            if session_id in ACTIVE_SESSIONS:
                ACTIVE_SESSIONS[session_id].pop('_cleanup_in_progress', None)
        
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def check_stale_sessions():
    """
    Background thread to check for stale sessions where experimenter closed without cleanup.
    Uses grace period to avoid false positives.
    """
    while not SHUTDOWN_FLAG.is_set():
        try:
            current_time = time.time()
            stale_sessions = []
            
            with cleanup_lock:
                for session_id, heartbeat_data in list(experimenter_heartbeats.items()):
                    time_since_last = current_time - heartbeat_data['last_seen']
                    
                    if time_since_last > HEARTBEAT_TIMEOUT:
                        heartbeat_data['missed_beats'] += 1
                        
                        if heartbeat_data['missed_beats'] >= HEARTBEAT_GRACE_ATTEMPTS:
                            stale_sessions.append(session_id)
                            # print(f"Session {session_id} stale: {time_since_last:.1f}s since last heartbeat ({heartbeat_data['missed_beats']} missed)")
                    else:
                        heartbeat_data['missed_beats'] = 0
            
            for session_id in stale_sessions:
                print(f"Initiating cleanup for stale session: {session_id}")
                try:
                    with app.app_context():
                        cleanup_experimenter_session(session_id)
                except Exception as e:
                    print(f"Error cleaning up stale session {session_id}: {e}")
                
        except Exception as e:
            print(f"Error in stale session check: {e}")
            import traceback
            traceback.print_exc()
        
        SHUTDOWN_FLAG.wait(timeout=5) 

@app.route('/api/sessions/<session_id>/check-active', methods=['GET'])
def check_session_active(session_id):
    """
    Check if a session is still active (for subject reconnection)
    Thread-safe read
    """
    try:
        with cleanup_lock:
            is_active = session_id in ACTIVE_SESSIONS
        
        if is_active:
            return jsonify({
                'success': True,
                'active': True,
                'current_procedure': session_completions.get(session_id, {}).get('current_procedure', 0),
                'completed_procedures': session_completions.get(session_id, {}).get('completed_procedures', [])
            })
        else:
            return jsonify({
                'success': True,
                'active': False,
                'message': 'Session has been terminated'
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/shutdown', methods=['POST', 'OPTIONS'])
def shutdown_server():
    """
    Shutdown the Flask server gracefully.
    Only allows shutdown if no active experiment sessions exist.
    """
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        # Check for active sessions
        with cleanup_lock:
            active_count = len(ACTIVE_SESSIONS)
            if active_count > 0:
                print(f"Shutdown refused: {active_count} active session(s)")
                return jsonify({
                    'success': False,
                    'message': 'Cannot shutdown: Active experiment sessions exist',
                    'active_sessions': active_count,
                    'session_ids': list(ACTIVE_SESSIONS.keys())
                }), 400
        
        print("\n" + "="*50)
        print("SERVER SHUTDOWN REQUESTED")
        print("="*50)
        
        SHUTDOWN_FLAG.set()
 
        global event_manager, vernier_manager, polar_manager, recording_manager
        
        try:
            if event_manager and event_manager.is_streaming:
                event_manager.stop()
                print("Stopped event manager")
        except Exception as e:
            print(f"Error stopping event manager: {e}")
        
        try:
            if vernier_manager and hasattr(vernier_manager, '_running') and vernier_manager._running:
                vernier_manager.stop()
                print("Stopped vernier manager")
        except Exception as e:
            print(f"Error stopping vernier manager: {e}")
        
        try:
            if polar_manager and hasattr(polar_manager, '_running') and polar_manager._running:
                polar_manager.stop()
                print("Stopped polar manager")
        except Exception as e:
            print(f"Error stopping polar manager: {e}")
        
        try:
            if recording_manager and hasattr(recording_manager, 'stream_is_active') and recording_manager.stream_is_active:
                recording_manager.stop_recording()
                print("Stopped recording manager")
        except Exception as e:
            print(f"Error stopping recording manager: {e}")
        
        print("All managers stopped")
        print("Initiating server shutdown...")
        print("="*50 + "\n")
        
        def shutdown():
            try:
                print("Shutting down Flask server...")
                global heartbeat_monitor_thread
                if heartbeat_monitor_thread and heartbeat_monitor_thread.is_alive():
                    print("Waiting for heartbeat monitor to stop...")
                    heartbeat_monitor_thread.join(timeout=2.0)  # Wait up to 2 seconds
                    if heartbeat_monitor_thread.is_alive():
                        print("Warning: Heartbeat thread didn't stop in time")
                    else:
                        print("Heartbeat monitor stopped cleanly")
                
                time.sleep(0.5)
                os.kill(os.getpid(), signal.SIGTERM)
            except Exception as e:
                print(f"Shutdown error: {e}")
                os.kill(os.getpid(), signal.SIGTERM)
    
        shutdown_thread = threading.Thread(target=shutdown, daemon=True)
        shutdown_thread.start()
        
        return jsonify({
            'success': True,
            'message': 'Server shutdown initiated'
        }), 200
        
    except Exception as e:
        print(f"Error during shutdown: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
     
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react_app(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    heartbeat_monitor_thread = threading.Thread(
        target=check_stale_sessions, 
        daemon=True,
        name="HeartbeatMonitorThread"
    )
    heartbeat_monitor_thread.start()
    app.run(host='127.0.0.1', port=5001, debug=True, threaded=True)
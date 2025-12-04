-- Experiments/Sessions metadata table
CREATE TABLE IF NOT EXISTS experiments (
    id SERIAL PRIMARY KEY,
    experiment_name VARCHAR(255) NOT NULL,
    trial_name VARCHAR(255) NOT NULL,
    subject_id VARCHAR(255) NOT NULL,
    experimenter_name VARCHAR(255),
    pid VARCHAR(100),
    class_name VARCHAR(255),
    session_start_time TIMESTAMPTZ,
    session_end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(experiment_name, trial_name, subject_id)
);

-- SER data table 
CREATE TABLE IF NOT EXISTS ser_data (
    id BIGSERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES experiments(id) ON DELETE CASCADE,
    timestamp_unix DOUBLE PRECISION,
    timestamp_iso TIMESTAMPTZ,
    file_name VARCHAR(255),
    transcription TEXT,
    emotion_label_1 VARCHAR(50),
    confidence_1 REAL,
    emotion_label_2 VARCHAR(50),
    confidence_2 REAL,
    emotion_label_3 VARCHAR(50),
    confidence_3 REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- EmotiBit biometric data table (handles all metric types)
CREATE TABLE IF NOT EXISTS emotibit_data (
    id BIGSERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES experiments(id) ON DELETE CASCADE,
    local_timestamp DOUBLE PRECISION NOT NULL,
    emotibit_timestamp DOUBLE PRECISION NOT NULL,
    packet_number INTEGER,
    data_length INTEGER,
    type_tag VARCHAR(50) NOT NULL,
    protocol_version INTEGER,
    data_reliability INTEGER,
    metric_value REAL NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event markers table
CREATE TABLE IF NOT EXISTS event_markers (
    id BIGSERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES experiments(id) ON DELETE CASCADE,
    timestamp_unix DOUBLE PRECISION NOT NULL,
    timestamp_iso TIMESTAMPTZ NOT NULL,
    event_marker VARCHAR(255),
    condition VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Respiratory data table
CREATE TABLE IF NOT EXISTS respiratory_data (
    id BIGSERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES experiments(id) ON DELETE CASCADE,
    timestamp_unix DOUBLE PRECISION NOT NULL,
    timestamp_iso TIMESTAMPTZ NOT NULL,
    force REAL,
    respiration_rate REAL,
    event_marker VARCHAR(255),
    condition VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cardiac data table
CREATE TABLE IF NOT EXISTS cardiac_data (
    id BIGSERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES experiments(id) ON DELETE CASCADE,
    timestamp_unix DOUBLE PRECISION NOT NULL,
    timestamp_iso TIMESTAMPTZ NOT NULL,
    heart_rate REAL,
    hrv REAL,
    event_marker VARCHAR(255),
    condition VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audio/Transcription data table
CREATE TABLE IF NOT EXISTS audio_transcription_data (
    id BIGSERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES experiments(id) ON DELETE CASCADE,
    pid VARCHAR(100),
    class_name VARCHAR(255),
    timestamp_unix DOUBLE PRECISION NOT NULL,
    timestamp_iso TIMESTAMPTZ NOT NULL,
    time_stopped_iso TIMESTAMPTZ,
    time_stopped_unix DOUBLE PRECISION,
    event_marker VARCHAR(255),
    condition VARCHAR(255),
    audio_file VARCHAR(500),
    transcription TEXT,
    question_set VARCHAR(100),
    question_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_markers_timestamp ON event_markers(timestamp_unix);
CREATE INDEX IF NOT EXISTS idx_event_markers_experiment ON event_markers(experiment_id);

CREATE INDEX IF NOT EXISTS idx_respiratory_timestamp ON respiratory_data(timestamp_unix);
CREATE INDEX IF NOT EXISTS idx_respiratory_experiment ON respiratory_data(experiment_id);

CREATE INDEX IF NOT EXISTS idx_cardiac_timestamp ON cardiac_data(timestamp_unix);
CREATE INDEX IF NOT EXISTS idx_cardiac_experiment ON cardiac_data(experiment_id);

CREATE INDEX IF NOT EXISTS idx_audio_timestamp ON audio_transcription_data(timestamp_unix);
CREATE INDEX IF NOT EXISTS idx_audio_experiment ON audio_transcription_data(experiment_id);
CREATE INDEX IF NOT EXISTS idx_audio_question_set ON audio_transcription_data(question_set);

CREATE INDEX IF NOT EXISTS idx_emotibit_local_timestamp ON emotibit_data(local_timestamp);
CREATE INDEX IF NOT EXISTS idx_emotibit_experiment ON emotibit_data(experiment_id);
CREATE INDEX IF NOT EXISTS idx_emotibit_type_tag ON emotibit_data(type_tag);
CREATE INDEX IF NOT EXISTS idx_emotibit_composite ON emotibit_data(experiment_id, type_tag, local_timestamp);

CREATE INDEX IF NOT EXISTS idx_ser_experiment ON ser_data(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ser_timestamp ON ser_data(timestamp_unix);

-- Unified view for cross-data analysis
CREATE OR REPLACE VIEW unified_sensor_data AS
-- Audio/Transcription data
SELECT 
    e.experiment_name,
    e.trial_name,
    e.subject_id,
    e.experimenter_name,
    e.pid,
    e.class_name,
    atd.timestamp_unix,
    atd.timestamp_iso,
    atd.event_marker,
    atd.condition,
    NULL::REAL as force,
    NULL::REAL as respiration_rate,
    NULL::REAL as heart_rate,
    NULL::REAL as hrv,
    atd.audio_file,
    atd.transcription,
    atd.question_set,
    atd.question_index,
    'audio_transcription' as data_type
FROM audio_transcription_data atd
JOIN experiments e ON atd.experiment_id = e.id

UNION ALL

-- Event markers
SELECT 
    e.experiment_name,
    e.trial_name,
    e.subject_id,
    e.experimenter_name,
    e.pid,
    e.class_name,
    em.timestamp_unix,
    em.timestamp_iso,
    em.event_marker,
    em.condition,
    NULL::REAL as force,
    NULL::REAL as respiration_rate,
    NULL::REAL as heart_rate,
    NULL::REAL as hrv,
    NULL::VARCHAR as audio_file,
    NULL::TEXT as transcription,
    NULL::VARCHAR as question_set,
    NULL::INTEGER as question_index,
    'event' as data_type
FROM event_markers em
JOIN experiments e ON em.experiment_id = e.id

UNION ALL

-- Respiratory data
SELECT 
    e.experiment_name,
    e.trial_name,
    e.subject_id,
    e.experimenter_name,
    e.pid,
    e.class_name,
    rd.timestamp_unix,
    rd.timestamp_iso,
    rd.event_marker,
    rd.condition,
    rd.force,
    rd.respiration_rate,
    NULL::REAL as heart_rate,
    NULL::REAL as hrv,
    NULL::VARCHAR as audio_file,
    NULL::TEXT as transcription,
    NULL::VARCHAR as question_set,
    NULL::INTEGER as question_index,
    'respiratory' as data_type
FROM respiratory_data rd
JOIN experiments e ON rd.experiment_id = e.id

UNION ALL

-- Cardiac data
SELECT 
    e.experiment_name,
    e.trial_name,
    e.subject_id,
    e.experimenter_name,
    e.pid,
    e.class_name,
    cd.timestamp_unix,
    cd.timestamp_iso,
    cd.event_marker,
    cd.condition,
    NULL::REAL as force,
    NULL::REAL as respiration_rate,
    cd.heart_rate,
    cd.hrv,
    NULL::VARCHAR as audio_file,
    NULL::TEXT as transcription,
    NULL::VARCHAR as question_set,
    NULL::INTEGER as question_index,
    'cardiac' as data_type
FROM cardiac_data cd
JOIN experiments e ON cd.experiment_id = e.id

UNION ALL

-- EmotiBit data
SELECT 
    e.experiment_name,
    e.trial_name,
    e.subject_id,
    e.experimenter_name,
    e.pid,
    e.class_name,
    ed.local_timestamp as timestamp_unix,
    to_timestamp(ed.local_timestamp) as timestamp_iso,
    NULL::VARCHAR as event_marker,
    NULL::VARCHAR as condition,
    NULL::REAL as force,
    NULL::REAL as respiration_rate,
    NULL::REAL as heart_rate,
    NULL::REAL as hrv,
    NULL::VARCHAR as audio_file,
    NULL::TEXT as transcription,
    NULL::VARCHAR as question_set,
    NULL::INTEGER as question_index,
    ed.type_tag as data_type
FROM emotibit_data ed
JOIN experiments e ON ed.experiment_id = e.id

UNION ALL

-- SER data
SELECT 
    e.experiment_name,
    e.trial_name,
    e.subject_id,
    e.experimenter_name,
    e.pid,
    e.class_name,
    sd.timestamp_unix,
    sd.timestamp_iso,
    NULL::VARCHAR as event_marker,
    NULL::VARCHAR as condition,
    NULL::REAL as force,
    NULL::REAL as respiration_rate,
    NULL::REAL as heart_rate,
    NULL::REAL as hrv,
    sd.file_name as audio_file,
    sd.transcription,
    NULL::VARCHAR as question_set,
    NULL::INTEGER as question_index,
    'ser' as data_type
FROM ser_data sd
JOIN experiments e ON sd.experiment_id = e.id;
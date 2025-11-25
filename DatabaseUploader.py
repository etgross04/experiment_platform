# DatabaseUploader.py
import psycopg2
from psycopg2.extras import execute_batch
import pandas as pd
import os
from pathlib import Path
from typing import Tuple, Optional, List, Dict
from datetime import datetime
import glob

class DatabaseUploader:
    """
    Handles uploading CSV sensor data to PostgreSQL database.
    
    Responsibilities:
    - Parse CSV files from subject directories
    - Extract metadata from filenames and session info
    - Upload data to appropriate database tables
    - Manage database connections and transactions
    """
    
    def __init__(self, db_config: Dict[str, str]):
        """
        Initialize DatabaseUploader with database configuration.
        
        Args:
            db_config: Dictionary containing database connection parameters
                      {'host': ..., 'database': ..., 'user': ..., 'password': ...}
        """
        self.db_config = db_config
        self.conn = None
        self.cursor = None
        self._connect()
        
    def _connect(self):
        """Establish database connection."""
        try:
            self.conn = psycopg2.connect(
                host=self.db_config.get('host', 'localhost'),
                database=self.db_config['database'],
                user=self.db_config['user'],
                password=self.db_config['password'],
                port=self.db_config.get('port', 5432)
            )
            self.cursor = self.conn.cursor()
            print("✓ Database connection established")
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
            raise
    
    def close(self):
        """Close database connection."""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
        print("Database connection closed")
    
    def _upload_event_markers(self, csv_path: str, experiment_id: int) -> int:
        """Upload event marker CSV to database."""
        df = pd.read_csv(csv_path)
        
        # Map CSV columns to database columns
        records = [
            (
                experiment_id,
                row['timestamp_unix'],
                row['timestamp_iso'],
                row['event_marker'],
                row['condition']
            )
            for _, row in df.iterrows()
        ]
        
        query = """
        INSERT INTO event_markers (
            experiment_id, timestamp_unix, timestamp_iso, 
            event_marker, condition
        ) VALUES (%s, %s, %s, %s, %s);
        """
        
        execute_batch(self.cursor, query, records, page_size=1000)
        self.conn.commit()
        return len(records)
    
    def _upload_respiratory_data(self, csv_path: str, experiment_id: int) -> int:
        """Upload respiratory CSV to database."""
        df = pd.read_csv(csv_path)
        
        records = [
            (
                experiment_id,
                row['timestamp_unix'],
                row['timestamp'],  # Use 'timestamp' column for ISO format
                row.get('force'),
                row.get('RR'),  # Respiration Rate
                row['event_marker'],
                row['condition']
            )
            for _, row in df.iterrows()
        ]
        
        query = """
        INSERT INTO respiratory_data (
            experiment_id, timestamp_unix, timestamp_iso,
            force, respiration_rate, event_marker, condition
        ) VALUES (%s, %s, %s, %s, %s, %s, %s);
        """
        
        execute_batch(self.cursor, query, records, page_size=1000)
        self.conn.commit()
        return len(records)
    
    def _upload_cardiac_data(self, csv_path: str, experiment_id: int) -> int:
        """Upload cardiac CSV to database."""
        df = pd.read_csv(csv_path)
        
        records = [
            (
                experiment_id,
                row['timestamp_unix'],
                row['timestamp'],
                row.get('HR'),
                row.get('HRV'),
                row['event_marker'],
                row['condition']
            )
            for _, row in df.iterrows()
        ]
        
        query = """
        INSERT INTO cardiac_data (
            experiment_id, timestamp_unix, timestamp_iso,
            heart_rate, hrv, event_marker, condition
        ) VALUES (%s, %s, %s, %s, %s, %s, %s);
        """
        
        execute_batch(self.cursor, query, records, page_size=1000)
        self.conn.commit()
        return len(records)

    
    
    def _upload_audio_transcription_data(self, csv_path: str, experiment_id: int) -> int:
        """Upload audio/transcription CSV to database."""
        df = pd.read_csv(csv_path)
        
        records = [
            (
                experiment_id,
                row.get('pid'),
                row.get('class_name'),
                row['unix_timestamp'],
                row['timestamp'],
                row.get('time_stopped'),
                row.get('time_stopped_unix'),
                row['event_marker'],
                row['condition'],
                row.get('audio_file'),
                row.get('transcription'),
                row.get('question_set'),
                row.get('question_index')
            )
            for _, row in df.iterrows()
        ]
        
        query = """
        INSERT INTO audio_transcription_data (
            experiment_id, pid, class_name,
            timestamp_unix, timestamp_iso,
            time_stopped_iso, time_stopped_unix,
            event_marker, condition,
            audio_file, transcription,
            question_set, question_index
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """
        
        execute_batch(self.cursor, query, records, page_size=1000)
        self.conn.commit()
        return len(records)

    def _upload_ser_data(self, csv_path: str, experiment_id: int) -> int:
        """Upload SER (Speech Emotion Recognition) CSV to database."""
        df = pd.read_csv(csv_path)
        
        records = [
            (
                experiment_id,
                row['timestamp_unix'],
                row['timestamp_iso'],
                row['file_name'],
                row.get('transcription'),
                row['SER_Emotion_Label_1'],
                row['SER_Confidence_1'],
                row['SER_Emotion_Label_2'],
                row['SER_Confidence_2'],
                row['SER_Emotion_Label_3'],
                row['SER_Confidence_3']
            )
            for _, row in df.iterrows()
        ]
        
        query = """
        INSERT INTO ser_data (
            experiment_id, timestamp_unix, timestamp_iso,
            file_name, transcription,
            emotion_label_1, confidence_1,
            emotion_label_2, confidence_2,
            emotion_label_3, confidence_3
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """
        
        execute_batch(self.cursor, query, records, page_size=1000)
        self.conn.commit()
        return len(records)

    def _upload_emotibit_data(self, csv_path: str, experiment_id: int) -> int:
        """Upload EmotiBit CSV to database."""
        df = pd.read_csv(csv_path)
        
        filename = os.path.basename(csv_path)
        type_tag = filename.replace('.csv', '').split('_')[-1]
        metric_column = df.columns[-1]
        
        records = [
            (experiment_id, row['LocalTimestamp'], row['EmotiBitTimestamp'],
            row['PacketNumber'], row['DataLength'], type_tag,
            row['ProtocolVersion'], row['DataReliability'], row[metric_column])
            for _, row in df.iterrows()
        ]
        
        query = """
        INSERT INTO emotibit_data (experiment_id, local_timestamp, emotibit_timestamp,
            packet_number, data_length, type_tag, protocol_version, data_reliability, metric_value)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
        """
        
        execute_batch(self.cursor, query, records, page_size=1000)
        self.conn.commit()
        return len(records)

    def _get_or_create_experiment(self, metadata: Dict) -> int:
        """
        Get existing experiment_id or create new experiment record.
        Updated to include PID and class_name.
        
        Returns:
            experiment_id (int)
        """
        query = """
        INSERT INTO experiments (
            experiment_name, trial_name, subject_id, experimenter_name,
            pid, class_name
        ) VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (experiment_name, trial_name, subject_id) 
        DO UPDATE SET 
            experimenter_name = EXCLUDED.experimenter_name,
            pid = EXCLUDED.pid,
            class_name = EXCLUDED.class_name
        RETURNING id;
        """
        
        self.cursor.execute(query, (
            metadata['experiment_name'],
            metadata['trial_name'],
            metadata['subject_id'],
            metadata.get('experimenter_name', 'Unknown'),
            metadata.get('pid'),
            metadata.get('class_name')
        ))
        
        experiment_id = self.cursor.fetchone()[0]
        self.conn.commit()
        return experiment_id
    
    def upload_subject_directory(self, subject_dir: str, session_metadata: Dict) -> Dict:
        """Upload ALL CSV files from a subject's directory"""
        
        result = {
            'uploaded_count': 0,
            'failed_files': [],
            'file_details': []
        }
        
        try:
            # Get or create experiment record
            experiment_id = self._get_or_create_experiment(session_metadata)
            print(f"✓ Experiment ID: {experiment_id}")
            
            # ========== 1. ROOT-LEVEL CSV FILES ==========
            print("\Processing root-level CSV files...")
            for csv_file in glob.glob(os.path.join(subject_dir, '*.csv')):
                filename = os.path.basename(csv_file)
                
                try:
                    if '_event_markers.csv' in filename:
                        count = self._upload_event_markers(csv_file, experiment_id)
                        data_type = 'event_markers'
                    elif '_SER.csv' in filename:
                        count = self._upload_ser_data(csv_file, experiment_id)
                        data_type = 'ser_data'
                    else:
                        # Audio/transcription data
                        count = self._upload_audio_transcription_data(csv_file, experiment_id)
                        data_type = 'audio_transcription'
                    
                    result['uploaded_count'] += 1
                    result['file_details'].append({
                        'filename': filename,
                        'data_type': data_type,
                        'rows_uploaded': count
                    })
                    print(f"{filename} → {data_type} ({count} rows)")
                    
                except Exception as e:
                    print(f"  ✗ Failed: {filename}: {e}")
                    result['failed_files'].append({
                        'filename': filename,
                        'error': str(e)
                    })
            
            # ========== 2. EMOTIBIT DATA FOLDER ==========
            emotibit_dir = os.path.join(subject_dir, 'emotibit_data')
            if os.path.exists(emotibit_dir):
                print("\nProcessing emotibit_data folder...")
                for csv_file in glob.glob(os.path.join(emotibit_dir, '*.csv')):
                    filename = os.path.basename(csv_file)
                    
                    try:
                        count = self._upload_emotibit_data(csv_file, experiment_id)
                        metric_tag = filename.replace('.csv', '').split('_')[-1]
                        data_type = f'emotibit_{metric_tag}'
                        
                        result['uploaded_count'] += 1
                        result['file_details'].append({
                            'filename': filename,
                            'data_type': data_type,
                            'rows_uploaded': count
                        })
                        print(f"{filename} → {data_type} ({count} rows)")
                        
                    except Exception as e:
                        print(f"Failed: {filename}: {e}")
                        result['failed_files'].append({
                            'filename': filename,
                            'error': str(e)
                        })
            
            # ========== 3. CARDIAC DATA FOLDER ==========
            cardiac_dir = os.path.join(subject_dir, 'cardiac_data')
            if os.path.exists(cardiac_dir):
                print("\nProcessing cardiac_data folder...")
                for csv_file in glob.glob(os.path.join(cardiac_dir, '*.csv')):
                    filename = os.path.basename(csv_file)
                    
                    try:
                        count = self._upload_cardiac_data(csv_file, experiment_id)
                        data_type = 'cardiac_data'
                        
                        result['uploaded_count'] += 1
                        result['file_details'].append({
                            'filename': filename,
                            'data_type': data_type,
                            'rows_uploaded': count
                        })
                        print(f"{filename} → {data_type} ({count} rows)")
                        
                    except Exception as e:
                        print(f"Failed: {filename}: {e}")
                        result['failed_files'].append({
                            'filename': filename,
                            'error': str(e)
                        })
            
            # ========== 4. RESPIRATORY DATA FOLDER ==========
            respiratory_dir = os.path.join(subject_dir, 'respiratory_data')
            if os.path.exists(respiratory_dir):
                print("\nProcessing respiratory_data folder...")
                for csv_file in glob.glob(os.path.join(respiratory_dir, '*.csv')):
                    filename = os.path.basename(csv_file)
                    
                    try:
                        count = self._upload_respiratory_data(csv_file, experiment_id)
                        data_type = 'respiratory_data'
                        
                        result['uploaded_count'] += 1
                        result['file_details'].append({
                            'filename': filename,
                            'data_type': data_type,
                            'rows_uploaded': count
                        })
                        print(f"  ✓ {filename} → {data_type} ({count} rows)")
                        
                    except Exception as e:
                        print(f"Failed: {filename}: {e}")
                        result['failed_files'].append({
                            'filename': filename,
                            'error': str(e)
                        })
            
            print(f"\nUpload complete: {result['uploaded_count']} files uploaded")
            if result['failed_files']:
                print(f"{len(result['failed_files'])} files failed")
            
            return result
            
        except Exception as e:
            print(f"✗ Upload failed: {e}")
            self.conn.rollback()
            raise

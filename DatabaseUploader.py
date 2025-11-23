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
        """
        Upload all CSV files from a subject's directory.
        Updated to handle audio/transcription data.
        """
        result = {
            'uploaded_count': 0,
            'failed_files': [],
            'file_details': []
        }
        
        try:
            # Get or create experiment record
            experiment_id = self._get_or_create_experiment(session_metadata)
            print(f"✓ Experiment ID: {experiment_id}")
            
            # Find all CSV files recursively
            csv_files = glob.glob(os.path.join(subject_dir, '**', '*.csv'), recursive=True)
            
            if not csv_files:
                print(f"⚠ No CSV files found in {subject_dir}")
                return result
            
            print(f"Found {len(csv_files)} CSV file(s)")
            
            for csv_path in csv_files:
                filename = os.path.basename(csv_path)
                
                try:
                    # Determine file type from filename or detect by columns
                    if 'event_marker' in filename:
                        count = self._upload_event_markers(csv_path, experiment_id)
                        data_type = 'event_markers'
                    
                    elif 'respiratory' in filename:
                        count = self._upload_respiratory_data(csv_path, experiment_id)
                        data_type = 'respiratory_data'
                    
                    elif 'cardiac' in filename:
                        count = self._upload_cardiac_data(csv_path, experiment_id)
                        data_type = 'cardiac_data'
                    
                    elif 'SER' in filename:
                        # This is the processed SER file - could be separate table if needed
                        print(f"⚠ Skipping SER processed file: {filename}")
                        continue
                    
                    else:
                        # Try to detect by checking columns
                        df_sample = pd.read_csv(csv_path, nrows=1)
                        columns = set(df_sample.columns)
                        
                        # Check if it's audio/transcription data
                        if 'audio_file' in columns or 'transcription' in columns:
                            count = self._upload_audio_transcription_data(csv_path, experiment_id)
                            data_type = 'audio_transcription'
                        else:
                            print(f"⚠ Skipping unknown file type: {filename}")
                            continue
                    
                    result['uploaded_count'] += 1
                    result['file_details'].append({
                        'filename': filename,
                        'data_type': data_type,
                        'rows_uploaded': count
                    })
                    
                    print(f"✓ Uploaded {filename} ({count} rows)")
                
                except Exception as e:
                    print(f"✗ Failed to upload {filename}: {e}")
                    result['failed_files'].append({
                        'filename': filename,
                        'error': str(e)
                    })
            
            return result
        
        except Exception as e:
            print(f"✗ Upload failed: {e}")
            self.conn.rollback()
            raise
    
    def _determine_data_type(self, filename: str) -> Optional[str]:
        """
        Determine data type from filename patterns.
        
        Returns:
            'events', 'vernier', 'polar', 'audio', or None
        """
        filename_lower = filename.lower()
        
        if 'emotibit' in filename_lower or 'event' in filename_lower:
            return 'events'
        elif 'vernier' in filename_lower or 'respiratory' in filename_lower:
            return 'vernier'
        elif 'polar' in filename_lower or 'hr' in filename_lower:
            return 'polar'
        elif 'audio' in filename_lower or 'ser' in filename_lower:
            return 'audio'
        else:
            return None
import csv
import os
from datetime import datetime

class SubjectManager:
    """
    A comprehensive subject management system for experimental data organization and CSV file operations.
    
    The SubjectManager class provides functionality for managing subject information, organizing
    experimental data files, and handling CSV-based data storage during experimental sessions.
    It supports subject registration, data appending, and file structure management with metadata tracking.
    
    Key Features:
    - Subject information management with personal and experimental details
    - Automatic CSV file creation with structured metadata headers
    - Data appending with column filtering and validation
    - Hierarchical file organization by experiment, trial, and subject
    - Memory-only storage of sensitive personal information
    - Comprehensive data loading and reset capabilities
    
    Attributes:
        subject_id (str): Unique identifier for the current subject
        experiment_name (str): Name of the current experiment
        trial_name (str): Name of the current trial or session
        subject_folder (str): Directory path for subject-specific data files
        categories (list[str]): List of experimental categories or conditions
        csv_file_path (str): Path to the subject's main data CSV file
        PID (str): Participant ID for external systems (e.g., SONA)
        class_name (str): Associated class or course name
        subject_first_name (str): Subject's first name (memory-only)
        subject_last_name (str): Subject's last name (memory-only)
        subject_email (str): Subject's email address (memory-only)
    
    Usage:
        >>> manager = SubjectManager()
        >>> manager.experiment_name = "Speech_Study"
        >>> manager.trial_name = "Session_1"
        >>> manager.categories = ["condition_A", "condition_B"]
        >>> subject_info = {
        ...     "subject_id": "001",
        ...     "pid": "SONA_123",
        ...     "sona_class": "PSYC101",
        ...     "subject_dir": "/data/subjects/001"
        ... }
        >>> manager.set_subject(subject_info)
        >>> data = {"Timestamp": "2024-01-01T10:00:00", "Event_Marker": "stimulus_onset"}
        >>> manager.append_data(data)
    
    File Structure:
        Subject data is organized in the following hierarchy:
        subject_data/
        ├── <experiment_name>/
        │   └── <trial_name>/
        │       └── <subject_id>/
        │           ├── YYYY-MM-DD_experiment_trial_subject.csv
        │           ├── audio_files/
        │           └── other_data/
    
    CSV Format:
        The generated CSV files include:
        - Metadata Header (6 rows):
          * Experiment Name
          * Trial Name
          * Subject ID
          * Categories
          * PID
          * Class Name
        - Data Columns:
          * Unix_Timestamp: Unix timestamp
          * Timestamp: ISO 8601 timestamp
          * Time_Stopped: End time marker
          * Event_Marker: Experimental event label
          * Condition: Experimental condition
          * Audio_File: Associated audio file path
          * Transcription: Text transcription data
    
    Data Privacy:
        - Personal information (name, email) is stored only in memory
        - No personal data is written to persistent files
        - Subject ID serves as the only persistent identifier
        - Automatic cleanup on reset operations
    
    Error Handling:
        - Validation of experiment and trial names before subject creation
        - Graceful handling of missing CSV files
        - File existence checks before data operations
        - Comprehensive error messages for debugging
    
    Dependencies:
        - csv: CSV file reading and writing operations
        - os: File system operations and directory management
        - datetime: Timestamp generation for file naming
    
    Thread Safety:
        This class is not inherently thread-safe. External synchronization
        is required for concurrent access to file operations and data management.
    
    Note:
        - CSV files are created with UTF-8 encoding for international character support
        - Data appending filters out empty values and irrelevant columns
        - File paths use cross-platform compatible separators
        - Metadata is automatically included in all generated CSV files
    """
    def __init__(self) -> None:
        self._subject_id = None
        self.csv_file_path = None
        self.txt_file_path = None
        self.PID = None
        self.class_name = None
        self.headers = ['Unix_Timestamp', 'Timestamp', 'Time_Stopped', 'Event_Marker', 'Condition', 'Audio_File', 'Transcription']
        self._experiment_name = None
        self._trial_name = None
        self._subject_folder = None
        self._categories = None
        
        # Only held in RAM and not stored.
        self._subject_first_name = None 
        self._subject_last_name = None
        self._subject_email = None

    @property
    def subject_first_name(self) -> str:
        return self._subject_first_name
    
    @subject_first_name.setter
    def subject_first_name(self, value: str) -> None:
        self._subject_first_name = value

    @property
    def subject_last_name(self) -> str:
        return self._subject_last_name
    
    @subject_last_name.setter
    def subject_last_name(self, value: str) -> None:
        self._subject_last_name = value

    @property
    def subject_email(self) -> str:
        return self._subject_email
    
    @subject_email.setter
    def subject_email(self, value: str) -> None:
        self._subject_email = value

    @property
    def experiment_name(self) -> str:
        return self._experiment_name
    
    @experiment_name.setter
    def experiment_name(self, value: str) -> None:
        self._experiment_name = value

    @property
    def trial_name(self) -> str:
        return self._trial_name
    
    @trial_name.setter
    def trial_name(self, value: str) -> None:
        self._trial_name = value
    
    @property
    def categories(self) -> list[str]:
        return self._categories
    
    @categories.setter
    def categories(self, value: list[str]) -> None:
        self._categories = value

    @property
    def subject_folder(self) -> str:
        return self._subject_folder
    
    @subject_folder.setter
    def subject_folder(self, value: str) -> None:
        self._subject_folder = value
    
    @property
    def subject_id(self) -> str:
        return self._subject_id

    @subject_id.setter
    def subject_id(self, value: str) -> None:
        self._subject_id = value

    def set_subject(self, subject_info: dict) -> None:
        """
            Set the subject's name, ID, and email, PID (if any), class name (if any) and initialize the CSV file.
            Args:
                subject_info (dict): Dictionary containing the subject's name, ID, and email.
                Expected format: {"name": str, "subject_id": str, "email": str, "pid": str, "sona_class": str, "subject_dir":s tr} 
            Returns:
                None
        """
        
        if not self.experiment_name or not self.trial_name:
            raise ValueError("Experiment name and trial name must be set before setting the subject.")
        
        else:
            self.subject_id = subject_info["subject_id"]
            self.PID = subject_info["pid"]
            self.class_name = subject_info["sona_class"]
            self.subject_folder = subject_info.get("subject_dir")

            if not os.path.exists(self.subject_folder):
                os.makedirs(self.subject_folder)

            current_date = datetime.now().strftime("%Y-%m-%d")
            csv_filename = f"{current_date}_{self.experiment_name}_{self.trial_name}_{self.subject_id}.csv"
            self.csv_file_path = os.path.join(self.subject_folder, csv_filename)

            # DEBUG
            print("Subject folder set: ", self.subject_folder)
            print("Subject data csv set: ", self.csv_file_path)
            
            self.create_csv(self.csv_file_path)
    
    def create_csv(self, csv_file_path: str) -> None:
        if not os.path.exists(csv_file_path):
            with open(csv_file_path, mode='w', newline='', encoding='utf-8') as csv_file:
                writer = csv.writer(csv_file)
                writer.writerow([f"Experiment Name: {self.experiment_name}"])
                writer.writerow([f"Trial Name: {self.trial_name}"])
                writer.writerow([f"Subject ID: {self.subject_id}"])
                writer.writerow([f"Categories: {self.categories}"])
                writer.writerow([f"PID: {self.PID}"])
                writer.writerow([f"Class Name: {self.class_name}"])  
                writer.writerow(self.headers)  

    def append_data(self, data: dict) -> None:
        """
        Append data to the main CSV file, ignoring columns that are not relevant to the current data collection.
        Args:
            data (dict): Dictionary containing the data to be appended, where keys are column names and values are the corresponding data.
            Expected format: {'Timestamp': str, 'Event_Marker': str, 'Transcription': str, 'SER_Emotion': str, 'SER_Confidence': str}
        """
        metadata_rows = 6

        try:
            with open(self.csv_file_path, mode='r', newline='', encoding='utf-8') as csvfile:
                reader = csv.reader(csvfile)
                file_contents = list(reader)
                
                if len(file_contents) < metadata_rows + 1:
                    print("Metadata rows not found. Enter subject information first.")
                    return
                
        except FileNotFoundError:
            print("CSV file not found. Enter subject information first.")
            return

        filtered_data = {key: value for key, value in data.items() if key in self.headers and value != ""}
        row = [filtered_data.get(header, "") for header in self.headers]
        
        # DEBUG
        print(row)

        with open(self.csv_file_path, mode='a', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(row)

        print(f"Data has been successfully appended to {self.csv_file_path}.")

    def load_data(self) -> list[dict]:
        """Load and return all data from the CSV file."""
        if not self.csv_file_path:
            raise ValueError("Subject has not been set. Call 'set_subject' first.")
        
        with open(self.csv_file_path, mode='r', newline='', encoding='utf-8') as csv_file:
            reader = csv.DictReader(csv_file)
            return list(reader)

    def reset_subject(self) -> None:
        """Reset the subject details and clear the CSV file reference."""
        self.subject_id = None
        self.csv_file_path = None

    def reset(self):
        """Reset subject manager to initial state"""
        self.subject_id = None
        self.subject_folder = None
        self.experiment_name = None
        self.trial_name = None
        self.data = []
        self.csv_file_path = None
        self.PID = None
        self.class_name = None
        self._subject_first_name = None 
        self._subject_last_name = None
        self._subject_email = None
        self._categories = None
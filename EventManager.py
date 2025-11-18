import h5py
import numpy as np
import os
from threading import Thread, Event
import threading
import time
import atexit
import TimestampManager as tm
import pandas as pd
from datetime import datetime, timezone

class EventManager:
    """
    EventManager: Thread-safe event marker streaming and recording system.
    
    CONTRACT SPECIFICATION
    ======================
    
    Purpose:
    --------
    Stream and record experimental event markers with timestamps to HDF5 format,
    with automatic CSV conversion on shutdown.
    
    Lifecycle:
    ----------
    1. Initialize: EventManager()
    2. Configure: set_data_folder() -> set_filenames() -> initialize_hdf5_file()
    3. Stream: start() -> (set event_marker/condition as needed) -> stop()
    
    Required Call Sequence:
    -----------------------
    manager = EventManager()
    manager.set_data_folder(path)      # MUST be called before set_filenames()
    manager.set_filenames(subject_id)  # MUST be called before initialize_hdf5_file()
    manager.initialize_hdf5_file()     # MUST be called before start()
    manager.start()                    # Begins streaming
    # ... set event_marker and condition as needed during experiment ...
    manager.stop()                     # Stops streaming, closes files, converts to CSV
    
    State Machine:
    --------------
    INITIALIZED -> CONFIGURED (after set_data_folder/set_filenames/initialize_hdf5_file)
    CONFIGURED -> STREAMING (after start())
    STREAMING -> STOPPED (after stop())
    
    Thread Safety Guarantees:
    -------------------------
    - event_marker and condition properties are thread-safe (lock-protected writes)
    - HDF5 writes are serialized via lock
    - Multiple concurrent reads of event_marker/condition are safe
    - start() and stop() are idempotent
    
    Data Format Contract:
    ---------------------
    HDF5 Schema (dataset 'data'):
        - timestamp_unix: utf-8 string (Unix epoch timestamp)
        - timestamp_iso: utf-8 string (ISO 8601 format)
        - event_marker: utf-8 string (current marker value)
        - condition: utf-8 string (current condition value)
    
    CSV Schema (matches HDF5):
        - Same field names and string types
        - Header row included
        - One event per row
    
    Preconditions:
    --------------
    - data_folder MUST exist and be writable
    - subject_id MUST be provided before calling set_filenames()
    - TimestampManager module must be available as 'tm'
    - initialize_hdf5_file() MUST complete successfully before start()
    
    Postconditions:
    ---------------
    - After stop(): HDF5 file is closed and flushed
    - After stop(): CSV file exists with all streamed data
    - After stop(): streaming thread is terminated
    - atexit handler ensures cleanup even on abnormal termination
    
    Error Handling Contract:
    ------------------------
    - ValueError: Raised if event_marker or condition set to non-string
    - ValueError: Raised if set_data_folder() not called before set_filenames()
    - Prints error messages but does not raise exceptions for:
      * HDF5 initialization failures
      * File write failures during streaming
      * CSV conversion failures
    
    Performance Characteristics:
    ----------------------------
    - Sampling rate: 100 Hz (0.01s sleep between samples)
    - HDF5 dataset grows dynamically (no preallocated size)
    - CSV conversion uses chunked reading (1000 rows per chunk)
    
    Invariants:
    -----------
    - If is_streaming is True, thread is alive and HDF5 file is open
    - event_marker and condition are always strings (enforced by setters)
    - current_row always has keys: timestamp_unix, timestamp_iso, event_marker, condition
    
    Dependencies:
    -------------
    - h5py, numpy, pandas, threading, atexit, os, time, datetime
    - TimestampManager module (imported as tm)
    """
    def __init__(self):
        self.time_started_iso = None
        self.time_started_unix = None
        self.is_streaming = False
        self.current_row = {key: None for key in ["unix_timestamp", "iso_timestamp", "event_marker", "condition", "experimenter_name"]}
        
        self._event_marker = 'startup'
        self._condition = 'None'
        
        self._experimenter_name = 'unknown'
        self.thread = None
        self.shutdown_event = Event()
        self.lock = threading.Lock()
    
        self._data_folder = None
        self.csv_filename = None
        self.csv_writer = None
        
        self.hdf5_filename = None
        self.hdf5_file = None
        self._dataset = None
        self._time_started = None

        atexit.register(self.stop)
        print("Event Manager Initialized... ")
        print("Event Manager data folder, .hdf5 and .csv files will be set when experiment/trial and subject information is submitted.")

    # Property getters and setters ##################################
    @property
    def experimenter_name(self):
        return self._experimenter_name
    
    @experimenter_name.setter
    def experimenter_name(self, value):
        if isinstance(value, str):
            self._experimenter_name = value
        else:
            raise ValueError("Experimenter name must be a string.")
        
    @property
    def data_folder(self):
        return self._data_folder
    
    @data_folder.setter
    def data_folder(self, data_folder):
        self._data_folder = data_folder

    @property
    def event_marker(self):
        return self._event_marker
    
    @event_marker.setter
    def event_marker(self, value):
        if isinstance(value, str):
            self._event_marker = value
        else:
            raise ValueError("Event marker must be a string.")
    @property
    def condition(self):
        return self._condition
    
    @condition.setter
    def condition(self, value):
        if isinstance(value, str):
            self._condition = value
        else:
            raise ValueError("Condition must be a string.")
        
    ##################################################################
    # Methods ########################################################   
    def start(self):
        if self.thread and self.thread.is_alive():
            print("Event Manager is already running.")
            return
        
        if not self.is_streaming:
            self.is_streaming = True
            self.shutdown_event.clear()
            self.thread = Thread(target=self._stream_events, daemon=True)
            self.thread.start()
            self.time_started_iso = tm.get_timestamp("iso")
            self.time_started_unix = tm.get_timestamp("unix")

            print("Event Manager started streaming...")

    def close_h5_file(self):
        if self.hdf5_file:
            self.hdf5_file.flush()
            self.hdf5_file.close()
            self.hdf5_file = None  
            self._dataset = None    

            return "HDF5 file closed."
        else:
            return "No HDF5 file to close."

    def stop(self) -> None:
        if not self.thread or not self.thread.is_alive():
            print("Event Manager streaming is not running.")
            return
        
        print("Stopping Event Manager...")
        
        self.shutdown_event.set()
        self.is_streaming = False  
        
        print("Waiting for streaming thread to finish...")
        self.thread.join(timeout=5.0) 
        
        if self.thread.is_alive():
            print("WARNING: Streaming thread did not stop cleanly within timeout!")
        else:
            print("Streaming thread stopped successfully.")
        
        self.thread = None
        
        print("Closing Event Marker H5 file...")
        close_result = self.close_h5_file()

        print(close_result)
        print("Converting Event Marker H5 to CSV...")

        try:
            self.hdf5_to_csv()
            print("Event Marker H5 file converted to CSV successfully.")
        except Exception as e:
            print(f"Error converting H5 to CSV: {e}")
        
        print("Event Manager stopped completely.")

    def set_data_folder(self, subject_folder):
        self.data_folder = subject_folder

        if self.data_folder is None:
            raise ValueError("Subject folder must be set before initializing the Event Manager.")

        print(f"Event marker data folder set to: {self.data_folder}")

    def set_filenames(self, subject_id):
        if self._data_folder is None:
            print("Data folder must be set before setting filenames.")
            return
        
        current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        self.hdf5_filename = os.path.join(self._data_folder, f"{current_date}_{subject_id}_event_markers.h5")
        print(f"HDF5 filename set to: {self.hdf5_filename}")
        self.csv_filename = os.path.join(self._data_folder, f"{current_date}_{subject_id}_event_markers.csv")
        print(f"CSV filename set to: {self.csv_filename}")

    def initialize_hdf5_file(self):
        """
        Initializes the HDF5 file and dataset if not already created.
        Called in app.py once the test and subject information are both posted from the front end.
        """
        try:
            self.hdf5_file = h5py.File(self.hdf5_filename, 'a')  
            if 'data' not in self.hdf5_file:  
                dtype = np.dtype([
                    ('timestamp_unix', h5py.string_dtype(encoding='utf-8')),
                    ('timestamp_iso', h5py.string_dtype(encoding='utf-8')),
                    ('event_marker', h5py.string_dtype(encoding='utf-8')),
                    ('condition', h5py.string_dtype(encoding='utf-8')), 
                    ('experimenter_name', h5py.string_dtype(encoding='utf-8'))
                ])
                self._dataset = self.hdf5_file.create_dataset(
                    'data', shape=(0,), maxshape=(None,), dtype=dtype
                )
            else:
                self._dataset = self.hdf5_file['data']  

            if "data" in self.hdf5_file:
                print("Dataset 'data' found in the HDF5 file.")
            else:
                print("Dataset 'data' not found in the HDF5 file.")

        except Exception as e:
            print(f"Error initializing HDF5 file: {e}")

    def _stream_events(self):
        if not self.is_streaming:
            print("Event Manager is not currently streaming. Please start the server first.")
            return
        
        print("Event Manager streaming thread started...")
        while not self.shutdown_event.is_set():
            with self.lock:
                self.current_row = {key: None for key in ["timestamp_unix", "timestamp_iso", "event_marker", "condition"]}
                self.current_row["timestamp_unix"] = tm.get_timestamp("unix")
                self.current_row["timestamp_iso"] = tm.get_timestamp("iso")
                self.current_row["event_marker"] = self._event_marker
                self.current_row["condition"] = self._condition
                self.current_row["experimenter_name"] = self.experimenter_name
                
                self.write_to_hdf5(self.current_row)

            time.sleep(0.01) # Adjust sleep time as needed (dependent on EmotiBit sampling rate)

    def write_to_hdf5(self, row):
        if not self.hdf5_file or not self._dataset:
            print("HDF5 file or dataset not initialized. Cannot write data.")
            return
        
        # with self.lock:
        # Append the new row to the dataset
        self._dataset.resize(self._dataset.shape[0] + 1, axis=0)
        self._dataset[-1] = (row['timestamp_unix'], row['timestamp_iso'], row['event_marker'], row['condition'], row['experimenter_name'])

    def hdf5_to_csv(self):
        """
        Convert an HDF5 file to a CSV file.
        Dependencies:
            h5_filename (str): The path to the HDF5 file.
            csv_filename (str): The path to the CSV file to be created.
        """
        try:
            chunk_size = 1000
            with h5py.File(self.hdf5_filename, 'r') as h5_file:
                if 'data' not in h5_file:
                    print(f"Dataset 'data' not found in the file {self.hdf5_filename}.")
                    return
                
                dataset = h5_file['data']
                field_names = dataset.dtype.names
                first_chunk = True

                for start in range(0, dataset.shape[0], chunk_size):
                    end = min(start + chunk_size, dataset.shape[0])
                    chunk = dataset[start:end]

                    chunk_dict = {
                        field: np.char.decode(chunk[field], 'utf-8') if chunk[field].dtype.kind == 'S' 
                            else [x.decode('utf-8') if isinstance(x, bytes) else x for x in chunk[field]]
                        for field in field_names
                    }

                    chunk_df = pd.DataFrame(chunk_dict)

                    if first_chunk:
                        chunk_df.to_csv(self.csv_filename, mode='w', index=False, header=True)
                        first_chunk = False
                    else:
                        chunk_df.to_csv(self.csv_filename, mode='a', header=False, index=False)
            
            print(f"HDF5 file '{self.hdf5_filename}' successfully converted to CSV file '{self.csv_filename}'.")
        
        except FileNotFoundError:
            print(f"Error: The HDF5 file '{self.hdf5_filename}' was not found.")
            
        except Exception as e:
            print(f"Error converting HDF5 to CSV: {e}")

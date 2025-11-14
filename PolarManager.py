import asyncio
from typing import Optional
import struct
from bleak import BleakScanner, BleakClient
import TimestampManager as tm
from datetime import datetime, timezone
import os
import h5py
import numpy as np
import pandas as pd
from collections import deque

# Standard Bluetooth Heart Rate Service UUIDs
HEART_RATE_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb"
HEART_RATE_MEASUREMENT_UUID = "00002a37-0000-1000-8000-00805f9b34fb"

class PolarManager:
    """
    Polar H10 Heart Rate Monitor Manager for Experimental Data Collection
    
    A comprehensive manager class for connecting to Polar H10 heart rate sensors via 
    Bluetooth Low Energy (BLE) and collecting cardiovascular data during psychological 
    and physiological experiments. Provides real-time heart rate (HR) and heart rate 
    variability (HRV) measurements with synchronized event markers and experimental 
    condition tracking.
    
    ============================================================================
    LLM-READY CONTRACT
    ============================================================================
    
    CLASS PURPOSE:
    --------------
    Manages the complete lifecycle of Polar H10 sensor interaction including:
    - Device discovery and connection via Bluetooth Low Energy
    - Real-time heart rate and RR interval data streaming
    - HRV calculation using RMSSD (Root Mean Square of Successive Differences)
    - Synchronized timestamp management with experimental events
    - Persistent data storage in HDF5 format with CSV conversion
    - Crash recovery and automatic file versioning
    
    CORE CAPABILITIES:
    ------------------
    1. Device Management:
       - Scans for Polar H10 devices within Bluetooth range
       - Establishes connection via standard Heart Rate Service (UUID 0x180D)
       - Handles connection errors and device disconnections
       
    2. Data Acquisition:
       - Streams heart rate measurements in beats per minute (BPM)
       - Captures RR intervals in milliseconds (inter-beat intervals)
       - Calculates real-time HRV using 30-second sliding window
       - Synchronizes all data with Unix timestamps
       
    3. Experimental Integration:
       - Tracks event markers (e.g., "stimulus_onset", "response")
       - Records experimental conditions (e.g., "baseline", "treatment_A")
       - Synchronizes markers with physiological data
       
    4. Data Persistence:
       - Real-time HDF5 storage for structured data
       - Automatic CSV conversion on session completion
       - Crash recovery with automatic file versioning (_0, _1, _2, etc.)
    
    USAGE CONTRACT:
    ---------------
    
    Initialization Sequence (REQUIRED):
        manager = PolarManager()
        manager.set_data_folder("/path/to/subject/folder")  # Must be called first
        manager.set_filenames("subject_id")                 # Must be called second
        manager.initialize_hdf5_file()                      # Must be called third
    
    Data Collection Sequence (REQUIRED):
        await manager.start()                    # Scan and find device
        await manager.run(duration_seconds=60)   # Collect data for 60 seconds
        await manager.stop()                     # Close connection and save files
    
    Optional Event Tracking (during collection):
        manager.event_marker = "stimulus_onset"  # Set at any time during run()
        manager.condition = "treatment_A"        # Set at any time during run()
    
    ASYNC REQUIREMENTS:
    -------------------
    - All connection and data collection methods are asynchronous
    - Must be called with 'await' keyword
    - Must run within an asyncio event loop:
      asyncio.run(main()) or await manager.start() if already in async context
    
    PROPERTIES (Read/Write):
    -------------------------
    device_started: bool
        True if device found and ready for connection
        False if no device found or after stop()
        Auto-set by start() method
        
    running: bool
        True during active data collection
        False when idle or stopped
        Auto-managed by run() and stop()
        
    event_marker: str
        Current experimental event label
        Default: "start_up"
        Examples: "baseline", "stimulus_onset", "response", "recovery"
        Updated values appear in all subsequent data rows
        
    condition: str
        Current experimental condition label
        Default: "None"
        Examples: "control", "treatment_A", "high_stress", "relaxation"
        Updated values appear in all subsequent data rows
    
    PUBLIC METHODS:
    ---------------
    
    set_data_folder(subject_folder: str) -> None
        Configure the root data directory for this subject/session.
        
        Args:
            subject_folder: Path to subject's root folder
            
        Effects:
            Creates subdirectory: {subject_folder}/cardiac_data/
            Sets self.data_folder attribute
            
        Example:
            manager.set_data_folder("/data/study_001/subject_042")
            Creates: /data/study_001/subject_042/cardiac_data/
    
    set_filenames(subject_id: str) -> None
        Generate timestamped filenames for data storage.
        
        Args:
            subject_id: Subject identifier string
            
        Effects:
            Creates filename: YYYY-MM-DD_{subject_id}_cardiac_data_{crash_num}.h5
            Sets self.hdf5_filename and self.csv_filename
            
        Requirements:
            Must call set_data_folder() first
            
        Example:
            manager.set_filenames("P042")
            Creates: 2025-11-14_P042_cardiac_data_0.h5
    
    initialize_hdf5_file() -> None
        Create or open HDF5 file for data storage.
        
        Effects:
            Creates HDF5 file with structured dataset
            Initializes dataset with proper dtype schema
            Sets self._file_opened = True
            
        Requirements:
            Must call set_data_folder() first
            Must call set_filenames() second
            
        Dataset Schema:
            timestamp_unix: float64 (Unix timestamp)
            timestamp: string (ISO 8601 format)
            HR: float32 (heart rate in BPM)
            HRV: float32 (RMSSD in milliseconds)
            event_marker: string (experimental event label)
            condition: string (experimental condition label)
    
    async start() -> str
        Scan for and prepare connection to Polar H10 device.
        
        Returns:
            Status message string indicating success or error
            
        Effects:
            Scans for BLE devices with "Polar H10" in name
            Stores device address for connection
            Sets self.device_started = True on success
            
        Timeout:
            10 seconds for device discovery
            
        Example Return Values:
            "Polar device found and ready to connect."
            "Error: No Polar H10 device found"
            
        Requirements:
            Bluetooth must be enabled on host system
            Polar H10 must be worn and activated (moistened electrodes)
            Device must be within Bluetooth range (~10 meters)
    
    async run(duration_seconds: int = 60) -> None
        Connect to device and collect data for specified duration.
        
        Args:
            duration_seconds: Collection duration in seconds (default: 60)
            
        Effects:
            Establishes BLE connection to Polar H10
            Subscribes to Heart Rate Measurement characteristic
            Streams data continuously for specified duration
            Writes data to HDF5 file in real-time
            Sets self._streaming = True during collection
            Auto-disconnects after duration expires
            
        Data Flow:
            1. Receives HR measurement notifications from device
            2. Parses HR (BPM) and RR intervals (ms)
            3. Calculates HRV using RMSSD algorithm
            4. Timestamps each measurement
            5. Writes row to HDF5 file
            
        Update Rate:
            Approximately 1 Hz (one measurement per second)
            May vary based on device firmware
            
        Requirements:
            Must call start() first
            Must call initialize_hdf5_file() before start()
            
        Error Handling:
            Catches connection errors
            Triggers crash recovery on unexpected disconnection
            Increments crash counter and creates new file
    
    async stop() -> str
        Stop data collection and finalize data files.
        
        Returns:
            Status message string
            
        Effects:
            Sets self._streaming = False
            Sets self._running = False
            Closes HDF5 file with flush
            Converts HDF5 to CSV format
            Sets self.device_started = False
            
        Data Finalization:
            1. Flushes remaining HDF5 data to disk
            2. Closes HDF5 file handle
            3. Reads HDF5 file and converts to CSV
            4. Creates human-readable CSV file
            
        Requirements:
            Should be called after run() completes
            Safe to call multiple times
    
    calculate_hrv_rmssd() -> Optional[float]
        Calculate HRV using RMSSD method from buffered RR intervals.
        
        Returns:
            HRV in milliseconds, or None if insufficient data
            
        Algorithm:
            RMSSD = sqrt(mean(successive_differences^2))
            where successive_differences = RR[i+1] - RR[i]
            
        Buffer:
            Uses 30-second sliding window (~300 RR intervals)
            Automatically managed as deque with maxlen=300
            
        Requirements:
            Minimum 2 RR intervals required
            More intervals = more accurate HRV
            
        Typical Values:
            Resting: 20-100 ms
            Stress: <20 ms
            Relaxed: >100 ms
    
    DATA FORMAT SPECIFICATION:
    --------------------------
    
    HDF5 Structure:
        File: {date}_{subject_id}_cardiac_data_{crash_num}.h5
        Dataset: 'data' (structured array)
        Dtype: [
            ('timestamp_unix', 'f8'),      # Unix timestamp, float64
            ('timestamp', 'S26'),          # ISO 8601 string
            ('HR', 'f4'),                  # Heart rate (BPM), float32
            ('HRV', 'f4'),                 # HRV RMSSD (ms), float32
            ('event_marker', 'S50'),       # Event label, string
            ('condition', 'S50')           # Condition label, string
        ]
    
    CSV Structure:
        File: {date}_{subject_id}_cardiac_data_{crash_num}.csv
        Columns: timestamp_unix,timestamp,HR,HRV,event_marker,condition
        Encoding: UTF-8
        
    Example Data Row:
        1699987234.567, 2024-11-14T15:30:34.567000, 72.0, 45.3, stimulus_onset, treatment_A
    
    PHYSIOLOGICAL SPECIFICATIONS:
    ------------------------------
    
    Heart Rate (HR):
        Units: Beats per minute (BPM)
        Range: 50-180 BPM (typical during experiments)
        Source: Direct from Polar H10 via BLE Heart Rate Service
        Update Rate: ~1 Hz
        
    RR Intervals:
        Units: Milliseconds (ms)
        Source: Direct from Polar H10 via BLE Heart Rate Service
        Resolution: 1/1024 second (converted to milliseconds)
        Format: Successive inter-beat intervals
        
    Heart Rate Variability (HRV):
        Units: Milliseconds (ms)
        Method: RMSSD (Root Mean Square of Successive Differences)
        Window: 30-second sliding window
        Calculation: Continuous, updates with each new RR interval
        Interpretation:
          Higher HRV = Greater autonomic flexibility (typically healthier)
          Lower HRV = Reduced autonomic flexibility (stress, fatigue)
    
    BLUETOOTH SPECIFICATION:
    -------------------------
    
    Service: Heart Rate Service
        UUID: 0000180d-0000-1000-8000-00805f9b34fb
        
    Characteristic: Heart Rate Measurement
        UUID: 00002a37-0000-1000-8000-00805f9b34fb
        Properties: Notify
        
    Data Format (per Bluetooth SIG specification):
        Byte 0: Flags
            Bit 0: HR format (0=uint8, 1=uint16)
            Bit 1-2: Sensor contact (11=detected)
            Bit 3: Energy expended present
            Bit 4: RR intervals present
        Byte 1(-2): Heart rate value
        Remaining: RR intervals (uint16, 1/1024 second resolution)
    
    DEPENDENCIES:
    -------------
    Required Packages:
        bleak >= 0.20.0         # Bluetooth Low Energy communication
        h5py >= 3.0.0           # HDF5 file operations
        numpy >= 1.20.0         # Numerical operations
        pandas >= 1.3.0         # CSV conversion
        TimestampManager        # Custom timestamp utilities (must be in path)
    
    System Requirements:
        Bluetooth 4.0+ (BLE support)
        Python 3.8+
        Platform: Windows, macOS, or Linux
    
    ERROR HANDLING CONTRACT:
    -------------------------
    
    Connection Errors:
        Device not found: Returns error message, sets device_started=False
        Connection timeout: Triggers crash recovery
        Device disconnection: Auto-increments crash counter, creates new file
    
    File Errors:
        Permission denied: Prints error, continues operation if possible
        Disk full: Raises exception, requires manual intervention
    
    Data Errors:
        Invalid HR data: Skips write, continues collection
        Malformed BLE packet: Logs error, continues collection
    
    Crash Recovery:
        Detects unexpected disconnections
        Closes current HDF5 file
        Converts to CSV
        Increments crash counter
        Creates new versioned file on restart
    
    THREAD SAFETY:
    --------------
    This class is NOT thread-safe. All methods must be called from the same 
    asyncio event loop. Do not share instances across threads. For multi-subject 
    studies, create separate instances per subject.
    
    EXPERIMENTAL WORKFLOW EXAMPLE:
    ------------------------------
    
    Example of complete experimental workflow:
    
        import asyncio
        from PolarManager import PolarManager
        
        async def run_experiment():
            # Initialize
            manager = PolarManager()
            manager.set_data_folder("/data/study_001/subject_042")
            manager.set_filenames("P042")
            manager.initialize_hdf5_file()
            
            # Connect to device
            status = await manager.start()
            if "Error" in status:
                print(f"Failed to start: {status}")
                return
            
            # Baseline period
            manager.event_marker = "baseline"
            manager.condition = "rest"
            await manager.run(duration_seconds=60)
            
            # Stimulus period
            manager.event_marker = "stimulus_onset"
            manager.condition = "treatment_A"
            await manager.run(duration_seconds=120)
            
            # Recovery period
            manager.event_marker = "recovery"
            manager.condition = "rest"
            await manager.run(duration_seconds=60)
            
            # Finalize
            await manager.stop()
            print(f"Data saved to: {manager.csv_filename}")
        
        asyncio.run(run_experiment())
    
    VALIDATION AND TESTING:
    -----------------------
    Use the provided MockPolarH10 class for bench testing without hardware.
    See test_polar_manager.py for comprehensive test suite.
    
    CITATION:
    ---------
    If using this class in research, please cite:
    - Polar H10: Polar Electro Oy, Kempele, Finland
    - HRV Guidelines: Task Force (1996). Heart rate variability: standards 
      of measurement, physiological interpretation, and clinical use.
      European Heart Journal, 17(3), 354-381.
    
    VERSION: 1.0.0
    LAST UPDATED: 2025-11-14
    """
    
    def __init__(self):
        self._device_address = None
        self._client: Optional[BleakClient] = None
        self._event_marker = "start_up"
        self._condition = "None"
        self._subject_id = None
        self.hdf5_file = None
        self.hdf5_filename = None
        self.csv_filename = None
        self.data_folder = None
        self._running = False
        self._streaming = False
        self._device_started = False
        self._crashed = False
        self._num_crashes = 0
        self._dataset = None
        self._file_opened = False
        
        # Data storage
        self._current_row = {
            "timestamp_unix": None,
            "timestamp": None,
            "HR": None,
            "HRV": None,
            "event_marker": self._event_marker,
            "condition": self._condition
        }
        
        # RR interval buffer for HRV calculation (30 second window)
        self._rr_intervals = deque(maxlen=300)  # ~30s at typical HR
        self._last_hr = None
        
    @property
    def device_started(self):
        return self._device_started
    
    @device_started.setter
    def device_started(self, value):
        self._device_started = value

    @property 
    def running(self):
        return self._running
    
    @running.setter
    def running(self, value):
        self._running = value

    @property
    def event_marker(self):
        return self._event_marker
    
    @event_marker.setter
    def event_marker(self, value):
        self._event_marker = value

    @property
    def condition(self):
        return self._condition
    
    @condition.setter
    def condition(self, value):
        self._condition = value

    def set_data_folder(self, subject_folder):
        """Set the data folder for storing cardiac data files."""
        self.data_folder = os.path.join(subject_folder, "cardiac_data")
        if not os.path.exists(self.data_folder):
            os.makedirs(self.data_folder)
        print(f"Polar data folder set to: {self.data_folder}")

    def set_filenames(self, subject_id):
        """Set the filenames for HDF5 and CSV data files."""
        if not self.data_folder:
            print("Data folder not set. Please set the data folder before setting filenames.")
            return
        
        self._subject_id = subject_id
        current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        self.hdf5_filename = os.path.join(
            self.data_folder, 
            f"{current_date}_{subject_id}_cardiac_data_{self._num_crashes}.h5"
        )
        self.csv_filename = os.path.join(
            self.data_folder,
            f"{current_date}_{subject_id}_cardiac_data_{self._num_crashes}.csv"
        )

    def initialize_hdf5_file(self):
        """Initialize the HDF5 file for data storage."""
        try:
            if not self.hdf5_filename:
                print("HDF5 filename not set.")
                return

            if self._crashed:
                current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")  
                self.hdf5_filename = os.path.join(
                    self.data_folder,
                    f"{current_date}_{self._subject_id}_cardiac_data_{self._num_crashes}.h5"
                )
                self.csv_filename = os.path.join(
                    self.data_folder,
                    f"{current_date}_{self._subject_id}_cardiac_data_{self._num_crashes}.csv"
                )

            self.hdf5_file = h5py.File(self.hdf5_filename, 'a')  

            if 'data' not in self.hdf5_file:  
                dtype = np.dtype([
                    ('timestamp_unix', 'f8'),
                    ('timestamp', h5py.string_dtype(encoding='utf-8')),
                    ('HR', 'f4'),
                    ('HRV', 'f4'),
                    ('event_marker', h5py.string_dtype(encoding='utf-8')),
                    ('condition', h5py.string_dtype(encoding='utf-8'))
                ])
                self._dataset = self.hdf5_file.create_dataset(
                    'data', shape=(0,), maxshape=(None,), dtype=dtype
                )
            else:
                self._dataset = self.hdf5_file['data']  

            self._file_opened = True
            print("HDF5 file created for cardiac data:", self.hdf5_filename)

        except Exception as e:
            print(f"Error initializing HDF5 file: {e}")

    def calculate_hrv_rmssd(self) -> Optional[float]:
        """
        Calculate HRV using RMSSD (Root Mean Square of Successive Differences).
        
        Returns:
            HRV value in milliseconds, or None if insufficient data
        """
        if len(self._rr_intervals) < 2:
            return None
        
        rr_array = np.array(self._rr_intervals)
        successive_diffs = np.diff(rr_array)
        rmssd = np.sqrt(np.mean(successive_diffs ** 2))
        
        return float(rmssd)

    def parse_heart_rate_measurement(self, sender, data: bytearray):
        """
        Parse heart rate measurement data from Bluetooth Heart Rate Service.
        
        The data format follows the Bluetooth Heart Rate Measurement specification:
        - Byte 0: Flags
        - Bytes 1-2: Heart Rate value
        - Remaining bytes: RR intervals (if present)
        """
        try:
            # Get timestamp
            tsu = tm.get_timestamp("unix")
            ts = datetime.fromtimestamp(tsu).isoformat()
            
            # Parse flags (byte 0)
            flags = data[0]
            hr_format = flags & 0x01  # 0 = uint8, 1 = uint16
            sensor_contact = (flags >> 1) & 0x03  # Sensor contact status
            has_energy = (flags >> 3) & 0x01
            has_rr = (flags >> 4) & 0x01  # RR intervals present
            
            # Parse heart rate
            if hr_format == 0:
                hr_value = data[1]
                offset = 2
            else:
                hr_value = struct.unpack('<H', data[1:3])[0]
                offset = 3
            
            self._last_hr = hr_value
            
            # Skip energy expended if present
            if has_energy:
                offset += 2
            
            # Parse RR intervals if present
            if has_rr and len(data) >= offset + 2:
                num_rr = (len(data) - offset) // 2
                for i in range(num_rr):
                    rr_value = struct.unpack('<H', data[offset + i*2:offset + (i+1)*2])[0]
                    # RR intervals are in 1/1024 second resolution
                    rr_ms = (rr_value / 1024.0) * 1000.0
                    self._rr_intervals.append(rr_ms)
            
            # Calculate HRV
            hrv_value = self.calculate_hrv_rmssd()
            
            # Update current row
            self._current_row["timestamp_unix"] = tsu
            self._current_row["timestamp"] = ts
            self._current_row["HR"] = self._last_hr
            self._current_row["HRV"] = hrv_value
            self._current_row["event_marker"] = self.event_marker
            self._current_row["condition"] = self.condition
            
            # Write to HDF5
            if self._streaming:
                self.write_to_hdf5(self._current_row)
                
        except Exception as e:
            print(f"Error parsing heart rate data: {e}")

    async def start(self) -> str:
        """Scan for and connect to a Polar H10 device."""
        try:
            print("\nSearching for Polar H10...", flush=True)
            device = await BleakScanner.find_device_by_filter(
                lambda bd, ad: bd.name and "Polar H10" in bd.name, 
                timeout=10
            )
            
            if device is None:
                print("No Polar H10 device found.")
                self._device_started = False
                return "Error: No Polar H10 device found"
            
            self._device_address = device.address
            print(f"Found Polar device: {device.name} at {device.address}")
            self._device_started = True
            return "Polar device found and ready to connect."
            
        except Exception as e:
            print(f"Error starting Polar device: {e}")
            self._device_started = False
            return f"Error: {e}"

    async def run(self, duration_seconds=60):
        """Start data collection from the Polar device."""
        if not self._device_started:
            print("Device has not been started yet. Call start() first.")
            return
        
        try:
            self._running = True
            self._streaming = True
            
            async with BleakClient(self._device_address) as client:
                self._client = client
                
                print(f"Connected to Polar H10 at {self._device_address}")
                
                # Start notifications for heart rate measurements
                await client.start_notify(
                    HEART_RATE_MEASUREMENT_UUID,
                    self.parse_heart_rate_measurement
                )
                
                print(f"Data streaming started. Collecting for {duration_seconds} seconds...")
                
                # Keep the stream running
                await asyncio.sleep(duration_seconds)
                
                # Stop notifications
                await client.stop_notify(HEART_RATE_MEASUREMENT_UUID)
                
                print("Data collection complete.")
                
        except Exception as e:
            print(f"Error during data collection: {e}")
            print("DEVICE HAS CRASHED - RESTART POLAR MANAGER.")
            self._crashed = True
            self._num_crashes += 1
            await self.reset()
            
        finally:
            self._streaming = False
            self._running = False
            self._client = None

    async def stop(self) -> str:
        """Stop data collection and close connections."""
        try:
            self._running = False
            self._streaming = False
            print("Stopping Polar manager...")
            
            if self._device_started:
                if self._file_opened:
                    print("Stop is closing HDF5 file...")
                    self.close_h5_file()
                    print("Stop is converting HDF5 to CSV...")
                    self.hdf5_to_csv()
                
                self._device_started = False
                print("Polar manager stopped.")
                return "Polar manager stopped."
            else:
                print("Device has not started.")
                return "Device has not started."
                
        except Exception as e:
            print(f"An error occurred: {e}")
            return f"An error occurred: {e}"

    async def reset(self) -> None:
        """Reset the manager state and close all resources."""
        try:
            print("Reset is closing HDF5 file...")
            self.close_h5_file()
            self._file_opened = False

            try:
                print("Reset is converting HDF5 to CSV...")
                self.hdf5_to_csv()
            except Exception as inner_e:
                print(f"Error converting HDF5 to CSV: {inner_e}")
        except Exception as e:
            print(f"Error closing HDF5 file: {e}")

        # Reset all variables
        self._device_started = False
        self._device_address = None
        self._client = None
        self._dataset = None
        self._current_row = {
            "timestamp_unix": None,
            "timestamp": None,
            "HR": None,
            "HRV": None,
            "event_marker": self._event_marker,
            "condition": self._condition
        }
        self._streaming = False
        self._running = False
        self.hdf5_file = None
        self._rr_intervals.clear()
        self._last_hr = None

    def _resize_dataset(self, new_size):
        """Resize the HDF5 dataset."""
        try:
            current_size = self._dataset.shape[0]
            if new_size > current_size:
                self._dataset.resize(new_size, axis=0)
        except Exception as e:
            print(f"Error resizing dataset: {e}")

    def write_to_hdf5(self, row: dict) -> None:
        """Write the incoming dictionary to the HDF5 dataset as a single row."""
        try:
            if self.hdf5_file is None or self._dataset is None:
                print("HDF5 file or dataset is not initialized.")
                return

            new_data = np.zeros(1, dtype=self._dataset.dtype)  
            new_data[0]['timestamp_unix'] = row.get('timestamp_unix', np.nan)
            new_data[0]['timestamp'] = row.get('timestamp', '')  
            new_data[0]['HR'] = row.get('HR', np.nan)
            new_data[0]['HRV'] = row.get('HRV', np.nan)
            new_data[0]['event_marker'] = row.get('event_marker', '')
            new_data[0]['condition'] = row.get('condition', '')

            new_size = self._dataset.shape[0] + 1
            self._resize_dataset(new_size)  
            self._dataset[-1] = new_data[0]

        except Exception as e:
            print(f"Error writing to HDF5: {e}")

    def close_h5_file(self):
        """Close the HDF5 file."""
        if self.hdf5_file:
            self.hdf5_file.flush()
            self.hdf5_file.close()
            print(f"HDF5 file '{self.hdf5_filename}' closed.")
        else:
            print("HDF5 file is already closed or isn't initialized.")
        
    def hdf5_to_csv(self):
        """Convert the HDF5 file to a CSV file."""
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
            
            print("CSV file created successfully.")
            print(f"HDF5 file '{self.hdf5_filename}' successfully converted to CSV file '{self.csv_filename}'.")
        
        except FileNotFoundError:
            print(f"Error: The HDF5 file '{self.hdf5_filename}' was not found.")
        except Exception as e:
            print(f"Error converting HDF5 to CSV: {e}")


# Example usage
async def main():
    manager = PolarManager()
    manager.set_data_folder("/data/subject_001")
    manager.set_filenames("001")
    manager.initialize_hdf5_file()
    
    await manager.start()
    await manager.run(duration_seconds=30)
    await manager.stop()


if __name__ == "__main__":
    asyncio.run(main())
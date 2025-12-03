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
import asyncio
from threading import Thread
import time

# Standard Bluetooth Heart Rate Service UUIDs
HEART_RATE_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb"
HEART_RATE_MEASUREMENT_UUID = "00002a37-0000-1000-8000-00805f9b34fb"

class PolarManager:
    def __init__(self):
        self._device_address = None
        self._client: Optional[BleakClient] = None
        self._event_marker = "start_up"
        self._experimenter_name = "unknown"
        self._condition = "None"
        self._subject_id = None
        self._experiment_name = None
        self._trial_name = None
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
        self.thread = None
        self._event_loop = None
        
        # Data storage
        self._current_row = {
            "experiment_name": None,
            "trial_name": None,
            "subject_id": None,
            "experimenter_name": None,
            "timestamp_unix": None,
            "timestamp": None,
            "HR": None,
            "HRV": None,
            "event_marker": self._event_marker,
            "condition": self._condition
        }
        
        # RR interval buffer for HRV calculation (30 second window)
        self._rr_intervals = deque(maxlen=300)
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

    def set_metadata(self, experiment_name: str, trial_name: str, 
                 subject_id: str, experimenter_name: str = 'Unknown'):
        """Set all metadata at once - ensures atomic, consistent state."""
        if not all([experiment_name, trial_name, subject_id]):
            raise ValueError("experiment_name, trial_name, and subject_id are required")
        
        self._experiment_name = experiment_name
        self._trial_name = trial_name
        self._subject_id = subject_id
        self._experimenter_name = experimenter_name
        
        print(f"Metadata set: {experiment_name}/{trial_name}/{subject_id}")

    def set_data_folder(self, subject_folder):
        """Set the data folder for storing cardiac data files."""
        self.data_folder = os.path.join(subject_folder, "cardiac_data")
        if not os.path.exists(self.data_folder):
            os.makedirs(self.data_folder)
        print(f"Polar data folder set to: {self.data_folder}")

    def set_filenames(self):
        """Set the filenames for HDF5 and CSV data files."""
        if not self.data_folder:
            raise ValueError("Data folder not set. Call set_data_folder() first.")
        
        if not self._subject_id:
            raise ValueError("Subject ID not set. Call set_metadata() first.")
        
        current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        self.hdf5_filename = os.path.join(
            self.data_folder, 
            f"{current_date}_{self._subject_id}_cardiac_data_{self._num_crashes}.h5"
        )
        self.csv_filename = os.path.join(
            self.data_folder,
            f"{current_date}_{self._subject_id}_cardiac_data_{self._num_crashes}.csv"
        )
        print(f"✓ Polar HDF5 filename set to: {self.hdf5_filename}")
        print(f"✓ Polar CSV filename set to: {self.csv_filename}")

    def initialize_hdf5_file(self):
        """Initialize the HDF5 file for data storage."""
        if not self.hdf5_filename:
            raise ValueError("HDF5 filename not set. Call set_filenames() first.")
        
        if not self._subject_id:
            raise ValueError("Subject ID not set. Call set_metadata() first.")
        
        if not self.data_folder:
            raise ValueError("Data folder not set. Call set_data_folder() first.")
        
        os.makedirs(os.path.dirname(self.hdf5_filename), exist_ok=True)
        
        try:
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

            print(f"Initializing Polar HDF5 file at: {self.hdf5_filename}")
            self.hdf5_file = h5py.File(self.hdf5_filename, 'a')  

            if 'data' not in self.hdf5_file:  
                dtype = np.dtype([
                    ('experiment_name', h5py.string_dtype(encoding='utf-8')),
                    ('trial_name', h5py.string_dtype(encoding='utf-8')),
                    ('subject_id', h5py.string_dtype(encoding='utf-8')),
                    ('experimenter_name', h5py.string_dtype(encoding='utf-8')),
                    ('timestamp_unix', 'f8'),
                    ('timestamp', h5py.string_dtype(encoding='utf-8')),
                    ('HR', 'f4'),
                    ('HRV', 'f4'),
                    ('event_marker', h5py.string_dtype(encoding='utf-8')),
                    ('condition', h5py.string_dtype(encoding='utf-8')),
                ])
                self._dataset = self.hdf5_file.create_dataset(
                    'data', shape=(0,), maxshape=(None,), dtype=dtype
                )
                print("✓ Created Polar HDF5 dataset")
            else:
                self._dataset = self.hdf5_file['data']
                print("✓ Using existing Polar HDF5 dataset")

            self._file_opened = True
            print(f"✓ Polar HDF5 file initialized: {self.hdf5_filename}")

        except Exception as e:
            error_msg = f"Error initializing Polar HDF5 file: {e}"
            print(f"✗ {error_msg}")
            raise RuntimeError(error_msg) from e
        
    def calculate_hrv_rmssd(self) -> Optional[float]:
        """Calculate HRV using RMSSD."""
        if len(self._rr_intervals) < 2:
            return None
        
        rr_array = np.array(self._rr_intervals)
        successive_diffs = np.diff(rr_array)
        rmssd = np.sqrt(np.mean(successive_diffs ** 2))
        
        return float(rmssd)

    def parse_heart_rate_measurement(self, sender, data: bytearray):
        """Parse heart rate measurement data from Bluetooth."""
        try:
            tsu = tm.get_timestamp("unix")
            # FIX: Convert string timestamp to float
            if isinstance(tsu, str):
                tsu = float(tsu)
            ts = datetime.fromtimestamp(tsu).isoformat()
            
            flags = data[0]
            hr_format = flags & 0x01
            has_energy = (flags >> 3) & 0x01
            has_rr = (flags >> 4) & 0x01
            
            if hr_format == 0:
                hr_value = data[1]
                offset = 2
            else:
                hr_value = struct.unpack('<H', data[1:3])[0]
                offset = 3
            
            self._last_hr = hr_value
            
            if has_energy:
                offset += 2
            
            if has_rr and len(data) >= offset + 2:
                num_rr = (len(data) - offset) // 2
                for i in range(num_rr):
                    rr_value = struct.unpack('<H', data[offset + i*2:offset + (i+1)*2])[0]
                    rr_ms = (rr_value / 1024.0) * 1000.0
                    self._rr_intervals.append(rr_ms)
            
            hrv_value = self.calculate_hrv_rmssd()
            
            self._current_row["experiment_name"] = self._experiment_name
            self._current_row["trial_name"] = self._trial_name
            self._current_row["subject_id"] = self._subject_id
            self._current_row["experimenter_name"] = self._experimenter_name
            self._current_row["timestamp_unix"] = tsu
            self._current_row["timestamp"] = ts
            self._current_row["HR"] = self._last_hr
            self._current_row["HRV"] = hrv_value
            self._current_row["event_marker"] = self.event_marker
            self._current_row["condition"] = self.condition
            
            if self._streaming:
                self.write_to_hdf5(self._current_row)
                hrv_display = f"{hrv_value:.1f}" if hrv_value is not None else "N/A"
                print(f"✓ HR={self._last_hr} HRV={hrv_display}")
                
        except Exception as e:
            print(f"Error parsing heart rate data: {e}")
            import traceback
            traceback.print_exc()

    def _scan_and_connect(self):
        """Internal method - runs in background thread with its own event loop"""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            self._event_loop = loop
            
            # Scan for device
            print("\nSearching for Polar H10...", flush=True)
            device = loop.run_until_complete(
                BleakScanner.find_device_by_filter(
                    lambda bd, ad: bd.name and "Polar H10" in bd.name,
                    timeout=10
                )
            )
            
            if device is None:
                print("No Polar H10 device found.")
                self._device_started = False
                return
            
            self._device_address = device.address
            print(f"Found Polar device: {device.name} at {device.address}")
            self._device_started = True
            
            # Connect and stream
            print(f"Connecting to Polar H10 at {self._device_address}")
            
            loop.run_until_complete(self._stream_data())
            
        except Exception as e:
            print(f"Error in Polar connection: {e}")
            self._crashed = True
            self._num_crashes += 1
            
        finally:
            if self._event_loop and not self._event_loop.is_closed():
                self._event_loop.close()
            self._streaming = False
            self._running = False

    async def _stream_data(self):
        """Internal async method for streaming"""
        try:
            async with BleakClient(self._device_address) as client:
                self._client = client
                self._streaming = True
                
                print(f"Connected to Polar H10 - streaming data...")
                
                await client.start_notify(
                    HEART_RATE_MEASUREMENT_UUID,
                    self.parse_heart_rate_measurement
                )
                
                # Stream while running flag is True
                while self._running:
                    await asyncio.sleep(0.1)
                
                await client.stop_notify(HEART_RATE_MEASUREMENT_UUID)
                print("Data collection complete.")
                
        except Exception as e:
            print(f"Error during data collection: {e}")
            raise

    def start(self) -> str:
        """Start the Polar manager - SYNCHRONOUS like Vernier"""
        try:
            if self.thread is not None and self.thread.is_alive():
                print("Stopping existing thread...")
                self._running = False
                self.thread.join()
                print("Thread stopped.")
            
            self._running = True
            self.thread = Thread(target=self._scan_and_connect, daemon=True)
            self.thread.start()
            
            # Wait a bit for device discovery
            time.sleep(2)
            
            if self._device_started:
                print("Polar manager running...")
                return "Polar device started."
            else:
                return "Searching for Polar H10..."
                
        except Exception as e:
            print(f"Error starting Polar device: {e}")
            self._device_started = False
            return f"Error: {e}"

    def stop(self) -> str:
        """Stop data collection - SYNCHRONOUS"""
        try:
            self._running = False
            self._streaming = False
            print("Stopping Polar manager...")
            
            if self.thread is not None and self.thread.is_alive():
                self.thread.join(timeout=5)
                print("Thread stopped.")
            
            if self._file_opened:
                print("Stop is closing HDF5 file...")
                self.close_h5_file()

            self._device_started = False
            print("Polar manager stopped.")
            return "Polar manager stopped."
                
        except Exception as e:
            print(f"An error occurred: {e}")
            return f"An error occurred: {e}"

    def reset(self) -> None:
        """Reset the manager state."""
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

        self._device_started = False
        self._device_address = None
        self._client = None
        self._dataset = None
        self._event_loop = None
        self._current_row = {
            "experiment_name": None,
            "trial_name": None,
            "subject_id": None,
            "experimenter_name": None,
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
        """Write data to HDF5."""
        try:
            if self.hdf5_file is None or self._dataset is None:
                print("HDF5 file or dataset is not initialized.")
                return

            new_data = np.zeros(1, dtype=self._dataset.dtype)  
            new_data[0]['experiment_name'] = row.get('experiment_name', '')
            new_data[0]['trial_name'] = row.get('trial_name', '')
            new_data[0]['subject_id'] = row.get('subject_id', '')
            new_data[0]['experimenter_name'] = row.get('experimenter_name', '')
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
        """Convert HDF5 to CSV."""
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
import threading
import pyaudio
import wave
import TimestampManager as tm

class RecordingManager():
    """
    A thread-safe audio recording manager for experimental sessions and data collection.
    
    The RecordingManager class provides functionality for managing audio recording operations
    during experimental sessions. It supports multi-threaded recording, audio device management,
    real-time audio streaming, and robust error handling for audio input operations.
    
    Key Features:
    - Thread-safe audio recording with PyAudio integration
    - Dynamic audio device detection and selection
    - Real-time audio streaming with configurable sample rates
    - Automatic WAV file generation with proper formatting
    - Audio system reset and recovery capabilities
    - Timestamp tracking for recording start and end times
    - Device validation and error handling
    
    Attributes:
        recording_file (str): Path to the output WAV file for recorded audio
        sample_rate (int): Current audio sample rate (defaults to device default)
        device_index (int): Index of the selected audio input device
        audio_devices (list): List of available audio input devices
        timestamp (str): ISO timestamp when recording started
        unix_timestamp (int): Unix timestamp when recording started
        end_timestamp (str): ISO timestamp when recording ended
        stream_is_active (bool): Current recording stream status
    
    Usage:
        >>> manager = RecordingManager("recording.wav")
        >>> devices = manager.get_audio_devices()
        >>> manager.set_device(1)  # Select specific audio device
        >>> manager.start_recording()
        >>> # ... experiment session ...
        >>> manager.stop_recording()
    
    Threading Model:
        - Main thread: Controls recording start/stop operations
        - Recording thread: Handles continuous audio data capture
        - Thread synchronization using Events for safe coordination
        - Automatic cleanup and resource management
    
    Audio Configuration:
        - Format: 16-bit PCM (pyaudio.paInt16)
        - Channels: Mono (1 channel)
        - Sample Rate: Device default or user-specified
        - Buffer Size: 1024 frames per buffer
        - Output Format: WAV file with proper headers
    
    Device Management:
        - Automatic detection of available input devices
        - Device validation before recording operations
        - Fallback to first available device if invalid selection
        - Audio system reset capabilities for error recovery
    
    Error Handling:
        - Comprehensive exception handling for audio operations
        - Graceful degradation when devices are unavailable
        - Timeout protection for thread operations (5 second timeout)
        - Detailed error logging for debugging
    
    Thread Safety:
        This class is designed to be thread-safe with proper synchronization
        using threading Events for coordination between recording and control threads.
    
    Dependencies:
        - threading: Thread management and synchronization
        - pyaudio: Audio input/output operations
        - wave: WAV file creation and formatting
        - TimestampManager: Custom timestamp utilities
    
    File Output:
        WAV files are created with the following specifications:
        - Sample width: 16-bit
        - Channels: 1 (mono)
        - Frame rate: Device-specific sample rate
        - Format: Standard WAV format compatible with most audio software
    
    Note:
        - Recording operations are non-blocking with proper thread management
        - Audio devices are automatically refreshed during initialization
        - Stream validation ensures proper device connectivity before recording
        - Timestamps are captured using the TimestampManager for consistency
    """
    def __init__(self, recording_file) -> None: 
        self.audio = pyaudio.PyAudio()
        self.sample_rate = int(self.audio.get_default_input_device_info()['defaultSampleRate'])
        print(f"Default Sample Rate: {self.sample_rate}")
        self.stop_event = threading.Event()
        self.recording_started_event = threading.Event()
        self.stream_ready_event = threading.Event()
        self.recording_thread = None
        self._stream_is_active = False
        self._recording_file = recording_file
        self.device_index = 0
        self.audio_devices = self.fetch_audio_devices()
        self._timestamp = None
        self._unix_timestamp = None
        self._end_timestamp = None
        print("Recording manager initialized...")
        print(f"Recording manager's temporary recording file set to {self.recording_file}")

    ##################################################################
    ## GENERAL METHODS
    ##################################################################
    @property
    def timestamp(self) -> str:
        return self._timestamp
    
    @timestamp.setter
    def timestamp(self, value) -> None:
        self._timestamp = value
    
    @property
    def unix_timestamp(self) -> int:
        return self._unix_timestamp
    
    @unix_timestamp.setter
    def unix_timestamp(self, value) -> None:
        self._unix_timestamp = value

    @property
    def end_timestamp(self) -> str:
        return self._end_timestamp
    
    @end_timestamp.setter
    def end_timestamp(self, value) -> None:
        self._end_timestamp = value

    @property
    def recording_file(self) -> str:
        return self._recording_file
    
    @recording_file.setter
    def recording_file(self, recording_file) -> None:
        self._recording_file = recording_file

    @property
    def stream_is_active(self) -> bool:
        return self._stream_is_active
    
    @stream_is_active.setter
    def stream_is_active(self, value) -> None:
        self._stream_is_active = value

    def start_recording(self) -> None:
        self.stop_event.clear()
        self.recording_started_event.set()

        self.timestamp = tm.get_timestamp("iso")
        self.unix_timestamp = tm.get_timestamp("unix")

        self.recording_thread = threading.Thread(target=self.record_thread)
        self.recording_thread.start()
        self.stream_ready_event.wait()
        self.stream_is_active = True
        self.recording_started_event.wait()

        print("Recording thread started")   

    def _validate_device_index(self) -> None:
        """Ensure device_index points to a valid input device"""
        if not self.audio_devices:
            print("Warning: No audio input devices found")
            return
            
        valid_indices = [device['index'] for device in self.audio_devices]
        if self.device_index not in valid_indices:
            print(f"Warning: Device index {self.device_index} not valid, using first available device")
            self.device_index = valid_indices[0] if valid_indices else 0

    def stop_recording(self) -> None:
        self.stop_event.set()

        if self.recording_thread:
            self.recording_thread.join(timeout=5.0) # Prevent hanging.

        self.recording_started_event.clear()
        self.stream_ready_event.clear()
        self.stream_is_active = False
        self.end_timestamp = tm.get_timestamp("iso")
        print(f"Recording stopped at {self.end_timestamp}")

    def reset_audio_system(self):
        try:
            if self.audio is not None:
                self.audio.terminate()
            self.audio = pyaudio.PyAudio()
            self.audio_devices = self.fetch_audio_devices()
            print("Audio system reset successfully.")

        except Exception as e:
                    print(f"Error resetting audio system: {e}")

    def record_thread(self) -> None:
        try:
            self._validate_device_index()

            stream = self.audio.open(format=pyaudio.paInt16, 
                                channels=1, 
                                rate=self.sample_rate, 
                                input=True, 
                                input_device_index=self.device_index,
                                frames_per_buffer=1024)
        
        except Exception as e:
            print(f"Error opening audio stream: {e}")
            self.stream_ready_event.set() # TODO: CHECK THE VALIDITY OF THIS
            return
        
        self.stream_ready_event.set()

        frames = []

        self.recording_started_event.set()

        while not self.stop_event.is_set():
            try:
                data = stream.read(1024)
                frames.append(data)
            except Exception as e:
                print(f"Error reading from audio stream: {e}")
                break
        
        try:
            stream.stop_stream()
            stream.close()    
        except Exception as e:
            print(f"Error closing stream: {e}")

        try:
            with wave.open(self.recording_file, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(self.audio.get_sample_size(pyaudio.paInt16))
                wf.setframerate(self.sample_rate)
                wf.writeframes(b''.join(frames))
                print(f"Recording stopped, saved to {self.recording_file}")
        except Exception as e:
            print(f"Error writing to wave file: {e}")

    ##################################################################
    ## GETTERS
    ##################################################################
    def get_stop_event(self) -> threading.Event:
        return self.stop_event
    
    def get_audio_devices(self) -> list:
        return self.audio_devices

    def fetch_audio_devices(self) -> list:
        if self.audio is None:
            self.audio = pyaudio.PyAudio()
        
        try:
            audio_devices = [{'index': i, 'name': self.audio.get_device_info_by_index(i)['name']}
                            for i in range(self.audio.get_device_count())
                            if self.audio.get_device_info_by_index(i)['maxInputChannels'] > 0]
        except Exception as e:
            print(f"Error fetching audio devices: {e}")
            audio_devices = []

        return audio_devices

    ##################################################################
    ## SETTERS
    ##################################################################
    def set_device(self, index) -> None:
        valid_indices = [device['index'] for device in self.audio_devices]

        if index not in valid_indices:
            print(f"Invalid device index {index}. Valid indices: {valid_indices}")
            return
        
        self.device_index = index
        self.sample_rate = int(self.audio.get_device_info_by_index(index)['defaultSampleRate'])
        print(f"Device Sample Rate: {self.sample_rate}")

        name = None
        
        for device in self.audio_devices:
            if device['index'] == index:
                name = device['name']
                break
        print(f"Device set to {name if name else 'Unknown (index not in audio_devices list)'}")

    ##################################################################
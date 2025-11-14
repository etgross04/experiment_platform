import os
import numpy as np 
import wave
import shutil
import librosa

class AudioFileManager:
    """
    CONTRACT: AudioFileManager
    
    Role:
        Central utility for experiment audio lifecycle: capture reference (recording_file),
        organize into audio_folder, transform (resample, segment, normalize), extract chunks,
        backup and clean temp artifacts, and provide metadata (duration).
    
    Responsibilities:
        - Persist a captured WAV file into structured subject hierarchy.
        - Generate canonical filenames (timestamp_id_param1_param2.wav).
        - Copy, backup, and delete audio artifacts safely.
        - Resample to target sample rate (librosa) or simple in-memory interpolation.
        - Split WAV into fixed-duration sequential segments.
        - Extract normalized numpy slices (optionally resampled) for downstream models.
        - Report total duration.
    
    Non-Responsibilities:
        - Recording audio.
        - Concurrency control.
        - Overlapping or variable-length segmentation logic.
        - Format handling beyond PCM WAV.
    
    Inputs (selected methods):
        __init__(recording_file: str, audio_save_folder: str)
        set_audio_folder(subject_folder: str)
        save_audio_file(new_filename: str)
        delete_recording_file(file_path: str)
        resample(input_file: str, target_sample_rate: int = 24000)
        rename_audio_file(timestamp: str, id: str|int, name_param1: str, name_param2: str)
        backup_tmp_audio_files()
        get_audio_chunk_as_np(offset: float = 0, duration: float|None = None, sample_rate: int = 16000)
        resample_audio(signal: np.array, original_sample_rate: int, target_sample_rate: int)
        get_audio_duration()
        normalize_audio(audio: np.array)
        split_wav_to_segments(id: str|int, task_id: str|int, input_wav: str, segment_duration: int = 5, output_folder: str = "tmp")
    
    Outputs:
        - Paths to copied, resampled, or segmented WAV files.
        - Numpy float32 arrays normalized to [-1, 1] (mono).
        - Duration (float seconds).
        - Filename strings.
    
    Side Effects:
        - Creates directories.
        - Writes WAV segment/resample files.
        - Copies and deletes files in audio_folder and tmp/.
        - Prints status/error messages (stdout).
    
    File Structure Assumption:
        subject_data/<experiment>/<trial>/<subject>/audio_files/
    
    Error Handling:
        - Wraps file operations (copy/delete/resample/split) with broad exception capture.
        - Prints diagnostic messages; does not raise unless parameter validation fails (e.g., invalid output folder).
    
    Invariants:
        - recording_file points to a WAV file path (caller responsibility).
        - audio_folder is a writable directory once set.
    
    Performance Notes:
        - Resampling via librosa.load is CPU-bound for long files.
        - Interpolation resample is linear (no anti-alias filtering).
        - Segment writing is sequential; no parallelization.
    
    Thread Safety:
        - Not thread-safe; external synchronization required if shared across threads.
    
    Data Expectations:
        - PCM 16-bit WAV input for chunk extraction and segmentation.
        - Stereo converted to mono via channel mean.
    
    Filename Convention:
        timestamp_id_param1_param2.wav
    
    Extension Points:
        - Replace interpolation with high-quality resampler.
        - Add overlap/stride parameters for segmentation.
        - Integrate logging instead of print.
        - Support additional codecs via soundfile.
    
    Constraints:
        - Requires librosa, numpy, wave, shutil, os.
        - tmp/ directory must exist or be creatable.
    
    Example (minimal):
        manager = AudioFileManager("tmp/current.wav", "")
        manager.set_audio_folder("/experiment/subject/audio_files")
        manager.save_audio_file(manager.rename_audio_file("2024-01-01T10-00-00", "001", "taskA", "trial1"))
        segs = manager.split_wav_to_segments("001", "taskA", "tmp/current.wav", 5)
        chunk = manager.get_audio_chunk_as_np(offset=0, duration=5, sample_rate=16000)
        dur = manager.get_audio_duration()
    
    Non-Goals:
        - No automatic cleanup scheduling.
        - No metadata (bitrate, codec) beyond wave basics.
        - No async IO.
    """
    def __init__(self, recording_file, audio_save_folder) -> None:
        self._recording_file = recording_file
        self._audio_folder = audio_save_folder

        print("Audio File Manager initialized...")
        print("Audio folder will be set to 'subject_data/<experiment_name>/<trial_name>/<subject_folder>/audio_files' when the subject is created.")
    
    @property
    def recording_file(self) -> str:
        return self._recording_file
    
    @recording_file.setter
    def recording_file(self, recording_file) -> None:
        self._recording_file = recording_file

    @property
    def audio_folder(self) -> str:
        return self._audio_folder
    
    @audio_folder.setter
    def audio_folder(self, audio_save_folder) -> None:
        self._audio_folder = audio_save_folder
        print(f"Audio folder set to {self._audio_folder}")

    def set_audio_folder(self, subject_folder):
        self.audio_folder = os.path.join(subject_folder, "audio_files")
        if not os.path.exists(self.audio_folder):
            os.makedirs(self.audio_folder)

        # DEBUG
        print("Audio folder set for audio manager: ", self.audio_folder)

    def save_audio_file(self, new_filename) -> None:
        try:
            os.makedirs(self.audio_folder, exist_ok=True)
            new_filename = os.path.join(self.audio_folder, new_filename)
            shutil.copy(self.recording_file, new_filename)

            print(f"File '{self.recording_file}' saved as {new_filename} in {self.audio_folder}.")
        except PermissionError:
            print(f"Permission denied: Unable to save file '{self.recording_file}'. Check file permissions.")
        except FileNotFoundError:
            print(f"File not found: '{self.recording_file}' might have already been deleted.")
        except Exception as e:
            print(f"An error occurred while trying to save the file '{self.recording_file}': {str(e)}")

    def delete_recording_file(self, file_path) -> None:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"File '{file_path}' deleted successfully.")
            else:
                print(f"File '{file_path}' does not exist.")
        except PermissionError:
            print(f"Permission denied: Unable to delete file '{file_path}'. Check file permissions.")
        except FileNotFoundError:
            print(f"File not found: '{file_path}' might have already been deleted.")
        except Exception as e:
            print(f"An error occurred while trying to delete the file '{file_path}': {str(e)}")

    def resample(self, input_file, target_sample_rate=24000):
        """
        Resample the audio file to the target sample rate.
        Args:
            input_file (str): Path to the input audio file.
            target_sample_rate (int): Desired sample rate for the output audio file.
        Returns:
            str: Path to the resampled audio file.
        """
        try:
            resampled, _ = librosa.load(input_file, sr=target_sample_rate)
            resampled_int16 = (resampled * 32767).astype(np.int16) 
            
            temp_file = input_file.replace(".wav", f"_resampled_{target_sample_rate}.wav")

            with wave.open(temp_file, 'wb') as wf:
                wf.setnchannels(1)  
                wf.setsampwidth(2)  
                wf.setframerate(target_sample_rate)
                wf.writeframes(resampled_int16.tobytes())

            return temp_file
        
        except Exception as e:
            print(f"Error during resampling: {e}")
            return None
        
    def rename_audio_file(self, timestamp, id, name_param1, name_param2) -> str:
        filename = f"{timestamp}_{id}_{name_param1}_{name_param2}.wav"

        return filename

    def backup_tmp_audio_files(self) -> None:
        tmp_folder = "tmp/"
        
        for file_name in os.listdir(tmp_folder):
            if file_name == os.path.basename(self.recording_file):
                continue

            full_path = os.path.join(tmp_folder, file_name)
            
            if os.path.isfile(full_path):
                shutil.copy(full_path, self.audio_folder)
        
        for file_name in os.listdir(tmp_folder):
            if file_name == os.path.basename(self.recording_file):
                continue

            full_file_name = os.path.join(tmp_folder, file_name)
            
            if os.path.isfile(full_file_name):
                os.remove(full_file_name)

    def get_audio_chunk_as_np(self, offset=0, duration=None, sample_rate=16000) -> np.array:
        """
        Returns the section of audio specified by the offset and duration parameters as a normalized 
        numpy array. This is necessary for the current SER classifier and is subject to change when 
        another SER module is implemented.

        Parameters
        - the path and filename of the wav file, 
        - the offset in seconds, 
        - the duration in seconds, 
        - the samplerate in Hz.
        Returns: 
        - the audio chunk as a numpy array
        Exception:
        - if the file is not found
        """
        try:
            with wave.open(self._recording_file, 'rb') as wf:
                num_channels = wf.getnchannels()
                original_sample_rate = wf.getframerate()
                start_frame = int(offset * original_sample_rate)
                num_frames = int(duration * original_sample_rate) if duration else wf.getnframes() - start_frame

                wf.setpos(start_frame)
                signal = wf.readframes(num_frames)
                signal = np.frombuffer(signal, dtype=np.int16).astype(np.float32)
                signal = signal / np.iinfo(np.int16).max  

                # Convert stereo to mono by averaging channels
                if num_channels == 2:
                    signal = signal.reshape(-1, 2).mean(axis=1)

                # If the original sample rate differs, resample to target sample rate
                if original_sample_rate != sample_rate:
                    signal = self.resample_audio(signal, original_sample_rate, sample_rate)

                return signal
            
        except Exception as e:
            print(f"An error occurred while processing the audio: {e}")
            return None

    def resample_audio(signal, original_sample_rate, target_sample_rate) -> np.array:
        """
        Resamples the signal to match the target sample rate using linear interpolation.

        Parameters: 
        - the signal as a numpy array, 
        - the original sample rate in Hz, 
        - the target sample rate in Hz.
        Returns:
        - the resampled signal as a numpy array
        """
        ratio = target_sample_rate / original_sample_rate
        resampled_length = int(len(signal) * ratio)
        resampled_signal = np.interp(
            np.linspace(0, len(signal) - 1, resampled_length), np.arange(len(signal)), signal
        )
        return resampled_signal

    def get_audio_duration(self) -> float:
        """
        Calculate the duration of an audio file.
        This function opens an audio file specified by the file_path, reads the number of frames and the frame rate,
        and calculates the duration of the audio in seconds.
        Parameter:
            file_path (str): The path/filename of the audio file.
        Returns:
            float: The duration of the audio file in seconds.
        """
        with wave.open(self._recording_file, 'rb') as wf:
            frames = wf.getnframes()          
            rate = wf.getframerate()          
            duration = frames / float(rate)   
        return duration

    # NOTE: This function is not used in the current implementation
    def normalize_audio(self, audio) -> np.array: 
        audio_array = audio / np.max(np.abs(audio))
        return audio_array
    
    def split_wav_to_segments(self, id, task_id, input_wav, segment_duration=5, output_folder="tmp") -> list:
        """
        Splits a WAV file into user defined number of segments and saves each segment in the specified output folder.

        Parameters:
        - input_wav (str): Path to the input WAV file.
        - segment_duration (int): Duration of each segment in seconds. Default is 20 seconds.
        - output_folder (str): Folder to save the output segments. Default is 'tmp'.
        Returns:
        - List of paths/filenames to the saved segment files.
        """
        import math
        # Ensure the output folder exists
        if not output_folder or not isinstance(output_folder, str):
            raise ValueError("Invalid output folder path.")
        
        os.makedirs(output_folder, exist_ok=True)
        segment_files = []
        try:
            with wave.open(input_wav, 'rb') as wf:
                sample_rate = wf.getframerate()
                channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                total_frames = wf.getnframes()
                duration = total_frames / sample_rate
                
                print(f"Total frames: {total_frames}, Sample rate: {sample_rate}, Duration: {duration:.2f} seconds")

                # Calculate frames per segment
                segment_frames = int(segment_duration * sample_rate)
                # total_segments = int(duration // segment_duration) + (1 if duration % segment_duration != 0 else 0)
                total_segments = max(1, int(math.ceil(duration / segment_duration)))

                for i in range(total_segments):
                    start_frame = i * segment_frames
                    remaining_frames = total_frames - start_frame
                    frames_to_read = min(segment_frames, remaining_frames)
                    # wf.setpos(i * segment_frames)
                    # remaining_frames = total_frames - (i * segment_frames)
                    # frames_to_read = min(segment_frames, remaining_frames)
                    wf.setpos(start_frame)
                    frames = wf.readframes(frames_to_read)
                    # {str(id)}_{str(task_id)}_
                    segment_file = os.path.join(output_folder, f"{str(id)}_{str(task_id)}_segment_{str(i).zfill(2)}.wav")
                    print(f"Creating segment file: {segment_file}")  # Debugging statement
                    
                    with wave.open(segment_file, 'wb') as segment_wf:
                        segment_wf.setnchannels(channels)
                        segment_wf.setsampwidth(sample_width)
                        segment_wf.setframerate(sample_rate)
                        segment_wf.writeframes(frames)
                    
                    segment_files.append(segment_file)
                    print(f"Segment {i} saved as {segment_file}")
                    
            return segment_files
        
        except Exception as e:
            print(f"An error occurred while splitting the WAV file: {str(e)}")
        
        return segment_files
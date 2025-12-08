from pylsl import StreamInfo, StreamOutlet

class LSLManager:
    def __init__(self, name="DataSyncMarker", source_id="exp_platform"):
        self.info = StreamInfo(
            name=name,
            type='Markers',
            channel_count=1,
            nominal_srate=0,  
            channel_format='string',
            source_id=source_id
        )
        self.outlet = None
        
    def start(self):
        if not self.outlet:
            self.outlet = StreamOutlet(self.info)
            print(f"LSL marker stream started: {self.info.name()}")
    
    def send_marker(self, marker, condition=None):
        if self.outlet:

            marker_str = f"{marker}|{condition}" if condition else marker
            self.outlet.push_sample([marker_str])
    
    def stop(self):
        if self.outlet:
            self.outlet = None
            print("LSL marker stream stopped")
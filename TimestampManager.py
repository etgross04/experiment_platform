"""
TimestampManager Module Contract

IDENTITY:
- Module: TimestampManager
- Purpose: Provide microsecond-precision timestamps via C++ singleton
- Interface: Python wrapper for C++ timestamp_manager library

GUARANTEES:
- Precision: Microsecond accuracy (0.000001s)
- Thread Safety: All operations are thread-safe with mutex protection
- Timezone: All timestamps in UTC
- Timeout: Operations complete within 500ms or raise exception
- Consistency: Single source of truth via singleton pattern

INPUT CONTRACTS:
get_timestamp(type: str = "unix") -> str
    ACCEPTS: type in ["iso", "unix", "unix_double"]
    DEFAULT: "unix"
    REJECTS: Invalid type values
    
get_unix_timestamp_double() -> float
    ACCEPTS: No parameters
    
OUTPUT CONTRACTS:
get_timestamp() RETURNS:
    - type="iso": "YYYY-MM-DDTHH:MM:SS.ffffffZ" (UTC, microseconds)
    - type="unix": "1704110445.123456" (string with 6 decimal places)
    - type="unix_double": "1704110445.123456" (string representation of float)

get_unix_timestamp_double() RETURNS:
    - float: Unix timestamp with microsecond precision

INVARIANTS:
- Singleton instance persists for process lifetime
- All timestamps monotonically increase (system clock dependent)
- Thread operations never deadlock (try_lock + timeout)
- UTC timezone never changes
- Microsecond precision maintained across all formats

DEPENDENCIES:
- REQUIRED: timestamp_manager C++ shared library
- REQUIRED: C++11+ runtime
- REQUIRED: Python C API compatibility

FAILURE MODES:
- Library import failure: Module initialization fails
- Timeout exceeded: Exception after 500ms
- System clock unavailable: Falls back to system defaults
- Thread contention: Non-blocking with automatic retry

PERFORMANCE:
- Latency: Sub-millisecond for uncontended access
- Blocking: Maximum 500ms under contention
- Overhead: Minimal Python wrapper cost
- Scalability: Supports high-frequency concurrent access

USAGE PATTERN:
>>> from TimestampManager import get_timestamp, get_unix_timestamp_double
>>> iso = get_timestamp("iso")           # "2024-01-01T10:30:45.123456Z"
>>> unix_str = get_timestamp("unix")     # "1704110445.123456"
>>> unix_float = get_unix_timestamp_double()  # 1704110445.123456
"""
import timestamp_manager as tm

mgr = tm.TimestampManager.get_instance()

def get_timestamp(type: str = "unix") -> str:
    """
    Get the current timestamp in the specified format.
    
    Args:
        fmt (str): The format of the timestamp. Can be 'iso', 'unix', or 'unix_double'.
    
    Returns:
        str: The current timestamp in the specified format.
    """
    return mgr.get_timestamp(type)

def get_unix_timestamp_double() -> float:
    """
    Get the current Unix timestamp as a double (float).
    
    Returns:
        float: The current Unix timestamp as a double.
    """
    return mgr.get_unix_timestamp_double()
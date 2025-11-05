"""
A high-performance timestamp management module providing microsecond-precision timing for experimental data collection.

This module serves as a Python interface to a C++ singleton TimestampManager implementation,
delivering ultra-high precision timestamps with minimal latency for critical experimental timing.
The underlying C++ implementation ensures consistent, thread-safe timestamp generation across
all experimental platform components with microsecond accuracy.

Key Features:
- C++ singleton implementation for maximum performance and consistency
- Microsecond-precision timestamps using std::chrono::system_clock
- Thread-safe operations with non-blocking mutex optimization
- Multiple timestamp formats optimized for different experimental needs
- Condition variable synchronization for concurrent access
- UTC timezone consistency for global experimental data integrity
- Automatic timeout protection (500ms) for timestamp operations

Performance Characteristics:
- Microsecond precision: Timestamps accurate to 0.000001 seconds
- Non-blocking design: Uses try_lock with fallback to prevent deadlocks
- Optimized C++ core: Minimal Python overhead for time-critical operations
- Singleton pattern: Single source of truth across all managers
- Thread synchronization: Condition variables for efficient waiting

Timestamp Formats:
- ISO 8601 Extended: "YYYY-MM-DDTHH:MM:SS.ffffffZ" (UTC with microseconds)
- Unix String: "1704110445.123456" (string representation)
- Unix Double: 1704110445.123456 (high-precision floating point)

Functions:
    get_timestamp(type="unix"): Get current timestamp in specified format
        Args:
            type (str): Format type - "iso", "unix", or "unix_double"
        Returns:
            str: Formatted timestamp string
    
    get_unix_timestamp_double(): Get high-precision Unix timestamp
        Returns:
            float: Unix timestamp as double with microsecond precision

Usage:
    >>> from TimestampManager import get_timestamp, get_unix_timestamp_double
    >>> # High-precision ISO timestamp
    >>> iso_time = get_timestamp("iso")     # "2024-01-01T10:30:45.123456Z"
    >>> # Unix timestamp as string
    >>> unix_str = get_timestamp("unix")    # "1704110445.123456"
    >>> # Unix timestamp as high-precision float
    >>> unix_float = get_unix_timestamp_double()  # 1704110445.123456

C++ Implementation Details:
- Header-only design for optimal compilation
- std::chrono::system_clock for system-level accuracy
- std::condition_variable for efficient thread coordination
- std::atomic<bool> for lock-free status checking
- Smart pointer management for memory safety
- Exception-safe RAII patterns throughout

Thread Safety:
- Primary mutex: Controls timestamp update operations
- Instance mutex: Protects singleton instantiation
- Condition variables: Enable efficient waiting without polling
- Atomic flags: Provide lock-free status communication
- Timeout protection: Prevents indefinite blocking (500ms limit)

Dependencies:
    - timestamp_manager: C++ shared library (.so/.dll/.dylib)
    - Standard C++ libraries: chrono, mutex, condition_variable, atomic

Build Requirements:
    - C++11 or later for std::chrono and threading support
    - Python C API compatibility for shared object integration
    - Platform-specific compilation for optimal performance

Note:
    - All timestamps generated in UTC timezone for consistency
    - Microsecond precision suitable for high-frequency experimental data
    - Non-blocking design prevents experimental timing disruption
    - Automatic initialization on first access with console confirmation
    - Cross-platform compatibility (Linux, macOS, Windows)
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
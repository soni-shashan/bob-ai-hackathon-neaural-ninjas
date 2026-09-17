"""
GridGuard IoT SDK — Custom Exceptions.
"""


class GridGuardIoTError(Exception):
    """Base exception for GridGuard IoT SDK."""
    pass


class AuthenticationError(GridGuardIoTError):
    """Raised when the API key is invalid or device is deactivated."""
    pass


class ConnectionError(GridGuardIoTError):
    """Raised when the server is unreachable."""
    pass


class IngestError(GridGuardIoTError):
    """Raised when data ingestion fails."""
    pass


class ValidationError(GridGuardIoTError):
    """Raised when sensor data validation fails."""
    pass

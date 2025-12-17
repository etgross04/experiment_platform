

# Setup Checklist

Use this checklist to ensure all components of the Experiment Platform are properly installed and configured.

## Pre-Installation

- [ ] macOS system (Apple Silicon)
- [ ] Administrator/sudo access
- [ ] Stable internet connection
- [ ] At least 5GB free disk space

## Installation Steps

### System Requirements

- [ ] Homebrew installed
- [ ] Python 3.11.4 installed and accessible
- [ ] Node.js 14+ installed
- [ ] npm installed

### System Dependencies

- [ ] HDF5 installed via Homebrew
- [ ] Lab Streaming Layer (LSL) installed
- [ ] PortAudio installed
- [ ] FFmpeg installed
- [ ] HDF5_DIR environment variable set
- [ ] DYLD_LIBRARY_PATH configured for LSL

### Python Environment

- [ ] Virtual environment created (optional but recommended)
- [ ] pip upgraded to latest version
- [ ] h5py installed successfully
- [ ] pylsl installed successfully
- [ ] All packages from requirements.txt installed
- [ ] Flask and Flask-CORS installed

### Frontend Setup

- [ ] Frontend directory exists
- [ ] npm packages installed in frontend/
- [ ] No npm installation errors

### Project Structure

- [ ] SER_MODEL directory exists in project root
- [ ] SER_MODEL directory contains model files
- [ ] static directory exists
- [ ] static/video_files directory exists
- [ ] static/video_files directory contains video files
- [ ] recordings directory created
- [ ] logs directory created
- [ ] tmp directory exists

**Note:** Audio files are already included in the GitHub repository

### Configuration Files

- [ ] .env file created
- [ ] AZURE_SPEECH_KEY configured in .env
- [ ] AZURE_SPEECH_REGION configured in .env
- [ ] Database credentials configured in .env
- [ ] Flask SECRET_KEY configured in .env
- [ ] timestamp_manager.cpython-311-darwin.so present

### Database

- [ ] PostgreSQL installed (if using database features)
- [ ] Database created
- [ ] Database schema imported
- [ ] Database credentials tested

### Large Files

- [ ] XRLAB_assets downloaded from Google Drive
- [ ] SER_MODEL extracted to project root
- [ ] SER_MODEL files verified (checksums match if provided)
- [ ] video_files extracted to static/ directory
- [ ] video_files verified (checksums match if provided)

**Note:** Audio files are included in the GitHub repository

## Post-Installation Verification

### Python Imports Test

Run this command to test core imports:
```bash
python -c "import flask; import h5py; import pylsl; import numpy; print('✓ All core imports successful')"
```
- [ ] Core imports successful

### Backend Server Test

```bash
python app.py
```
Expected output:
- [ ] Server starts without errors
- [ ] Flask server running on http://localhost:5001
- [ ] No import errors
- [ ] No missing module errors

### Frontend Test

```bash
cd frontend && npm start
```
Expected output:
- [ ] Development server starts
- [ ] No compilation errors
- [ ] Application accessible at http://localhost:3000
- [ ] No console errors in browser

### Integration Test

- [ ] Frontend can connect to backend
- [ ] No CORS errors in browser console
- [ ] API endpoints responding
- [ ] File upload functionality works
- [ ] Session creation works

## Common Issues and Solutions

### Issue: Python version mismatch
**Solution:** Ensure you're using Python 3.11.4 specifically
```bash
python --version  # Should show Python 3.11.x
```

### Issue: h5py installation fails
**Solution:** Ensure HDF5_DIR is set
```bash
export HDF5_DIR=$(brew --prefix hdf5)
pip install --no-cache-dir h5py
```

### Issue: LSL not found
**Solution:** Check DYLD_LIBRARY_PATH
```bash
echo $DYLD_LIBRARY_PATH  # Should include /opt/homebrew/lib
export DYLD_LIBRARY_PATH=/opt/homebrew/lib:$DYLD_LIBRARY_PATH
```

### Issue: .so binary not compatible
**Solution:** The timestamp_manager binary is architecture-specific
- Ensure it matches your Mac's architecture (Apple Silicon vs Intel)
- May need to recompile from source

### Issue: Frontend can't connect to backend
**Solution:** Check if both servers are running
- Backend should be on port 5001
- Frontend should be on port 3000
- Check for port conflicts

### Issue: Missing environment variables
**Solution:** Verify .env file
```bash
cat .env  # Should show all required variables
```

### Issue: Audio files not found
**Solution:** Audio files should already be in the repository. Check that you've cloned the complete repository.

### Issue: Video files not found
**Solution:** Verify directory structure
```bash
ls -la static/video_files/  # Should show video files
ls -la SER_MODEL/            # Should show model files
```
If missing, run `./download_assets.sh`

## Support

If you encounter issues not covered here:

1. Check the error message carefully
2. Review the relevant section in DOWNLOAD_INSTRUCTIONS.md
3. Ensure all prerequisites are met
4. Check GitHub Issues for similar problems
5. Create a new issue with:
   - Your macOS version
   - Python version
   - Complete error message
   - Steps to reproduce

## Next Steps After Successful Installation

1. **Configure Experiments**: 
   - Navigate to experiment builder interface
   - Create or modify experiment templates

2. **Test Hardware Integration**:
   - Connect any biometric sensors (EmotiBit, etc.)
   - Test audio recording functionality
   - Verify LSL streams if using

3. **Run Test Session**:
   - Create a test subject
   - Run through a simple experiment
   - Verify data is saved correctly

4. **Review Documentation**:
   - Read USAGE.md for operational guidelines
   - Review DATABASE_SETUP.md if using database features
   - Familiarize yourself with the experiment builder

5. **Backup Your Configuration**:
   - Save your .env file securely
   - Document any custom configurations
   - Keep checksums of large files

## Security Reminders

- [ ] .env file is in .gitignore
- [ ] No credentials committed to git
- [ ] Azure API keys are kept secure
- [ ] Database passwords are strong
- [ ] Regular backups configured

## Performance Optimization (Optional)

- [ ] Consider using PostgreSQL over SQLite for production
- [ ] Enable gzip compression in Flask
- [ ] Configure proper logging levels
- [ ] Set up monitoring for long-running experiments
- [ ] Test with expected number of concurrent users

---

**Last Updated:** December 2025
**Platform Version:** See git commit hash
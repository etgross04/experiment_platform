#!/bin/bash

###############################################################################
# Post-Installation Verification Script
# Checks that all components are properly installed and configured
###############################################################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

print_header() {
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
}

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    if [ -n "$2" ]; then
        echo -e "  ${YELLOW}→${NC} $2"
    fi
    ((FAILED_CHECKS++))
    ((TOTAL_CHECKS++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    if [ -n "$2" ]; then
        echo -e "  ${BLUE}→${NC} $2"
    fi
    ((WARNING_CHECKS++))
    ((TOTAL_CHECKS++))
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

###############################################################################
# System Checks
###############################################################################
print_header "System Requirements"

# Check OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    check_pass "Running on macOS"
else
    check_fail "Not running on macOS" "This platform is designed for macOS"
fi

# Check Homebrew
if command_exists brew; then
    check_pass "Homebrew is installed"
else
    check_fail "Homebrew not found" "Install from https://brew.sh"
fi

# Check Python
if command_exists python3.11 || command_exists python3; then
    PYTHON_CMD=$(command_exists python3.11 && echo "python3.11" || echo "python3")
    VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
    if [[ $VERSION == 3.11.* ]]; then
        check_pass "Python 3.11 found: $VERSION"
    else
        check_warn "Python version $VERSION" "Python 3.11.4 recommended"
    fi
else
    check_fail "Python not found" "Install Python 3.11"
fi

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    check_pass "Node.js installed: $NODE_VERSION"
else
    check_fail "Node.js not found" "Install via: brew install node"
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    check_pass "npm installed: $NPM_VERSION"
else
    check_fail "npm not found" "Should be installed with Node.js"
fi

###############################################################################
# System Dependencies
###############################################################################
print_header "System Dependencies"

# Check HDF5
if brew list hdf5 &>/dev/null; then
    check_pass "HDF5 installed"
    
    # Check HDF5_DIR
    if [ -n "$HDF5_DIR" ]; then
        check_pass "HDF5_DIR environment variable set: $HDF5_DIR"
    else
        check_warn "HDF5_DIR not set" "May need to export HDF5_DIR=\$(brew --prefix hdf5)"
    fi
else
    check_fail "HDF5 not installed" "Install via: brew install hdf5"
fi

# Check LSL
if brew list lsl &>/dev/null; then
    check_pass "Lab Streaming Layer installed"
    
    # Check DYLD_LIBRARY_PATH
    if [[ $DYLD_LIBRARY_PATH == *"/opt/homebrew/lib"* ]]; then
        check_pass "DYLD_LIBRARY_PATH configured for LSL"
    else
        check_warn "DYLD_LIBRARY_PATH may not include LSL" "Add to shell profile"
    fi
else
    check_fail "LSL not installed" "Install via: brew install labstreaminglayer/tap/lsl"
fi

# Check PortAudio
if brew list portaudio &>/dev/null; then
    check_pass "PortAudio installed"
else
    check_warn "PortAudio not installed" "May be needed for audio recording"
fi

# Check FFmpeg
if brew list ffmpeg &>/dev/null; then
    check_pass "FFmpeg installed"
else
    check_warn "FFmpeg not installed" "May be needed for audio processing"
fi

###############################################################################
# Python Packages
###############################################################################
print_header "Python Packages"

# Check if we're in a virtual environment
if [ -n "$VIRTUAL_ENV" ]; then
    check_pass "Virtual environment active: $VIRTUAL_ENV"
else
    check_warn "Not in a virtual environment" "Consider using: python -m venv venv"
fi

# Test imports
test_import() {
    $PYTHON_CMD -c "import $1" 2>/dev/null
    return $?
}

# Core packages
PACKAGES=("flask" "h5py" "pylsl" "numpy" "pandas" "werkzeug")
for pkg in "${PACKAGES[@]}"; do
    if test_import "$pkg"; then
        check_pass "Python package: $pkg"
    else
        check_fail "Python package missing: $pkg" "Install via: pip install $pkg"
    fi
done

# Check requirements.txt
if [ -f "requirements.txt" ]; then
    check_pass "requirements.txt found"
else
    check_warn "requirements.txt not found" "Ensure you're in project root"
fi

###############################################################################
# Project Structure
###############################################################################
print_header "Project Structure"

# Check main files
FILES=("app.py" "timestamp_manager.cpython-311-darwin.so")
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        check_pass "File exists: $file"
    else
        if [[ "$file" == *.so ]]; then
            check_warn "File missing: $file" "May need architecture-specific binary"
        else
            check_fail "File missing: $file"
        fi
    fi
done

# Check directories
DIRS=("frontend" "experiments" "static" "surveys")
for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        check_pass "Directory exists: $dir"
    else
        check_fail "Directory missing: $dir"
    fi
done

# Check required directories for large files
if [ -d "SER_MODEL" ]; then
    if [ "$(ls -A SER_MODEL 2>/dev/null)" ]; then
        FILE_COUNT=$(find SER_MODEL -type f | wc -l | tr -d ' ')
        check_pass "SER_MODEL directory populated ($FILE_COUNT files)"
    else
        check_warn "SER_MODEL directory empty" "Run download_assets.sh to download model files"
    fi
else
    check_fail "SER_MODEL directory missing" "Run download_assets.sh to download model files"
fi

if [ -d "static/video_files" ]; then
    if [ "$(ls -A static/video_files 2>/dev/null)" ]; then
        FILE_COUNT=$(find static/video_files -type f | wc -l | tr -d ' ')
        check_pass "video_files directory populated ($FILE_COUNT files)"
    else
        check_warn "video_files directory empty" "Run download_assets.sh to download video files"
    fi
else
    check_fail "static/video_files directory missing" "Run download_assets.sh to download video files"
fi

###############################################################################
# Configuration Files
###############################################################################
print_header "Configuration Files"

if [ -f ".env" ]; then
    check_pass ".env file exists"
    
    # Check for key variables
    if grep -q "AZURE_SPEECH_KEY" .env && ! grep -q "your_azure_speech_key_here" .env; then
        check_pass "Azure Speech Key configured"
    else
        check_warn "Azure Speech Key not configured" "Edit .env file"
    fi
    
    if grep -q "AZURE_SPEECH_REGION" .env && ! grep -q "your_azure_region_here" .env; then
        check_pass "Azure Speech Region configured"
    else
        check_warn "Azure Speech Region not configured" "Edit .env file"
    fi
    
    if grep -q "FLASK_SECRET_KEY" .env && ! grep -q "your_secret_key_here" .env; then
        check_pass "Flask Secret Key configured"
    else
        check_warn "Flask Secret Key not configured" "Edit .env file"
    fi
else
    check_fail ".env file missing" "Create from template or run install script"
fi

# Check .gitignore
if [ -f ".gitignore" ]; then
    if grep -q ".env" .gitignore; then
        check_pass ".env is in .gitignore"
    else
        check_warn ".env not in .gitignore" "Add to prevent credential leaks"
    fi
fi

###############################################################################
# Frontend Setup
###############################################################################
print_header "Frontend Setup"

if [ -d "frontend" ]; then
    cd frontend
    
    if [ -f "package.json" ]; then
        check_pass "package.json exists"
    else
        check_fail "package.json missing"
    fi
    
    if [ -d "node_modules" ]; then
        check_pass "node_modules directory exists"
    else
        check_fail "node_modules missing" "Run: npm install"
    fi
    
    cd ..
else
    check_fail "frontend directory missing"
fi

###############################################################################
# Database (Optional)
###############################################################################
print_header "Database (Optional)"

if command_exists psql; then
    check_pass "PostgreSQL client installed"
else
    check_warn "PostgreSQL not found" "Install if using database features"
fi

if [ -f "database_schema.sql" ]; then
    check_pass "Database schema file exists"
else
    check_warn "database_schema.sql not found"
fi

###############################################################################
# Final Summary
###############################################################################
print_header "Verification Summary"

echo "Total Checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
echo -e "${YELLOW}Warnings: $WARNING_CHECKS${NC}"
echo -e "${RED}Failed: $FAILED_CHECKS${NC}"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    if [ $WARNING_CHECKS -eq 0 ]; then
        echo -e "${GREEN}✓ All checks passed! Your installation is complete.${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Configure your .env file if not already done"
        echo "  2. Download large files if warnings indicated"
        echo "  3. Start backend: python app.py"
        echo "  4. Start frontend: cd frontend && npm start"
    else
        echo -e "${YELLOW}⚠ Installation mostly complete with some warnings.${NC}"
        echo ""
        echo "Review warnings above and address as needed."
    fi
else
    echo -e "${RED}✗ Installation incomplete. Please address failed checks above.${NC}"
    echo ""
    echo "Common solutions:"
    echo "  - Run the install.sh script"
    echo "  - Manually install missing dependencies"
    echo "  - Check documentation for specific issues"
    exit 1
fi

echo ""
echo "For detailed setup instructions, see SETUP_CHECKLIST.md"
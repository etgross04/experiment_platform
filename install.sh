#!/bin/bash

###############################################################################
# Cognitive Science Experiment Platform - Installation Script
# For macOS (Apple Silicon/Intel)
# Python 3.11.4 Required
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_section() {
    echo ""
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo ""
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Python version
check_python_version() {
    local python_cmd=$1
    local version=$($python_cmd --version 2>&1 | awk '{print $2}')
    local major=$(echo $version | cut -d. -f1)
    local minor=$(echo $version | cut -d. -f2)
    local patch=$(echo $version | cut -d. -f3)
    
    if [ "$major" -eq 3 ] && [ "$minor" -eq 11 ]; then
        echo "$python_cmd"
        return 0
    fi
    return 1
}

###############################################################################
# STEP 1: Check Prerequisites
###############################################################################
print_section "STEP 1: Checking Prerequisites"

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS. Exiting."
    exit 1
fi
print_success "Running on macOS"

# Check for Homebrew
if ! command_exists brew; then
    print_warning "Homebrew not found. Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH (for Apple Silicon)
    if [[ $(uname -m) == 'arm64' ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
else
    print_success "Homebrew is installed"
fi

# Update Homebrew
print_info "Updating Homebrew..."
brew update

# Check for Python 3.11.4
print_info "Checking for Python 3.11..."
PYTHON_CMD=""

if command_exists python3.11; then
    if PYTHON_CMD=$(check_python_version python3.11); then
        print_success "Found Python 3.11 at: $PYTHON_CMD"
    fi
elif command_exists python3; then
    if PYTHON_CMD=$(check_python_version python3); then
        print_success "Found Python 3.11 at: $PYTHON_CMD"
    fi
fi

if [ -z "$PYTHON_CMD" ]; then
    print_warning "Python 3.11 not found. Installing Python 3.11..."
    brew install python@3.11
    PYTHON_CMD="python3.11"
    
    # Verify installation
    if ! command_exists $PYTHON_CMD; then
        print_error "Failed to install Python 3.11. Please install manually."
        exit 1
    fi
fi

print_success "Using Python: $PYTHON_CMD ($($PYTHON_CMD --version))"

# Check for Node.js
if ! command_exists node; then
    print_warning "Node.js not found. Installing Node.js..."
    brew install node
else
    print_success "Node.js is installed ($(node --version))"
fi

# Check for npm
if ! command_exists npm; then
    print_error "npm not found. Please install Node.js manually."
    exit 1
else
    print_success "npm is installed ($(npm --version))"
fi

###############################################################################
# STEP 2: Install System Dependencies
###############################################################################
print_section "STEP 2: Installing System Dependencies"

# Install HDF5 (required for h5py)
print_info "Installing HDF5..."
if brew list hdf5 &>/dev/null; then
    print_success "HDF5 already installed"
else
    brew install hdf5
    print_success "HDF5 installed"
fi

# Install Lab Streaming Layer (LSL)
print_info "Installing Lab Streaming Layer..."
if brew list lsl &>/dev/null; then
    print_success "LSL already installed"
else
    brew tap labstreaminglayer/tap
    brew install lsl
    print_success "LSL installed"
fi

# Install PortAudio (for PyAudio)
print_info "Installing PortAudio..."
if brew list portaudio &>/dev/null; then
    print_success "PortAudio already installed"
else
    brew install portaudio
    print_success "PortAudio installed"
fi

# Install FFmpeg (for audio processing)
print_info "Installing FFmpeg..."
if brew list ffmpeg &>/dev/null; then
    print_success "FFmpeg already installed"
else
    brew install ffmpeg
    print_success "FFmpeg installed"
fi

###############################################################################
# STEP 3: Setup Python Environment
###############################################################################
print_section "STEP 3: Setting Up Python Environment"

# Export HDF5 path for h5py compilation
print_info "Setting HDF5 path for h5py..."
export HDF5_DIR=$(brew --prefix hdf5)
export DYLD_LIBRARY_PATH=/opt/homebrew/lib:$DYLD_LIBRARY_PATH
print_success "HDF5_DIR set to: $HDF5_DIR"

# Add to shell profile for persistence
SHELL_PROFILE=""
if [ -f ~/.zshrc ]; then
    SHELL_PROFILE=~/.zshrc
elif [ -f ~/.bash_profile ]; then
    SHELL_PROFILE=~/.bash_profile
fi

if [ -n "$SHELL_PROFILE" ]; then
    if ! grep -q "DYLD_LIBRARY_PATH=/opt/homebrew/lib" "$SHELL_PROFILE"; then
        print_info "Adding DYLD_LIBRARY_PATH to $SHELL_PROFILE..."
        echo '' >> "$SHELL_PROFILE"
        echo '# Lab Streaming Layer library path' >> "$SHELL_PROFILE"
        echo 'export DYLD_LIBRARY_PATH=/opt/homebrew/lib:$DYLD_LIBRARY_PATH' >> "$SHELL_PROFILE"
        print_success "Added LSL library path to $SHELL_PROFILE"
    fi
fi

# Create virtual environment (optional but recommended)
print_info "Do you want to create a virtual environment? (recommended) [y/N]"
read -r CREATE_VENV

if [[ "$CREATE_VENV" =~ ^[Yy]$ ]]; then
    print_info "Creating virtual environment..."
    $PYTHON_CMD -m venv venv
    source venv/bin/activate
    print_success "Virtual environment created and activated"
    PYTHON_CMD="python"  # Use venv python
fi

# Upgrade pip
print_info "Upgrading pip..."
$PYTHON_CMD -m pip install --upgrade pip

###############################################################################
# STEP 4: Install Python Dependencies
###############################################################################
print_section "STEP 4: Installing Python Dependencies"

# Install h5py with no-cache-dir to avoid issues
print_info "Installing h5py..."
$PYTHON_CMD -m pip install --no-cache-dir h5py
print_success "h5py installed"

# Install pylsl
print_info "Installing pylsl..."
$PYTHON_CMD -m pip install pylsl
print_success "pylsl installed"

# Check if requirements.txt exists
if [ ! -f "requirements.txt" ]; then
    print_error "requirements.txt not found in current directory"
    print_info "Please ensure you're running this script from the project root"
    exit 1
fi

# Install from requirements.txt
print_info "Installing Python packages from requirements.txt..."
$PYTHON_CMD -m pip install -r requirements.txt
print_success "Python packages installed"

# Install additional required packages explicitly
print_info "Installing additional required packages..."
$PYTHON_CMD -m pip install flask flask-cors werkzeug
print_success "Flask and dependencies installed"

###############################################################################
# STEP 5: Setup Frontend
###############################################################################
print_section "STEP 5: Setting Up Frontend"

if [ ! -d "frontend" ]; then
    print_error "frontend directory not found"
    exit 1
fi

cd frontend

print_info "Installing npm packages..."
npm install
print_success "npm packages installed"

cd ..

###############################################################################
# STEP 6: Create Required Directories
###############################################################################
print_section "STEP 6: Creating Required Directories"

# Create directories if they don't exist
directories=("recordings" "logs")

for dir in "${directories[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        print_success "Created directory: $dir"
    else
        print_info "Directory already exists: $dir"
    fi
done

# Ensure static directory exists (for video_files)
if [ ! -d "static" ]; then
    mkdir -p static
    print_success "Created directory: static"
else
    print_info "Directory already exists: static"
fi

# Note about large files
print_info "Note: SER_MODEL and video_files directories will be created when you run download_assets.sh"

###############################################################################
# STEP 7: Environment Configuration
###############################################################################
print_section "STEP 7: Environment Configuration"

# Check for .env file
if [ ! -f ".env" ]; then
    print_warning ".env file not found"
    print_info "Creating template .env file..."
    
    cat > .env << 'EOF'
# Azure Speech Services Configuration
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=your_azure_region_here

# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=experiment_platform
DATABASE_USER=your_db_user
DATABASE_PASSWORD=your_db_password

# Flask Configuration
FLASK_SECRET_KEY=your_secret_key_here
FLASK_ENV=development

# Application Settings
UPLOAD_FOLDER=uploads
MAX_CONTENT_LENGTH=16777216

# Optional: EmotiBit Configuration
EMOTIBIT_HOST=localhost
EMOTIBIT_PORT=12345
EOF
    
    print_success "Created .env template"
    print_warning "Please edit .env file with your actual credentials"
else
    print_success ".env file already exists"
fi

###############################################################################
# STEP 8: Verify Installation
###############################################################################
print_section "STEP 8: Verifying Installation"

# Check if timestamp_manager.cpython-311-darwin.so exists
if [ -f "timestamp_manager.cpython-311-darwin.so" ]; then
    print_success "Custom .so binary found"
else
    print_warning "timestamp_manager.cpython-311-darwin.so not found"
    print_info "This file may need to be compiled separately"
fi

# Test imports
print_info "Testing Python imports..."
$PYTHON_CMD -c "import flask; import h5py; import pylsl; print('Core imports successful')" 2>/dev/null
if [ $? -eq 0 ]; then
    print_success "Python imports verified"
else
    print_warning "Some Python imports failed. Check the output above."
fi

###############################################################################
# STEP 9: Download Instructions for Large Files
###############################################################################
print_section "STEP 9: Large Files Setup"

print_info "This application requires large files that are not in the repository:"
echo ""
echo "  From Google Drive (XRLAB_assets folder):"
echo ""
echo "  1. SER_MODEL/ - Speech Emotion Recognition model"
echo "     Location: Project root"
echo ""
echo "  2. video_files/ - Experiment video stimuli"
echo "     Location: static/ directory"
echo ""
echo "  Note: Audio files are already included in the GitHub repository"
echo ""
print_warning "Run download_assets.sh to automatically download these files"
echo ""
echo "  ${BLUE}chmod +x download_assets.sh${NC}"
echo "  ${BLUE}./download_assets.sh${NC}"

###############################################################################
# Final Summary
###############################################################################
print_section "Installation Complete!"

echo ""
echo "Next steps:"
echo ""
echo "1. Edit the .env file with your credentials:"
echo "   ${BLUE}nano .env${NC}"
echo ""
echo "2. Download required large files (see DOWNLOAD_INSTRUCTIONS.md)"
echo ""
echo "3. Set up the database (see DATABASE_SETUP.md)"
echo ""
echo "4. Start the backend server:"
echo "   ${BLUE}$PYTHON_CMD app.py${NC}"
echo ""
echo "5. In a new terminal, start the frontend:"
echo "   ${BLUE}cd frontend && npm start${NC}"
echo ""
echo "6. Access the application at:"
echo "   ${GREEN}http://localhost:3000${NC}"
echo ""

if [[ "$CREATE_VENV" =~ ^[Yy]$ ]]; then
    echo "Remember to activate the virtual environment:"
    echo "   ${BLUE}source venv/bin/activate${NC}"
    echo ""
fi

print_success "Installation script completed successfully!"
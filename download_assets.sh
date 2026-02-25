#!/bin/bash

###############################################################################
# Automated Asset Download Script
# Downloads required large files for the Experiment Platform
###############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

###############################################################################
# Configuration - UPDATE THESE URLS WITH YOUR ACTUAL DOWNLOAD LINKS
###############################################################################

# Google Drive FOLDER ID for XRLAB_assets folder
# The folder contains:
#   - SER_MODEL/ (goes to project root)
#   - video_files/ (goes to static/)
XRLAB_ASSETS_GDRIVE_FOLDER_ID="10L7AO1jPkkMPqgkulPt6-DRRbhxkg_fk"

# Alternative: Direct URL to zip file (Dropbox, OneDrive, S3, etc.)
XRLAB_ASSETS_URL="https://your-storage-service.com/path/to/XRLAB_assets.zip"

###############################################################################
# Download Method Selection
###############################################################################

DOWNLOAD_METHOD="gdrive_folder"  # Options: "gdrive_folder" or "direct_zip"

###############################################################################
# Functions
###############################################################################

check_command() {
    if ! command -v $1 &> /dev/null; then
        return 1
    fi
    return 0
}

verify_checksum() {
    local file=$1
    local expected_md5=$2
    
    # Only verify if checksum is provided and file exists
    if [ ! -f "$file" ]; then
        return 0
    fi
    
    if [ -z "$expected_md5" ] || [ "$expected_md5" == "expected_md5_checksum_here" ]; then
        return 0
    fi
    
    print_info "Verifying checksum for $file..."
    local actual_md5=$(md5 -q "$file" 2>/dev/null || md5sum "$file" 2>/dev/null | awk '{print $1}')
    
    if [ "$actual_md5" == "$expected_md5" ]; then
        print_success "Checksum verified"
        return 0
    else
        print_error "Checksum mismatch! Expected: $expected_md5, Got: $actual_md5"
        return 1
    fi
}

download_gdrive_folder() {
    local folder_id=$1
    local folder_name=$2
    
    if ! check_command gdown; then
        print_info "Installing gdown..."
        pip install gdown
    fi
    
    print_info "Downloading Google Drive folder: $folder_name"
    print_warning "This may take a while depending on folder size..."
    gdown --folder "https://drive.google.com/drive/folders/$folder_id" -O "$folder_name"
}

download_direct() {
    local url=$1
    local output=$2
    
    print_info "Downloading from $url"
    curl -L "$url" -o "$output" --progress-bar
}

extract_archive() {
    local archive=$1
    local destination=$2
    
    print_info "Extracting $archive to $destination..."
    
    # Create destination directory if it doesn't exist
    mkdir -p "$destination"
    
    # Determine archive type and extract
    if [[ "$archive" == *.zip ]]; then
        if check_command unzip; then
            unzip -q "$archive" -d "$destination"
        else
            print_error "unzip not found. Please install it."
            return 1
        fi
    elif [[ "$archive" == *.tar.gz ]] || [[ "$archive" == *.tgz ]]; then
        tar -xzf "$archive" -C "$destination"
    elif [[ "$archive" == *.tar ]]; then
        tar -xf "$archive" -C "$destination"
    else
        print_error "Unsupported archive format: $archive"
        return 1
    fi
    
    print_success "Extraction complete"
}

###############################################################################
# Main Download Process
###############################################################################

print_info "Starting download of large assets..."
echo ""

# Check if files already exist
SKIP_DOWNLOAD=false

if [ -d "SER_MODEL" ] && [ "$(ls -A SER_MODEL 2>/dev/null)" ]; then
    print_warning "SER_MODEL directory already exists and is not empty"
    read -p "Do you want to re-download? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        SKIP_DOWNLOAD=true
    fi
fi

if [ -d "static/video_files" ] && [ "$(ls -A static/video_files 2>/dev/null)" ]; then
    if [ "$SKIP_DOWNLOAD" = false ]; then
        print_warning "static/video_files directory already exists and is not empty"
        read -p "Do you want to re-download? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            SKIP_DOWNLOAD=true
        fi
    fi
fi

if [ "$SKIP_DOWNLOAD" = true ]; then
    print_info "Skipping download - files already present"
    print_success "All large files already available"
    exit 0
fi

###############################################################################
# Download XRLAB Assets
###############################################################################

echo ""
print_info "===== Downloading XRLAB Assets ====="
print_info "This includes:"
print_info "  - SER_MODEL/ (Speech Emotion Recognition model)"
print_info "  - video_files/ (Experiment video stimuli)"
echo ""

# Download based on method
if [ "$DOWNLOAD_METHOD" == "gdrive_folder" ]; then
    # Download the entire folder from Google Drive
    download_gdrive_folder "$XRLAB_ASSETS_GDRIVE_FOLDER_ID" "XRLAB_assets"
    
elif [ "$DOWNLOAD_METHOD" == "direct_zip" ]; then
    # Download zip file and extract
    download_direct "$XRLAB_ASSETS_URL" "XRLAB_assets.zip"
    
    print_info "Extracting XRLAB_assets.zip..."
    mkdir -p XRLAB_assets
    extract_archive "XRLAB_assets.zip" "."
    rm XRLAB_assets.zip
fi

# Check the structure and move files to correct locations
print_info "Organizing files to correct locations..."

# Handle SER_MODEL
if [ -d "XRLAB_assets/SER_MODEL" ]; then
    print_info "Moving SER_MODEL to project root..."
    rm -rf SER_MODEL 2>/dev/null || true
    mv XRLAB_assets/SER_MODEL .
    print_success "SER_MODEL placed in project root"
else
    print_error "SER_MODEL directory not found in XRLAB_assets folder!"
    print_info "Contents of XRLAB_assets:"
    ls -la XRLAB_assets/
fi

# Handle video_files
if [ -d "XRLAB_assets/video_files" ]; then
    print_info "Moving video_files to static/..."
    mkdir -p static
    rm -rf static/video_files 2>/dev/null || true
    mv XRLAB_assets/video_files static/
    print_success "video_files placed in static/"
else
    print_error "video_files directory not found in XRLAB_assets folder!"
    print_info "Contents of XRLAB_assets:"
    ls -la XRLAB_assets/
fi

# Cleanup
print_info "Cleaning up temporary files..."
rm -rf XRLAB_assets

print_success "XRLAB assets downloaded and organized successfully"

###############################################################################
# Verify Installation
###############################################################################

echo ""
print_info "===== Verifying Installation ====="

VERIFICATION_FAILED=false

# Check SER_MODEL directory
if [ -d "SER_MODEL" ] && [ "$(ls -A SER_MODEL)" ]; then
    print_success "SER_MODEL directory exists and contains files"
    echo "  Contents:"
    ls -lh SER_MODEL/ | tail -n +2 | head -5 | awk '{print "    " $9 " (" $5 ")"}'
    FILE_COUNT=$(find SER_MODEL -type f | wc -l | tr -d ' ')
    if [ "$FILE_COUNT" -gt 5 ]; then
        echo "    ... and $((FILE_COUNT - 5)) more files"
    fi
else
    print_error "SER_MODEL directory is missing or empty"
    VERIFICATION_FAILED=true
fi

# Check video_files directory
if [ -d "static/video_files" ] && [ "$(ls -A static/video_files)" ]; then
    print_success "static/video_files directory exists and contains files"
    FILE_COUNT=$(find static/video_files -type f | wc -l | tr -d ' ')
    echo "  Total video files: $FILE_COUNT"
    
    # Show size
    if command -v du &> /dev/null; then
        TOTAL_SIZE=$(du -sh static/video_files | awk '{print $1}')
        echo "  Total size: $TOTAL_SIZE"
    fi
else
    print_error "static/video_files directory is missing or empty"
    VERIFICATION_FAILED=true
fi

# Note about audio files
echo ""
print_info "Note: Audio files are included in the GitHub repository"

###############################################################################
# Final Summary
###############################################################################

echo ""
if [ "$VERIFICATION_FAILED" = true ]; then
    print_error "Some files failed to download or extract"
    print_info "Please check the error messages above and try again"
    exit 1
else
    print_success "All large files downloaded and verified successfully!"
    echo ""
    echo "You can now proceed with running the application:"
    echo "  1. Ensure your .env file is configured"
    echo "  2. Run: python app.py"
    echo "  3. In another terminal, run: cd frontend && npm start"
fi
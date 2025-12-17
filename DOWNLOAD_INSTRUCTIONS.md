# Download Instructions for Large Files

This document provides multiple methods for distributing and downloading the large files required by the Experiment Platform that cannot be hosted on GitHub due to size constraints.

## Required Large Files

The repository already includes all audio files needed for experiments. However, the following large assets must be downloaded separately:

### 1. SER_MODEL (Speech Emotion Recognition Model)
- **Location**: Project root directory
- **Size**: Estimated several hundred MB to 1+ GB
- **Contents**: 
  - Model weights file(s)
  - Model architecture/config files
  - Label mappings
  - Preprocessing parameters

### 2. video_files (Video Stimuli)
- **Location**: `static/video_files/` directory
- **Size**: Varies depending on video content
- **Contents**: 
  - Experimental video stimuli
  - Baseline recordings
  - Calibration videos

### Package Structure
Both folders are contained in a master folder called **XRLAB_assets**:
```
XRLAB_assets/
├── SER_MODEL/           # → Extract to project root
│   ├── model files
│   └── configs
└── video_files/         # → Extract to static/
    └── video files
```

**Note:** Audio files are already included in the GitHub repository and do not need to be downloaded separately.

---

## Distribution Methods

### Method 1: Cloud Storage Services (Recommended)

#### Option A: Google Drive

**Advantages:**
- Free for up to 15GB
- Familiar interface
- Direct download links
- Version control through Drive

**Setup Steps:**
1. Upload files to a shared Google Drive folder
2. Set sharing permissions to "Anyone with the link can view"
3. Get shareable link
4. Provide download instructions

**User Download Instructions:**
```bash
# Install gdown for easy Google Drive downloads
pip install gdown

# Download XRLAB_assets (replace FILE_ID with your actual file ID)
gdown https://drive.google.com/uc?id=FILE_ID -O XRLAB_assets.zip

# Extract and organize
unzip XRLAB_assets.zip

# Move to correct locations
mv XRLAB_assets/SER_MODEL .
mv XRLAB_assets/video_files static/

# Cleanup
rm -rf XRLAB_assets XRLAB_assets.zip
```

#### Option B: Dropbox

**Advantages:**
- Free for up to 2GB (16GB with referrals)
- Simple sharing mechanism
- Good for larger files with paid plan

**Setup Steps:**
1. Upload files to Dropbox
2. Create shared link
3. Modify link to force download (change `dl=0` to `dl=1` in URL)

**User Download Instructions:**
```bash
# Using curl
curl -L "https://www.dropbox.com/s/LINK_ID/XRLAB_assets.zip?dl=1" -o XRLAB_assets.zip

# Extract and organize
unzip XRLAB_assets.zip
mv XRLAB_assets/SER_MODEL .
mv XRLAB_assets/video_files static/
rm -rf XRLAB_assets XRLAB_assets.zip
```

#### Option C: Microsoft OneDrive

**Advantages:**
- Free 5GB storage
- Good integration with Microsoft ecosystem
- Reliable downloads

**User Download Instructions:**
```bash
# Use curl with OneDrive share link
curl -L "YOUR_ONEDRIVE_SHARE_LINK" -o XRLAB_assets.zip

# Extract and organize
unzip XRLAB_assets.zip
mv XRLAB_assets/SER_MODEL .
mv XRLAB_assets/video_files static/
```

---

### Method 2: Git LFS (Git Large File Storage)

**Advantages:**
- Keeps files in the repository workflow
- Version control for large files
- Transparent to users after setup

**Note:** For this project, Git LFS may not be ideal due to the size of video files and bandwidth limitations.

**Setup Steps:**

1. Install Git LFS:
```bash
brew install git-lfs
git lfs install
```

2. Track large files:
```bash
git lfs track "SER_MODEL/**"
git lfs track "static/video_files/**"
git lfs track "*.h5"
git lfs track "*.mp4"
git lfs track "*.avi"
```

3. Add and commit:
```bash
git add .gitattributes
git add SER_MODEL/ static/video_files/
git commit -m "Add large files via Git LFS"
git push
```

**User Download Instructions:**
```bash
# Clone with LFS files
git lfs clone https://github.com/brn-cntrl/experiment_platform.git

# Or if already cloned
git lfs pull
```

**Note:** GitHub provides 1GB of free LFS storage and 1GB/month bandwidth. Paid plans available for more.

---

### Method 3: Self-Hosted Server

**Advantages:**
- Full control
- No third-party limitations
- Can integrate with existing infrastructure

**Setup Options:**

#### Option A: Simple HTTP Server
```bash
# Using Python
cd /path/to/large/files
python -m http.server 8000

# Files accessible at http://your-server-ip:8000
```

#### Option B: nginx/Apache
- Set up a proper web server
- Configure directory listing or download page
- Can add authentication if needed

**User Download Instructions:**
```bash
# Download from your server
curl -O http://your-server.com/downloads/XRLAB_assets.zip

# Extract and organize
unzip XRLAB_assets.zip
mv XRLAB_assets/SER_MODEL .
mv XRLAB_assets/video_files static/
```

---

### Method 4: Torrent/P2P Distribution

**Advantages:**
- Distributed bandwidth
- No central server costs
- Fast for multiple simultaneous users

**Setup Steps:**
1. Create torrent file using BitTorrent client
2. Host torrent file on GitHub repository
3. Seed the files

**User Download Instructions:**
```bash
# Using transmission-cli
brew install transmission-cli
transmission-cli your_files.torrent

# Or use any BitTorrent client
```

---

### Method 5: Academic/Research Data Repositories

**Advantages:**
- Designed for research data
- Citable DOIs
- Long-term preservation
- Often no size limits

**Recommended Services:**

#### Zenodo
- Free, unlimited storage for datasets up to 50GB
- DOI assignment
- Version control
- https://zenodo.org/

#### OSF (Open Science Framework)
- Free storage
- Integration with research workflow
- https://osf.io/

#### Figshare
- Free up to 20GB private, unlimited public
- DOI assignment
- https://figshare.com/

**User Download Instructions:**
```bash
# Example for Zenodo (replace with actual DOI)
curl -L "https://zenodo.org/record/RECORD_ID/files/XRLAB_assets.zip" -o XRLAB_assets.zip

# Extract and organize
unzip XRLAB_assets.zip
mv XRLAB_assets/SER_MODEL .
mv XRLAB_assets/video_files static/
```

---

### Method 6: AWS S3 / Azure Blob Storage

**Advantages:**
- Scalable
- Pay-per-use
- Professional-grade reliability
- Can be configured for public access

**Setup Steps:**
1. Create S3 bucket (or Azure container)
2. Upload XRLAB_assets.zip
3. Configure public read access or generate signed URLs
4. Provide download instructions

**User Download Instructions:**
```bash
# AWS S3 (public bucket)
aws s3 cp s3://your-bucket/XRLAB_assets.zip . --no-sign-request

# Or using curl
curl -O https://your-bucket.s3.amazonaws.com/XRLAB_assets.zip

# Extract and organize
unzip XRLAB_assets.zip
mv XRLAB_assets/SER_MODEL .
mv XRLAB_assets/video_files static/
```

---

## Automated Download Script

The `download_assets.sh` script automates the download and organization process:

```bash
#!/bin/bash

# Download Assets Script
# This script downloads all required large files

set -e

echo "Downloading XRLAB assets..."

# Method: Google Drive example
echo "Downloading from Google Drive..."
gdown https://drive.google.com/uc?id=YOUR_FILE_ID -O XRLAB_assets.zip

echo "Extracting files..."
unzip -q XRLAB_assets.zip

echo "Organizing files..."
mv XRLAB_assets/SER_MODEL .
mkdir -p static
mv XRLAB_assets/video_files static/

echo "Cleaning up..."
rm -rf XRLAB_assets XRLAB_assets.zip

echo "Download complete!"
echo "  ✓ SER_MODEL placed in project root"
echo "  ✓ video_files placed in static/"
```

---

## Recommendation

**For Most Users (Small Team/Academic):**
- **Primary:** Google Drive with `gdown` for automated downloads
- **Backup:** Zenodo for long-term archival with DOI

**For Large-Scale Deployment:**
- **Primary:** AWS S3 or Azure Blob Storage with CDN
- **Backup:** Git LFS for version control

**For Open Source Projects:**
- **Primary:** Zenodo or OSF for discoverability
- **Secondary:** GitHub Releases for smaller files (<2GB)

---

## File Verification

After downloading, verify file integrity:

```bash
# Generate checksum (do this once when creating the distribution)
md5 XRLAB_assets.zip > XRLAB_assets.zip.md5

# Users can verify with:
md5 -c XRLAB_assets.zip.md5
```

Include checksum files in your repository or distribution method.

**Verify correct extraction:**
```bash
# Check SER_MODEL
ls -lh SER_MODEL/

# Check video_files
ls -lh static/video_files/
```

---

## Update to README.md

Add this section to your README.md:

```markdown
## Large Files Setup

This application requires large files from Google Drive (XRLAB_assets folder):

1. **SER_MODEL**: Download and extract to project root
2. **video_files**: Download and extract to `static/` directory

**Note:** Audio files are already included in the repository.

**Automated Download:**
```bash
bash download_assets.sh
```

**Manual Download:**
1. Download XRLAB_assets.zip from [Google Drive link]
2. Extract: `unzip XRLAB_assets.zip`
3. Move files:
   ```bash
   mv XRLAB_assets/SER_MODEL .
   mv XRLAB_assets/video_files static/
   ```

See [DOWNLOAD_INSTRUCTIONS.md](DOWNLOAD_INSTRUCTIONS.md) for detailed instructions.
```

---

## Support and Questions

Users having trouble downloading files can:
1. Check your internet connection
2. Verify the download links are active
3. Try an alternative download method
4. Contact the maintainer via GitHub Issues

---

## License Considerations

Ensure your large files comply with:
- Data sharing agreements
- Privacy regulations
- Copyright restrictions
- Institutional policies

Consider adding a separate LICENSE file for data assets if different from code license.
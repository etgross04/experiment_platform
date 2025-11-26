# PostgreSQL Database Setup Guide

This guide will help you set up the PostgreSQL database for the Experiment Platform.

## Prerequisites

- PostgreSQL 12 or higher
- Terminal/Command Line access

---

## 1. Install PostgreSQL

### macOS
```bash
# Using Homebrew
brew install postgresql@16
brew services start postgresql@16
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Windows
Download and install from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)

---

## 2. Access PostgreSQL

### macOS/Linux
```bash
# Switch to postgres user and open psql
sudo -u postgres psql
```

### Windows
Open "SQL Shell (psql)" from Start Menu

---

## 3. Create Database and User

Run these commands in the `psql` prompt:
```sql
-- Create the database
CREATE DATABASE exp_platform_db;

-- Create the user with password
CREATE USER exp_user WITH PASSWORD 'your_secure_password_here';

-- Grant privileges on the database
GRANT ALL PRIVILEGES ON DATABASE exp_platform_db TO exp_user;

-- Connect to the database
\c exp_platform_db

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO exp_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO exp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO exp_user;

-- Exit psql
\q
```

**Important**: Replace `'your_secure_password_here'` with a strong password.

---

## 4. Run the Database Schema

Navigate to your project directory and run:
```bash
psql -U exp_user -d exp_platform_db -f database_schema.sql
```

You will be prompted for the password you set in step 3.

**Expected output**: You should see `CREATE TABLE` and `CREATE INDEX` messages for each table and index, followed by `CREATE VIEW` at the end.

---

## 5. Configure Environment Variables

Create a `.env` file in your project root directory:
```bash
# Database Configuration
DB_HOST=localhost
DB_NAME=exp_platform_db
DB_USER=exp_user
DB_PASSWORD=your_secure_password_here
DB_PORT=5432
```

**Important**: 
- Replace `your_secure_password_here` with the password from step 3
- Add `.env` to your `.gitignore` to keep credentials secure
- Never commit `.env` to version control

---

## 6. Verify Installation

### Check tables exist:
```bash
psql -U exp_user -d exp_platform_db
```
```sql
-- List all tables
\dt

-- You should see:
-- experiments
-- event_markers
-- respiratory_data
-- cardiac_data
-- audio_transcription_data
-- ser_data
-- emotibit_data

-- Check the unified view
\dv

-- You should see:
-- unified_sensor_data

-- Exit
\q
```

---

## 7. Troubleshooting

### "Connection refused" error
```bash
# Check if PostgreSQL is running
# macOS
brew services list

# Linux
sudo systemctl status postgresql

# Start if not running
# macOS
brew services start postgresql@16

# Linux
sudo systemctl start postgresql
```

### "Peer authentication failed" error
Edit `pg_hba.conf`:
```bash
# Find the file location
psql -U postgres -c "SHOW hba_file;"

# Edit the file (use sudo if needed)
sudo nano /path/to/pg_hba.conf
```

Change:
```
local   all   all   peer
```

To:
```
local   all   all   md5
```

Then restart PostgreSQL:
```bash
# macOS
brew services restart postgresql@16

# Linux
sudo systemctl restart postgresql
```

### "Permission denied" errors
Grant additional permissions:
```bash
psql -U postgres -d exp_platform_db
```
```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO exp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO exp_user;
\q
```

---

## 8. Database Schema Overview

The database includes the following tables:

- **experiments**: Metadata about experiment sessions
- **event_markers**: Timestamped event markers during experiments
- **respiratory_data**: Vernier respiratory sensor data
- **cardiac_data**: Polar H10 heart rate data
- **audio_transcription_data**: Audio recordings and transcriptions
- **ser_data**: Speech Emotion Recognition analysis results
- **emotibit_data**: EmotiBit biometric sensor data (all metrics)
- **unified_sensor_data** (view): Combined view of all sensor data for analysis

---

## 9. Optional: Enable Remote Connections

If you need to connect from another machine:

### Edit postgresql.conf
```bash
# Find config file
psql -U postgres -c "SHOW config_file;"

# Edit (use sudo if needed)
sudo nano /path/to/postgresql.conf
```

Change:
```
listen_addresses = 'localhost'
```

To:
```
listen_addresses = '*'
```

### Edit pg_hba.conf
Add this line:
```
host   exp_platform_db   exp_user   0.0.0.0/0   md5
```

Restart PostgreSQL after making changes.

---

## Support

If you encounter issues not covered in this guide, please:
1. Check PostgreSQL logs for detailed error messages
2. Verify your PostgreSQL version is 12 or higher
3. Ensure all dependencies are installed
4. Open an issue on GitHub with error details

---

## Next Steps

After completing this setup:
1. Start the Flask backend server
2. Test the database connection using the "Push to Database" feature
3. Verify data uploads correctly from the experiment interface
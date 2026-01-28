#!/bin/bash

# AskNostr Automated Deployment Script
# Supports: Debian/Ubuntu based systems
# Features: Dependencies, Build, Systemd, Caddy Reverse Proxy (SSL)

set -e

# Configuration
APP_NAME="asknostr"
INSTALL_DIR="/opt/$APP_NAME"
SERVICE_NAME="$APP_NAME.service"
DEFAULT_PORT=3000
CADDY_FILE="/etc/caddy/Caddyfile"
LOG_DIR="/var/log/$APP_NAME"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper Functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_err "This script must be run as root"
        exit 1
    fi
}

install_dependencies() {
    log_info "Checking system dependencies..."
    
    # Update package list
    apt-get update -q

    # Install Git, Curl, Unzip
    apt-get install -y -q git curl unzip

    # Install Node.js (v20) if not present
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js v20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -q nodejs
    else
        log_info "Node.js is already installed: $(node -v)"
    fi

    # Install 'serve' globally for static file serving
    if ! command -v serve &> /dev/null; then
        log_info "Installing 'serve' package..."
        npm install -g serve
    fi
}

install_caddy() {
    if ! command -v caddy &> /dev/null; then
        log_info "Installing Caddy Web Server..."
        apt-get install -y -q debian-keyring debian-archive-keyring apt-transport-https
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
        apt-get update -q
        apt-get install -y -q caddy
    else
        log_info "Caddy is already installed."
    fi
}

setup_app() {
    log_info "Setting up application..."

    # Create user if not exists
    if ! id "$APP_NAME" &>/dev/null; then
        useradd -r -s /bin/false $APP_NAME
    fi

    # Create Install Dir if not exists (if running from outside)
    if [ ! -d "$INSTALL_DIR" ]; then
        log_info "Cloning repository to $INSTALL_DIR..."
        git clone https://github.com/dskvr/asknostr.git "$INSTALL_DIR"
    fi

    # Set permissions
    chown -R $APP_NAME:$APP_NAME "$INSTALL_DIR"
    
    # Create Log Dir
    mkdir -p "$LOG_DIR"
    chown -R $APP_NAME:$APP_NAME "$LOG_DIR"

    # Build
    cd "$INSTALL_DIR"
    log_info "Installing NPM dependencies..."
    # Switch to user to avoid root-owned node_modules issues, but do it carefully
    # For simplicity in this script, we run as root but allow root for npm
    npm ci --unsafe-perm
    
    log_info "Building project..."
    npm run build
}

setup_systemd() {
    log_info "Configuring Systemd Service..."
    
    cat > /etc/systemd/system/$SERVICE_NAME <<EOF
[Unit]
Description=AskNostr Client Service
After=network.target

[Service]
Type=simple
User=$APP_NAME
WorkingDirectory=$INSTALL_DIR
ExecStart=$(which serve) -s dist -p $DEFAULT_PORT
Restart=always
RestartSec=3
StandardOutput=append:$LOG_DIR/access.log
StandardError=append:$LOG_DIR/error.log

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable $SERVICE_NAME
    systemctl restart $SERVICE_NAME
    log_info "Systemd service started."
}

setup_reverse_proxy() {
    log_info "Configuring Caddy Reverse Proxy..."
    
    read -p "Enter your domain name (e.g., asknostr.com): " DOMAIN_NAME
    read -p "Enter your email for SSL (Let's Encrypt): " SSL_EMAIL

    if [ -z "$DOMAIN_NAME" ]; then
        log_warn "No domain provided. Skipping Caddy setup."
        return
    fi

    # Backup existing Caddyfile
    if [ -f "$CADDY_FILE" ]; then
        cp "$CADDY_FILE" "$CADDY_FILE.bak"
    fi

    # Write Caddyfile
    cat > "$CADDY_FILE" <<EOF
$DOMAIN_NAME {
    tls $SSL_EMAIL
    reverse_proxy localhost:$DEFAULT_PORT
    
    log {
        output file /var/log/caddy/asknostr_access.log {
            roll_size 10mb
            roll_keep 5
        }
    }
}
EOF

    systemctl restart caddy
    log_info "Caddy configured and restarted. Your site should be live at https://$DOMAIN_NAME"
}

update_app() {
    log_info "Updating AskNostr..."
    cd "$INSTALL_DIR"
    
    # Git operations as the app user to avoid permission issues? 
    # Or just fix permissions after.
    git reset --hard
    git pull origin main
    
    # Version Tagging (Local)
    NEW_VER=$(grep '"version":' package.json | cut -d '"' -f 4)
    log_info "Updated to version: $NEW_VER"
    
    # Rebuild
    npm ci --unsafe-perm
    npm run build
    
    # Restart Service
    systemctl restart $SERVICE_NAME
    
    # Fix permissions again just in case
    chown -R $APP_NAME:$APP_NAME "$INSTALL_DIR"
    
    log_info "Update complete!"
}

# Main Menu
check_root

echo -e "${GREEN}AskNostr Installer${NC}"
echo "1. Fresh Install"
echo "2. Update Existing"
echo "3. Exit"
read -p "Choose an option: " OPTION

case $OPTION in
    1)
        install_dependencies
        setup_app
        setup_systemd
        install_caddy
        setup_reverse_proxy
        ;;
    2)
        if [ -d "$INSTALL_DIR" ]; then
            update_app
        else
            log_err "Installation directory $INSTALL_DIR not found. Cannot update."
        fi
        ;;
    3)
        exit 0
        ;;
    *)
        log_err "Invalid option"
        exit 1
        ;;
esac

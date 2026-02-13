#!/bin/bash
#
# HexaScan Agent Installer
#
# Usage: curl -sSL https://your-server.com/install.sh | sudo bash -s -- --api-key YOUR_API_KEY
#
# Options:
#   --api-key KEY     API key for the agent (required)
#   --endpoint URL    API endpoint (default: http://localhost:3000/api/v1)
#   --name NAME       Agent name (default: hostname)
#   --user USER       User to run the agent as (default: hexascan-agent)
#   --no-service      Don't install systemd service
#   --uninstall       Uninstall the agent
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
API_KEY=""
ENDPOINT="http://localhost:3000/api/v1"
AGENT_NAME=$(hostname)
SERVICE_USER="hexascan-agent"
INSTALL_SERVICE=true
UNINSTALL=false

# Installation paths
INSTALL_DIR="/opt/hexascan-agent"
CONFIG_DIR="/etc/hexascan-agent"
LOG_DIR="/var/log/hexascan-agent"
VENV_DIR="${INSTALL_DIR}/venv"

# Log functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --api-key)
                API_KEY="$2"
                shift 2
                ;;
            --endpoint)
                ENDPOINT="$2"
                shift 2
                ;;
            --name)
                AGENT_NAME="$2"
                shift 2
                ;;
            --user)
                SERVICE_USER="$2"
                shift 2
                ;;
            --no-service)
                INSTALL_SERVICE=false
                shift
                ;;
            --uninstall)
                UNINSTALL=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# Check system requirements
check_requirements() {
    log_info "Checking system requirements..."

    # Check Python 3
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is required but not installed"
        log_info "Install with: apt install python3 python3-pip python3-venv"
        exit 1
    fi

    PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    log_info "Found Python ${PYTHON_VERSION}"

    # Check pip
    if ! python3 -m pip --version &> /dev/null; then
        log_error "pip is required but not installed"
        log_info "Install with: apt install python3-pip"
        exit 1
    fi

    # Check venv
    if ! python3 -m venv --help &> /dev/null; then
        log_error "python3-venv is required but not installed"
        log_info "Install with: apt install python3-venv"
        exit 1
    fi
}

# Create service user
create_user() {
    if id "${SERVICE_USER}" &>/dev/null; then
        log_info "User ${SERVICE_USER} already exists"
    else
        log_info "Creating user ${SERVICE_USER}..."
        useradd --system --no-create-home --shell /bin/false "${SERVICE_USER}"
    fi
}

# Create directories
create_directories() {
    log_info "Creating directories..."

    mkdir -p "${INSTALL_DIR}"
    mkdir -p "${CONFIG_DIR}"
    mkdir -p "${LOG_DIR}"

    chown "${SERVICE_USER}:${SERVICE_USER}" "${LOG_DIR}"
    chmod 755 "${LOG_DIR}"
}

# Install Python package
install_package() {
    log_info "Creating virtual environment..."
    python3 -m venv "${VENV_DIR}"

    log_info "Installing dependencies..."
    "${VENV_DIR}/bin/pip" install --upgrade pip
    "${VENV_DIR}/bin/pip" install requests pyyaml psutil cryptography mysql-connector-python

    # Try to install Playwright (optional - for browser-based checks)
    log_info "Attempting to install Playwright (optional for browser checks)..."
    if "${VENV_DIR}/bin/pip" install playwright 2>/dev/null; then
        log_info "Playwright installed successfully"

        # Install system dependencies for Chromium
        log_info "Installing Playwright browser dependencies..."
        if command -v apt-get &> /dev/null; then
            apt-get install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
                libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
                libxfixes3 libxrandr2 libgbm1 libasound2 2>/dev/null || true
        fi

        log_info "Installing Chromium browser for Playwright..."
        # Create shared browser directory accessible by the agent user
        mkdir -p "${INSTALL_DIR}/.playwright-browsers"
        chown "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}/.playwright-browsers"

        # Install Chromium browser as the service user so it's in the right location
        export PLAYWRIGHT_BROWSERS_PATH="${INSTALL_DIR}/.playwright-browsers"
        sudo -u "${SERVICE_USER}" PLAYWRIGHT_BROWSERS_PATH="${INSTALL_DIR}/.playwright-browsers" \
            "${VENV_DIR}/bin/python" -m playwright install chromium 2>/dev/null || log_warn "Chromium install deferred to first run"
    else
        log_warn "Playwright not available for this Python version - browser checks will be disabled"
        log_info "Agent will work normally for all other check types"
    fi

    log_info "Installing hexascan-agent package..."
    # In production, this would install from PyPI or a package URL
    # For now, we'll copy the local files

    # Create package structure
    mkdir -p "${INSTALL_DIR}/hexascan_agent"

    # Copy files (in production, this would be a pip install)
    if [[ -d "/tmp/hexascan-agent-src" ]]; then
        cp -r /tmp/hexascan-agent-src/hexascan_agent/* "${INSTALL_DIR}/hexascan_agent/"
    else
        log_warn "Source files not found, skipping package installation"
        log_info "Run: pip install hexascan-agent (when published to PyPI)"
    fi
}

# Create configuration
create_config() {
    log_info "Creating configuration..."

    # Write API key
    echo "${API_KEY}" > "${CONFIG_DIR}/api_key"
    chmod 600 "${CONFIG_DIR}/api_key"
    chown "${SERVICE_USER}:${SERVICE_USER}" "${CONFIG_DIR}/api_key"

    # Write config file
    cat > "${CONFIG_DIR}/agent.yaml" << EOF
# HexaScan Agent Configuration
# Generated by install.sh on $(date)

agent:
  name: "${AGENT_NAME}"
  version: "1.0.0"

api:
  endpoint: "${ENDPOINT}"
  api_key_source: "file"
  api_key_file: "${CONFIG_DIR}/api_key"
  poll_interval: 60
  timeout: 30
  verify_ssl: true

permissions:
  level: "read_only"
  allowed_paths:
    - "/var/log"
    - "/var/www"
  denied_paths:
    - "/etc/shadow"
    - "/root/.ssh"

checks:
  system:
    disk:
      enabled: true
      warning_threshold: 80
      critical_threshold: 90
    cpu:
      enabled: true
      warning_threshold: 80
      critical_threshold: 95
    memory:
      enabled: true
      warning_threshold: 85
      critical_threshold: 95

logging:
  level: "INFO"
  file: "${LOG_DIR}/agent.log"
  max_size_mb: 10
  backup_count: 5
EOF

    chown "${SERVICE_USER}:${SERVICE_USER}" "${CONFIG_DIR}/agent.yaml"
    chmod 644 "${CONFIG_DIR}/agent.yaml"
}

# Create systemd service
create_service() {
    if [[ "${INSTALL_SERVICE}" != true ]]; then
        log_info "Skipping systemd service installation"
        return
    fi

    log_info "Creating systemd service..."

    cat > /etc/systemd/system/hexascan-agent.service << EOF
[Unit]
Description=HexaScan Monitoring Agent
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
Environment="PLAYWRIGHT_BROWSERS_PATH=${INSTALL_DIR}/.playwright-browsers"
ExecStart=${VENV_DIR}/bin/python -m hexascan_agent.agent -c ${CONFIG_DIR}/agent.yaml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=hexascan-agent

# Security settings
NoNewPrivileges=false
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=true
ReadWritePaths=${LOG_DIR}
ReadWritePaths=${INSTALL_DIR}/.playwright-browsers

[Install]
WantedBy=multi-user.target
EOF

    log_info "Reloading systemd..."
    systemctl daemon-reload

    log_info "Enabling service..."
    systemctl enable hexascan-agent

    log_info "Starting service..."
    systemctl start hexascan-agent

    # Check if service started successfully
    sleep 2
    if systemctl is-active --quiet hexascan-agent; then
        log_info "Service started successfully"
    else
        log_warn "Service may not have started correctly. Check: journalctl -u hexascan-agent"
    fi
}

# Uninstall
uninstall() {
    log_info "Uninstalling HexaScan agent..."

    # Stop and disable service
    if systemctl is-active --quiet hexascan-agent 2>/dev/null; then
        log_info "Stopping service..."
        systemctl stop hexascan-agent
    fi

    if systemctl is-enabled --quiet hexascan-agent 2>/dev/null; then
        log_info "Disabling service..."
        systemctl disable hexascan-agent
    fi

    # Remove service file
    if [[ -f /etc/systemd/system/hexascan-agent.service ]]; then
        log_info "Removing service file..."
        rm /etc/systemd/system/hexascan-agent.service
        systemctl daemon-reload
    fi

    # Remove directories
    if [[ -d "${INSTALL_DIR}" ]]; then
        log_info "Removing installation directory..."
        rm -rf "${INSTALL_DIR}"
    fi

    if [[ -d "${LOG_DIR}" ]]; then
        log_info "Removing log directory..."
        rm -rf "${LOG_DIR}"
    fi

    # Ask about config
    read -p "Remove configuration files in ${CONFIG_DIR}? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "${CONFIG_DIR}"
        log_info "Configuration removed"
    else
        log_info "Configuration preserved at ${CONFIG_DIR}"
    fi

    # Don't remove user as it might be used elsewhere
    log_warn "User ${SERVICE_USER} was not removed. Remove manually if needed: userdel ${SERVICE_USER}"

    log_info "Uninstallation complete"
}

# Main installation
install() {
    log_info "Installing HexaScan agent..."
    log_info "API Endpoint: ${ENDPOINT}"
    log_info "Agent Name: ${AGENT_NAME}"

    if [[ -z "${API_KEY}" ]]; then
        log_error "API key is required. Use --api-key YOUR_KEY"
        exit 1
    fi

    check_requirements
    create_user
    create_directories
    install_package
    create_config
    create_service

    echo ""
    log_info "============================================"
    log_info "HexaScan agent installed successfully!"
    log_info "============================================"
    echo ""
    log_info "Configuration: ${CONFIG_DIR}/agent.yaml"
    log_info "Logs: ${LOG_DIR}/agent.log"
    echo ""
    log_info "Useful commands:"
    echo "  systemctl status hexascan-agent  # Check status"
    echo "  systemctl restart hexascan-agent # Restart agent"
    echo "  journalctl -u hexascan-agent -f  # View logs"
    echo ""
}

# Main
main() {
    check_root
    parse_args "$@"

    if [[ "${UNINSTALL}" == true ]]; then
        uninstall
    else
        install
    fi
}

main "$@"

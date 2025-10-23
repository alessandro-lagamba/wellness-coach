#!/bin/bash

# Setup Environment Variables for Wellness Coach
# This script copies API keys from the existing Neurotracer system

set -e

echo "🔧 Setting up Wellness Coach environment variables..."

# Paths
EXISTING_BACKEND_ENV="/Users/alelagamba/Desktop/Neurotracer/neuro_tracer/backend/.env"
EXISTING_FRONTEND_ENV="/Users/alelagamba/Desktop/Neurotracer/neuro_tracer/frontend/.env"
NEW_BACKEND_ENV="./backend/.env"
NEW_MOBILE_ENV="./mobile/.env"
NEW_WEB_ENV="./web/.env"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "mobile" ] || [ ! -d "backend" ]; then
    echo "❌ Please run this script from the WellnessCoach root directory"
    exit 1
fi

# Function to extract value from env file
extract_env_value() {
    local file=$1
    local key=$2
    if [ -f "$file" ]; then
        grep "^$key=" "$file" | cut -d'=' -f2- | tr -d '"'
    fi
}

# Create backend .env
echo "📝 Creating backend .env..."
cat > "$NEW_BACKEND_ENV" << EOF
# Wellness Coach Backend Environment Variables
# Auto-generated from existing Neurotracer configuration

# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:8081

# OpenAI Configuration
OPENAI_API_KEY=$(extract_env_value "$EXISTING_BACKEND_ENV" "OPENAI_API_KEY")

# Cartesia TTS Configuration
CARTESIA_API_KEY=$(extract_env_value "$EXISTING_BACKEND_ENV" "CARTESIA_API_KEY")

# AWS Configuration (for Polly TTS fallback)
AWS_ACCESS_KEY_ID=$(extract_env_value "$EXISTING_BACKEND_ENV" "AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY=$(extract_env_value "$EXISTING_BACKEND_ENV" "AWS_SECRET_ACCESS_KEY_ID")
AWS_REGION=$(extract_env_value "$EXISTING_BACKEND_ENV" "AWS_REGION")

# Simli Configuration
SIMLI_API_KEY=$(extract_env_value "$EXISTING_BACKEND_ENV" "SIMLI_API_KEY")
SIMLI_BASE_URL=https://api.simli.com
SIMLI_DEFAULT_AVATAR_ID=d2a5c7c6-fed9-4f55-bcb3-062f7cd20103

# Ready Player Me Configuration
RPM_KEY=$(extract_env_value "$EXISTING_BACKEND_ENV" "RPM_KEY")
RPM_SUBDOMAIN=$(extract_env_value "$EXISTING_BACKEND_ENV" "RPM_SUBDOMAIN")

# A2E Configuration
A2E_API_KEY=$(extract_env_value "$EXISTING_BACKEND_ENV" "A2E_API_KEY")
A2E_BASE_URL=$(extract_env_value "$EXISTING_BACKEND_ENV" "A2E_BASE_URL")
A2E_DEFAULT_LANG=$(extract_env_value "$EXISTING_BACKEND_ENV" "A2E_DEFAULT_LANG")

# Wellness Coach Specific (to be configured)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# External APIs for Wellness Features (to be configured)
WEATHER_API_KEY=your_openweathermap_key
NUTRITION_API_KEY=your_nutrition_api_key

# Security
JWT_SECRET=wellness_coach_jwt_secret_change_in_production
ENCRYPTION_KEY=change_this_32_char_encryption_key

# Feature Flags
ENABLE_EMOTION_COACHING=true
ENABLE_SKIN_RECOMMENDATIONS=true
ENABLE_BIOMETRIC_ANALYSIS=false
ENABLE_ENVIRONMENTAL_DATA=false
EOF

# Create mobile .env
echo "📱 Creating mobile .env..."
cat > "$NEW_MOBILE_ENV" << EOF
# Wellness Coach Mobile App Environment Variables
# SECURE: No API keys exposed - all handled by backend

# Backend API
EXPO_PUBLIC_API_URL=http://localhost:3001

# Avatar Configuration (no API keys - handled by backend)
# All avatar services use secure token-based authentication

# App Configuration
EXPO_PUBLIC_ENVIRONMENT=development
EXPO_PUBLIC_LOG_LEVEL=debug

# Feature Flags
EXPO_PUBLIC_ENABLE_EMOTION_DETECTION=true
EXPO_PUBLIC_ENABLE_SKIN_ANALYSIS=true
EXPO_PUBLIC_ENABLE_BIOMETRIC_INTEGRATION=false
EXPO_PUBLIC_ENABLE_3D_AVATAR=false

# Privacy Settings
EXPO_PUBLIC_DATA_RETENTION_DAYS=30
EXPO_PUBLIC_ENABLE_ANALYTICS=false
EXPO_PUBLIC_ENABLE_CRASH_REPORTING=true

# Performance Settings
EXPO_PUBLIC_EMOTION_DETECTION_INTERVAL=500
EXPO_PUBLIC_SKIN_ANALYSIS_QUALITY=medium
EOF

# Create web .env (for future)
echo "🌐 Creating web .env..."
mkdir -p web
cat > "$NEW_WEB_ENV" << EOF
# Wellness Coach Web App Environment Variables
# SECURE: No API keys exposed - all handled by backend

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001

# Avatar Configuration (no API keys - handled by backend)
# All avatar services use secure token-based authentication

# App Configuration
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_APP_VERSION=0.1.0

# Feature Flags
NEXT_PUBLIC_ENABLE_EMOTION_DETECTION=true
NEXT_PUBLIC_ENABLE_BASIC_SKIN_ANALYSIS=true
NEXT_PUBLIC_ENABLE_ADVANCED_SKIN_ANALYSIS=false
NEXT_PUBLIC_ENABLE_3D_AVATAR=false

# Privacy
NEXT_PUBLIC_COOKIE_CONSENT_REQUIRED=true
NEXT_PUBLIC_DATA_RETENTION_DAYS=30

# Development
NEXT_PUBLIC_DEBUG_MODE=true
EOF

echo "✅ Environment setup complete!"
echo ""
echo "📋 Summary:"
echo "  - Backend .env: $NEW_BACKEND_ENV"
echo "  - Mobile .env: $NEW_MOBILE_ENV"
echo "  - Web .env: $NEW_WEB_ENV"
echo ""
echo "🔑 API Keys copied:"
echo "  - OpenAI: $([ -n "$(extract_env_value "$EXISTING_BACKEND_ENV" "OPENAI_API_KEY")" ] && echo "✅" || echo "❌")"
echo "  - Cartesia: $([ -n "$(extract_env_value "$EXISTING_BACKEND_ENV" "CARTESIA_API_KEY")" ] && echo "✅" || echo "❌")"
echo "  - Simli: $([ -n "$(extract_env_value "$EXISTING_FRONTEND_ENV" "VITE_SIMLI_API_KEY")" ] && echo "✅" || echo "❌")"
echo "  - AWS: $([ -n "$(extract_env_value "$EXISTING_BACKEND_ENV" "AWS_ACCESS_KEY_ID")" ] && echo "✅" || echo "❌")"
echo "  - RPM: $([ -n "$(extract_env_value "$EXISTING_BACKEND_ENV" "RPM_KEY")" ] && echo "✅" || echo "❌")"
echo ""
echo "⚠️  Still need to configure:"
echo "  - Supabase credentials (database)"
echo "  - Weather API key (OpenWeatherMap)"
echo "  - Other wellness-specific APIs"
echo ""
echo "🚀 Ready to start development!"
EOF

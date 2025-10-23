# API Keys Configuration Guide

This document outlines all the API keys and external services required for the Wellness Coach application.

## 🔑 Available API Keys (From Existing Neurotracer)

Based on the existing Neurotracer system, we have the following API keys already configured:

### ✅ **Ready to Use**

| Service | Key Available | Status | Usage |
|---------|---------------|--------|--------|
| **OpenAI** | ✅ | Active | LLM chat responses, GPT-4o-mini |
| **Cartesia TTS** | ✅ | Active | Primary TTS service, Italian voice |
| **Simli Avatar** | ✅ | Active | Avatar system (web only) |
| **AWS (Polly)** | ✅ | Active | TTS fallback service |
| **Ready Player Me** | ✅ | Active | 3D avatar generation (future) |

### 🔧 **Configuration Details**

#### OpenAI
- **Purpose**: Conversational AI, wellness coaching
- **Model**: GPT-4o-mini
- **Usage**: Chat responses, coaching recommendations
- **Rate Limits**: Standard OpenAI limits

#### Cartesia TTS
- **Purpose**: Primary text-to-speech service
- **Voice**: Liv (Italian female voice)
- **Format**: PCM16 16KHz (Simli compatible)
- **Language**: Italian (it)

#### Simli Avatar
- **Purpose**: Realistic avatar with lip-sync
- **Platform**: Web only (not mobile compatible)
- **Avatar ID**: d2a5c7c6-fed9-4f55-bcb3-062f7cd20103
- **WebSocket**: wss://api.simli.ai

#### AWS Polly
- **Purpose**: TTS fallback service
- **Region**: Italy North (eu-south-1)
- **Voices**: Italian voices available

#### Ready Player Me
- **Purpose**: 3D avatar generation
- **Subdomain**: neurotracer
- **Usage**: Future 3D avatar implementation

## 🚧 **Required for Wellness Features**

The following API keys need to be obtained for full wellness coach functionality:

### **Essential for MVP**

| Service | Purpose | Priority | Cost |
|---------|---------|----------|------|
| **Supabase** | Database, user management | High | Free tier available |
| **OpenWeatherMap** | Weather, UV index | Medium | Free tier: 1000 calls/day |

### **Advanced Features**

| Service | Purpose | Priority | Cost |
|---------|---------|----------|------|
| **Pinecone** | Vector database for RAG | Medium | Free tier: 1M vectors |
| **Google Maps** | Location services | Low | Pay per use |
| **Nutritionix** | Nutrition data | Low | Free tier available |
| **Sentry** | Error tracking | Low | Free tier available |

## 📋 **Setup Instructions**

### 🔒 **SECURITY-FIRST ARCHITECTURE**

**IMPORTANT**: All API keys are stored securely on the backend only. Clients use token-based authentication and proxied requests.

### 1. **Automatic Setup (Recommended)**

Run the setup script to copy existing API keys:

```bash
cd WellnessCoach
chmod +x scripts/setup-env.sh
./scripts/setup-env.sh
```

This will:
- Copy all API keys to backend `.env` (secure)
- Create client `.env` files with NO sensitive data
- Show status of each API key

### 2. **Manual Setup**

#### Backend (.env) - SECURE
```env
# All API keys stored securely on backend
OPENAI_API_KEY=your_openai_key
CARTESIA_API_KEY=your_cartesia_key
SIMLI_API_KEY=your_simli_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
RPM_KEY=your_rpm_key

# New services needed
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Mobile (.env) - NO API KEYS
```env
# SECURE: No API keys exposed
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_ENVIRONMENT=development
# Feature flags only - no secrets
```

#### Web (.env) - NO API KEYS
```env
# SECURE: No API keys exposed
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ENVIRONMENT=development
# Feature flags only - no secrets
```

### 3. **Obtain Missing API Keys**

#### Supabase (Database)
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy URL and anon key
4. Add to backend `.env`

#### OpenWeatherMap (Weather Data)
1. Go to [openweathermap.org](https://openweathermap.org/api)
2. Sign up for free account
3. Get API key
4. Add as `WEATHER_API_KEY`

## 🔒 **Security Best Practices**

### **Environment Files**
- ✅ Never commit `.env` files to git
- ✅ Use `.env.example` files for documentation
- ✅ Rotate keys regularly
- ✅ Use different keys for development/production

### **Key Management**
```bash
# Check if keys are properly loaded
npm run check-env

# Test API connections
npm run test-apis
```

### **Production Deployment**
- Use environment variables in deployment platform
- Never hardcode keys in source code
- Use secrets management services
- Monitor API usage and costs

## 📊 **API Usage Monitoring**

### **Current Usage Estimates**

| Service | Requests/Day | Cost/Month | Limits |
|---------|--------------|------------|--------|
| OpenAI | ~1000 | ~$20 | Rate limited |
| Cartesia | ~500 | ~$10 | Pay per character |
| Simli | ~100 | ~$5 | Session based |
| AWS Polly | ~200 | ~$1 | Pay per character |

### **Monitoring Setup**
```typescript
// Add to shared/src/utils/apiMonitoring.ts
export const trackApiUsage = (service: string, cost: number) => {
  // Log usage for monitoring
  console.log(`[API Usage] ${service}: $${cost}`);
};
```

## 🚨 **Troubleshooting**

### **Common Issues**

#### "API Key Invalid"
1. Check key format (no extra spaces)
2. Verify key is active in service dashboard
3. Check rate limits
4. Ensure key has required permissions

#### "Service Unavailable"
1. Check service status page
2. Verify endpoint URLs
3. Check firewall/proxy settings
4. Try different region if available

#### "Quota Exceeded"
1. Check usage dashboard
2. Upgrade plan if needed
3. Implement caching
4. Add rate limiting

### **Debug Commands**
```bash
# Test backend APIs
cd backend
npm run test-apis

# Check environment variables
npm run check-env

# Validate configuration
npm run validate-config
```

## 📞 **Support Contacts**

### **Service Support**
- **OpenAI**: support@openai.com
- **Cartesia**: support@cartesia.ai
- **Simli**: support@simli.ai
- **Supabase**: support@supabase.io

### **Internal Support**
- Check existing Neurotracer documentation
- Review API service dashboards
- Monitor logs for errors
- Test with minimal examples

## 🔄 **Migration Notes**

### **From Neurotracer to Wellness Coach**
- ✅ All existing API keys are compatible
- ✅ No service interruption required
- ✅ Gradual feature rollout possible
- ✅ Fallback to existing system available

### **Future Considerations**
- Plan for increased usage
- Consider enterprise plans
- Implement cost monitoring
- Add redundancy for critical services

---

**Last Updated**: December 2024  
**Next Review**: January 2025

# Wellness Coach - AI-Powered Holistic Wellness Platform

A comprehensive wellness coaching platform that combines AI-powered conversation, emotion detection, skin analysis, and biometric integration to provide personalized wellness recommendations.

## 🏗️ Architecture

This is a monorepo containing:

- **`mobile/`** - Expo React Native app (iOS, Android, Web)
- **`web/`** - Next.js web companion (future)
- **`backend/`** - Node.js API server (extends existing Neurotracer backend)
- **`shared/`** - Shared types, utilities, and services

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)

### Installation

```bash
# Clone and install dependencies
cd WellnessCoach
npm install

# Install dependencies for all packages
npm run install:all
```

### Development

```bash
# Start all services in development mode
npm run dev

# Or start individually:
npm run dev:mobile     # Expo mobile app
npm run dev:backend    # Node.js API server
npm run dev:web        # Next.js web app (future)
```

### Mobile Development

```bash
cd mobile

# Start Expo development server
npm run dev

# Run on specific platforms
npm run ios      # iOS Simulator
npm run android  # Android Emulator
npm run web      # Web browser
```

## 📱 Features

### Current (MVP)

- ✅ **Avatar System**: Generic wrapper supporting Simli, 3D avatars, and placeholders
- ✅ **Emotion Detection**: Real-time facial emotion analysis
- ✅ **Basic Skin Analysis**: Brightness, uniformity, redness detection
- ✅ **AI Chat**: GPT-4 powered wellness coaching with context awareness
- ✅ **TTS Integration**: Cartesia and OpenAI text-to-speech
- ✅ **Privacy-First**: On-device processing with consent management

### Planned (Future Phases)

- 🔄 **Advanced Skin Analysis**: Hydration, acne, aging markers (ML models)
- 🔄 **Biometric Integration**: HealthKit (iOS) and Google Fit (Android)
- 🔄 **Environmental Data**: Weather, UV index, air quality
- 🔄 **3D Avatar**: React Three Fiber + Ready Player Me
- 🔄 **Product Recommendations**: Affiliate integration
- 🔄 **Social Features**: Progress sharing and community

## 🏛️ Technical Stack

### Mobile (Expo)
- **Framework**: Expo SDK 51 + React Native 0.74
- **Navigation**: Expo Router (file-based)
- **State Management**: Zustand + React Query
- **ML**: MediaPipe, Core ML (iOS), ML Kit (Android)
- **Camera**: react-native-vision-camera
- **Storage**: SQLite + Expo Secure Store

### Web (Future)
- **Framework**: Next.js 14
- **UI**: Tailwind CSS + Shadcn/ui
- **ML**: TensorFlow.js + MediaPipe Web

### Backend
- **Framework**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4, Cartesia TTS
- **ML**: Custom models + external APIs

### Shared
- **Types**: Zod schemas for validation
- **API Clients**: Adapters for existing services
- **Utils**: Privacy management, coaching rules

## 📂 Project Structure

```
WellnessCoach/
├── mobile/                          # Expo React Native App
│   ├── app/                         # Expo Router pages
│   │   ├── (tabs)/
│   │   │   ├── index.tsx           # Home (Avatar + Chat)
│   │   │   ├── analysis.tsx        # Emotion + Skin Analysis
│   │   │   └── profile.tsx         # User Profile
│   │   └── _layout.tsx             # Root layout with providers
│   ├── components/
│   │   ├── avatar/                 # Avatar system
│   │   │   ├── AvatarBox.tsx       # Generic wrapper (factory)
│   │   │   ├── SimliAvatar.tsx     # Simli integration
│   │   │   ├── PlaceholderAvatar.tsx # Animated placeholder
│   │   │   └── ThreeAvatar.tsx     # 3D avatar (future)
│   │   ├── analysis/               # Analysis components
│   │   ├── chat/                   # Chat interface
│   │   └── ui/                     # Reusable UI components
│   ├── contexts/                   # React contexts
│   ├── hooks/                      # Custom hooks
│   ├── services/                   # Mobile-specific services
│   └── types/                      # Mobile-specific types
│
├── web/                            # Next.js Web App (future)
│   ├── app/                        # Next.js 14 app directory
│   ├── components/                 # Web-specific components
│   └── lib/                        # Web utilities
│
├── backend/                        # Node.js API Server
│   ├── src/
│   │   ├── controllers/            # API controllers
│   │   ├── services/               # Business logic
│   │   ├── routes/                 # API routes
│   │   └── types/                  # Backend types
│   └── dist/                       # Compiled JavaScript
│
└── shared/                         # Shared Package
    ├── src/
    │   ├── types/                  # Shared TypeScript types
    │   │   ├── privacy.ts          # Privacy contracts
    │   │   ├── emotion.ts          # Emotion detection
    │   │   ├── skin.ts             # Skin analysis
    │   │   └── avatar.ts           # Avatar system
    │   ├── api-client/             # API adapters
    │   │   ├── llm.ts              # LLM integration
    │   │   └── tts.ts              # TTS integration
    │   ├── avatar/                 # Avatar services
    │   │   └── lightLipSync.ts     # Lip-sync service
    │   └── utils/                  # Shared utilities
    └── dist/                       # Compiled package
```

## 🔧 Configuration

### Environment Variables

Create `.env` files in each package:

#### `mobile/.env`
```env
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_SIMLI_API_KEY=your_simli_key
EXPO_PUBLIC_ENVIRONMENT=development
```

#### `backend/.env`
```env
PORT=3001
OPENAI_API_KEY=your_openai_key
CARTESIA_API_KEY=your_cartesia_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### Avatar Configuration

The app uses a flexible avatar system. Configure in `mobile/app/(tabs)/index.tsx`:

```typescript
// Choose avatar type based on platform and needs
const avatarConfig = {
  type: Platform.OS === 'web' ? 'simli' : 'placeholder',
  settings: {
    placeholder: {
      style: 'animated',
      color: '#6366f1',
      size: 200,
    },
    simli: {
      sessionToken: 'your_session_token',
      voice: 'liv',
      language: 'it',
    }
  }
};
```

## 🔒 Security & Privacy Architecture

The app implements security-first and privacy-first design:

### 🛡️ Security Model

**ZERO API KEYS ON CLIENT**: All sensitive API keys are stored securely on the backend only.

- **Backend**: Holds all API keys (OpenAI, Cartesia, Simli, AWS, etc.)
- **Mobile/Web**: NO API keys exposed, uses token-based authentication
- **Communication**: All external API calls proxied through secure backend endpoints

### 🔐 Secure Endpoints

```typescript
// Secure avatar endpoints (no client API keys)
GET  /api/avatar/simli/token     // Get ephemeral token
POST /api/avatar/simli/speak     // Proxy speech request
GET  /api/avatar/status          // Check service availability

// Secure TTS endpoints (no client API keys)  
POST /api/tts/synthesize         // Proxy TTS request
GET  /api/tts/voices            // Get available voices
```

### 🔒 Data Classification

1. **On-Device Only** (never leaves device):
   - Raw images and video frames
   - Face detection results
   - ML model outputs
   - Biometric data from HealthKit/Google Fit

2. **Backend Data** (with user consent):
   - Chat conversation history
   - Wellness goals and preferences
   - Aggregated progress metrics

3. **Encrypted Local Storage**:
   - User wellness profile
   - Analysis history (aggregated)
   - Achievements and gamification data

### Consent Management

Users can granularly control what data is shared:

```typescript
const consentSettings = {
  dataSharing: {
    chatHistory: false,        // Keep conversations private
    progressMetrics: true,     // Share for better coaching
    wellnessGoals: true,       // Share goals with coach
  },
  analytics: {
    usageStatistics: false,    // No usage tracking
    crashReports: true,        // Help improve the app
  }
};
```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run tests for specific package
npm run test:mobile
npm run test:backend
npm run test:shared

# Run linting
npm run lint

# Type checking
npm run type-check
```

## 📦 Building

### Mobile

```bash
cd mobile

# Build for development
npm run build

# Build for production
npm run build:android  # Android APK/AAB
npm run build:ios      # iOS IPA
```

### Backend

```bash
cd backend

# Build TypeScript
npm run build

# Start production server
npm run start
```

## 🚀 Deployment

### Mobile Deployment

```bash
# Using Expo Application Services (EAS)
npx eas build --platform all
npx eas submit --platform all
```

### Backend Deployment

The backend can be deployed to any Node.js hosting service:

- **Railway**: `railway deploy`
- **Vercel**: `vercel deploy`
- **Heroku**: `git push heroku main`
- **DigitalOcean App Platform**

## 🛠️ Development Workflow

### Adding New Features

1. **Define Types** in `shared/src/types/`
2. **Create Services** in `shared/src/` for cross-platform logic
3. **Implement Mobile UI** in `mobile/components/`
4. **Add API Endpoints** in `backend/src/controllers/`
5. **Update Tests** and documentation

### Avatar System Extension

To add a new avatar type:

1. Create avatar component in `mobile/components/avatar/`
2. Implement `AvatarDriver` interface
3. Add configuration to `shared/src/types/avatar.ts`
4. Update factory in `AvatarBox.tsx`

### ML Model Integration

1. Add model files to `mobile/assets/models/`
2. Create service in `mobile/services/ml/`
3. Define types in `shared/src/types/`
4. Implement privacy-compliant data flow

## 🐛 Troubleshooting

### Common Issues

**Metro bundler issues:**
```bash
cd mobile
npx expo start --clear
```

**TypeScript errors in shared package:**
```bash
cd shared
npm run build
```

**Avatar not loading:**
- Check platform compatibility (Simli = web only)
- Verify API keys in environment variables
- Check network connectivity

**Emotion detection not working:**
- Ensure camera permissions granted
- Check MediaPipe model loading
- Verify face-api.js models in assets

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Follow code style guidelines
4. Add tests for new features
5. Update documentation
6. Submit pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Existing Neurotracer Backend**: Foundation for LLM and TTS integration
- **Simli**: Avatar technology (web platform)
- **MediaPipe**: Face detection and analysis
- **OpenAI**: GPT-4 language model
- **Cartesia**: High-quality TTS synthesis
- **Expo**: Cross-platform mobile development

## 📞 Support

For support and questions:

- **Documentation**: Check this README and inline code comments
- **Issues**: Create GitHub issues for bugs and feature requests
- **Discussions**: Use GitHub Discussions for general questions

---

**Built with ❤️ for holistic wellness coaching**

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Avatar } from './Avatar';
import { BottomNavigation } from './BottomNavigation';
import { BACKEND_URL } from '../constants/env';

const { width, height } = Dimensions.get('window');

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

export const HeroHomeScreen: React.FC = () => {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Benvenuto! Sono Yachai, il tuo coach per il benessere. Posso aiutarti con:',
      isUser: false,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [isConnected, setIsConnected] = useState(true);

  const sendMessage = async () => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: message,
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');

    try {
      // 🔥 FIX: Ottieni la lingua dell'utente
      const { getUserLanguage } = await import('../services/language.service');
      const userLanguage = await getUserLanguage();

      const response = await fetch(`${BACKEND_URL}/api/chat/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          sessionId: 'mobile-app',
          userContext: {
            language: userLanguage // 🔥 FIX: Includi la lingua per il backend
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response || 'Mi dispiace, non sono riuscito a processare la tua richiesta.',
          isUser: false,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Mi dispiace, c\'è stato un errore di connessione.',
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleMicPress = () => {
    // TODO: Implement voice recording
    console.log('Mic pressed');
  };

  const features = [
    { icon: '🎭', text: 'Analisi delle emozioni' },
    { icon: '🔬', text: 'Analisi della pelle' },
    { icon: '💬', text: 'Chat testuale e vocale' },
    { icon: '💡', text: 'Consigli personalizzati' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

      {/* Header with Gradient */}
      <LinearGradient
        colors={['#6366f1', '#8b5cf6']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Home</Text>
          <TouchableOpacity style={styles.settingsButton}>
            <FontAwesome name="cog" size={20} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.avatarSection}>
          <Avatar onMicPress={handleMicPress} />
          <Text style={styles.appTitle}>Yachai</Text>
          <View style={styles.connectionStatus}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
            <Text style={styles.statusText}>Connesso</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.emotionButton}>
          <FontAwesome name="camera" size={16} color="white" />
          <Text style={styles.emotionButtonText}>Analizza Emozioni</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Main Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeText}>
            👋 Benvenuto! Sono Yachai, il tuo coach del benessere. Posso aiutarti con:
          </Text>

          <View style={styles.featuresList}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <Text style={styles.featureText}>{feature.text}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.questionText}>Come posso aiutarti oggi?</Text>
          <Text style={styles.timestamp}>{new Date().toLocaleTimeString()}</Text>
        </View>

        {/* Messages */}
        <View style={styles.messagesContainer}>
          {messages.map((msg) => (
            <View key={msg.id} style={[
              styles.messageBubble,
              msg.isUser ? styles.userMessage : styles.aiMessage
            ]}>
              <Text style={[
                styles.messageText,
                msg.isUser ? styles.userMessageText : styles.aiMessageText
              ]}>
                {msg.text}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Input Section */}
      <View style={styles.inputSection}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Scrivi un messaggio..."
            placeholderTextColor="#9ca3af"
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <FontAwesome name="paper-plane" size={16} color="white" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.voiceButton}>
          <FontAwesome name="microphone" size={16} color="white" />
          <Text style={styles.voiceButtonText}>Registra Voce</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 20,
    marginBottom: 8,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
  },
  emotionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    alignSelf: 'center',
  },
  emotionButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  welcomeCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginTop: -20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  welcomeText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 20,
    lineHeight: 24,
  },
  featuresList: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#6b7280',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
  },
  messagesContainer: {
    paddingVertical: 20,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: '#6366f1',
    alignSelf: 'flex-end',
  },
  aiMessage: {
    backgroundColor: '#f1f5f9',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: 'white',
  },
  aiMessageText: {
    color: '#374151',
  },
  inputSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  voiceButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '500',
  },
});

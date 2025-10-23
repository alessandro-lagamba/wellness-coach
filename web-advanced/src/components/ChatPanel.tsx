/**
 * Chat Panel - Right Column  
 * Chat + Wellness Suggestions with TTS/STT integration
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { VoiceChat } from './VoiceChat';
import { ttsService } from '../services/ttsService';

interface ChatPanelProps {
  isConnected: boolean;
  currentEmotion: any;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  emotion?: string;
}

interface WellnessSuggestion {
  id: string;
  title: string;
  description: string;
  icon: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export function ChatPanel({ isConnected, currentEmotion }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<WellnessSuggestion[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Generate wellness suggestions based on emotion
  useEffect(() => {
    if (currentEmotion?.dominantEmotion) {
      generateSuggestions(currentEmotion.dominantEmotion);
    }
  }, [currentEmotion]);

  const generateSuggestions = (emotion: string) => {
    const emotionSuggestions: Record<string, WellnessSuggestion[]> = {
      happiness: [
        { id: '1', title: 'Share Your Joy', description: 'Connect with loved ones', icon: '💝', priority: 'medium' },
        { id: '2', title: 'Gratitude Journal', description: 'Write down 3 things you\'re grateful for', icon: '📝', priority: 'low' }
      ],
      sadness: [
        { id: '3', title: 'Gentle Movement', description: 'Take a 10-minute walk', icon: '🚶‍♀️', priority: 'high' },
        { id: '4', title: 'Reach Out', description: 'Call a friend or family member', icon: '📞', priority: 'urgent' }
      ],
      anger: [
        { id: '5', title: 'Deep Breathing', description: '4-7-8 breathing technique', icon: '🫁', priority: 'urgent' },
        { id: '6', title: 'Cool Down', description: 'Step away and count to 10', icon: '❄️', priority: 'high' }
      ],
      fear: [
        { id: '7', title: 'Grounding Exercise', description: '5-4-3-2-1 sensory technique', icon: '🌱', priority: 'high' },
        { id: '8', title: 'Safe Space', description: 'Find a comfortable, secure environment', icon: '🏠', priority: 'urgent' }
      ],
      neutral: [
        { id: '9', title: 'Mindful Moment', description: 'Take 3 conscious breaths', icon: '🧘‍♀️', priority: 'low' },
        { id: '10', title: 'Hydration Check', description: 'Drink a glass of water', icon: '💧', priority: 'medium' }
      ]
    };

    setSuggestions(emotionSuggestions[emotion] || emotionSuggestions.neutral);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !isConnected || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      timestamp: new Date(),
      emotion: currentEmotion?.dominantEmotion
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // This will use the Next.js proxy to backend
      const response = await fetch('/api/chat/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputText,
          emotionContext: currentEmotion,
          model: 'gpt-4o-mini'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.text || data.message || 'I understand. How can I help you with your wellness today?',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: 'Sorry, I couldn\'t process your message right now. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Handle voice messages - with direct TTS integration like Neurotracer
  const handleVoiceMessage = async (message: string) => {
    if (!message.trim() || !isConnected || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
      emotion: currentEmotion?.dominantEmotion
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          emotionContext: currentEmotion,
          model: 'gpt-4o-mini'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantResponse = data.text || data.message || 'I understand. How can I help you with your wellness today?';
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: assistantResponse,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Use TTS for voice response - like Neurotracer
        console.log('[ChatPanel] Speaking assistant response via TTS');
        await ttsService.speak(assistantResponse, {
          voice: 'azzurra-voice',
          language: 'it',
          onSpeakingStart: () => {
            console.log('[ChatPanel] Assistant started speaking');
            setIsAssistantSpeaking(true);
          },
          onSpeakingEnd: () => {
            console.log('[ChatPanel] Assistant finished speaking');
            setIsAssistantSpeaking(false);
          }
        });

      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Voice chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: 'Sorry, I couldn\'t process your voice message. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    // TODO: Implement speech recognition
    setIsListening(true);
    setTimeout(() => {
      setIsListening(false);
      setInputText('This would be voice input...');
    }, 2000);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-red-500 bg-red-500/10';
      case 'high': return 'border-orange-500 bg-orange-500/10';
      case 'medium': return 'border-yellow-500 bg-yellow-500/10';
      default: return 'border-blue-500 bg-blue-500/10';
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-800/30">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h2 className="text-xl font-semibold text-white mb-2">
          💬 Chat & Suggestions
        </h2>
        <div className="text-sm text-gray-400">
          Personalized wellness coaching
        </div>
      </div>

      {/* Wellness Suggestions */}
      <div className="p-4 border-b border-white/10 bg-black/20">
        <h3 className="text-sm font-medium text-gray-300 mb-3">
          💡 Wellness Suggestions
        </h3>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={`
                p-3 rounded-lg border cursor-pointer transition-colors hover:bg-white/5
                ${getPriorityColor(suggestion.priority)}
              `}
            >
              <div className="flex items-center space-x-2">
                <span className="text-lg">{suggestion.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">
                    {suggestion.title}
                  </div>
                  <div className="text-xs text-gray-400">
                    {suggestion.description}
                  </div>
                </div>
                <div className={`
                  px-2 py-1 rounded text-xs font-medium
                  ${suggestion.priority === 'urgent' ? 'bg-red-500 text-white' :
                    suggestion.priority === 'high' ? 'bg-orange-500 text-white' :
                    suggestion.priority === 'medium' ? 'bg-yellow-500 text-black' :
                    'bg-blue-500 text-white'
                  }
                `}>
                  {suggestion.priority}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">🤖</div>
            <div>Start a conversation with your wellness coach</div>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`
              max-w-xs lg:max-w-md px-4 py-2 rounded-lg
              ${message.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : message.role === 'system'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-gray-700 text-white'
              }
            `}>
              <div className="text-sm">{message.content}</div>
              <div className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
                {message.emotion && (
                  <span className="ml-2">• {message.emotion}</span>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-white px-4 py-2 rounded-lg">
              <div className="text-sm">Thinking...</div>
              <div className="flex space-x-1 mt-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice Chat Input */}
      <div className="border-t border-white/10 bg-black/20">
        <VoiceChat
          onMessage={handleVoiceMessage}
          onStartVoiceChat={() => console.log('Voice chat started')}
          onStopVoiceChat={() => console.log('Voice chat stopped')}
          isAssistantSpeaking={isAssistantSpeaking}
          className="p-4"
        />
      </div>
    </div>
  );
}

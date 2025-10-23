/**
 * Chat Input Component - Replicates Neurotracer behavior
 * - Microphone button always visible (right side)
 * - Send button appears only when typing (left of microphone)
 * - Seamless voice/text input switching
 */

import React, { useState, useRef, useCallback } from 'react';
import { Mic, Send, MicOff } from 'lucide-react';
// Simple className utility function
const cn = (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ');
// Using native textarea instead of shadcn/ui component

interface ChatInputProps {
  onSubmit: (message: string) => void;
  onVoiceModeChange?: (isVoiceMode: boolean) => void;
  isAssistantSpeaking?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSubmit,
  onVoiceModeChange,
  isAssistantSpeaking = false,
  disabled = false,
  placeholder = "Type your message...",
  className
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, []);

  // Handle text input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    adjustHeight();
  };

  // Handle text message send
  const handleSendMessage = useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !disabled) {
      onSubmit(trimmedValue);
      setInputValue('');
      adjustHeight();
    }
  }, [inputValue, disabled, onSubmit, adjustHeight]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle voice mode toggle
  const handleVoiceModeToggle = useCallback(() => {
    if (disabled || isAssistantSpeaking) return;
    
    const newVoiceMode = !isVoiceMode;
    setIsVoiceMode(newVoiceMode);
    onVoiceModeChange?.(newVoiceMode);
    
    // Focus textarea when exiting voice mode
    if (!newVoiceMode && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isVoiceMode, disabled, isAssistantSpeaking, onVoiceModeChange]);

  // Voice mode styles
  const getMicButtonStyle = () => {
    if (disabled || isAssistantSpeaking) {
      return "bg-gray-600 cursor-not-allowed";
    }
    
    return isVoiceMode
      ? "bg-red-500 hover:bg-red-600 animate-pulse"
      : "bg-gray-700 hover:bg-gray-600";
  };

  const getMicIcon = () => {
    if (isAssistantSpeaking) return <MicOff className="w-4 h-4" />;
    return isVoiceMode ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />;
  };

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative">
        {/* Text Input */}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={isVoiceMode ? "Voice mode active..." : placeholder}
          disabled={disabled || isVoiceMode}
          className={cn(
            "w-full min-h-[52px] max-h-[120px] resize-none pr-20 p-3 rounded-lg",
            "bg-gray-800/50 border border-gray-600/50",
            "text-white placeholder:text-gray-400",
            "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none",
            isVoiceMode && "opacity-50"
          )}
          rows={1}
        />

        {/* Button Container */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Send Button - appears only when typing */}
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || disabled}
            className={cn(
              "rounded-full p-2 transition-all duration-200",
              "flex items-center justify-center",
              "w-8 h-8",
              inputValue.trim() && !disabled
                ? "opacity-100 scale-100 bg-blue-500 hover:bg-blue-600 text-white"
                : "opacity-0 scale-95 pointer-events-none"
            )}
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>

          {/* Microphone Button - always visible */}
          <button
            onClick={handleVoiceModeToggle}
            disabled={disabled}
            className={cn(
              "rounded-full p-2 transition-all duration-200",
              "flex items-center justify-center",
              "w-8 h-8 text-white",
              getMicButtonStyle()
            )}
            title={isVoiceMode ? "Stop voice input" : "Start voice input"}
          >
            {getMicIcon()}
          </button>
        </div>
      </div>

      {/* Voice Mode Indicator */}
      {isVoiceMode && (
        <div className="mt-2 flex items-center justify-center">
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-400">
              {isAssistantSpeaking ? "Paused - Assistant speaking" : "Voice mode active"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

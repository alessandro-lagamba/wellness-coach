import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface VideoHeroProps {
  videoUri: any; // Cambiato da string a any per supportare require()
  title: string;
  subtitle: string;
  onPlayPress?: () => void;
  showPlayButton?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  style?: any;
  fallbackImageUri?: string; // Aggiunto per fallback
}

export const VideoHero: React.FC<VideoHeroProps> = ({
  videoUri,
  title,
  subtitle,
  onPlayPress,
  showPlayButton = true,
  autoPlay = false,
  loop = true,
  muted = true,
  style,
  fallbackImageUri,
}) => {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handlePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await videoRef.current.playAsync();
        setIsPlaying(true);
      }
    }
    onPlayPress?.();
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoaded(true);
      if (status.didJustFinish && !loop) {
        setIsPlaying(false);
      }
    } else if (status.error) {
      console.error('❌ Video playback error:', status.error);
    }
  };

  const handleVideoError = (error: any) => {
    console.error('❌ Video loading error:', error);
    console.log('❌ Failed video URI:', videoUri);
    setHasError(true);
  };

  return (
    <View style={[styles.container, style]}>
      {!hasError ? (
        <Video
          ref={videoRef}
          source={videoUri}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={autoPlay}
          isLooping={loop}
          isMuted={muted}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onError={handleVideoError}
        />
      ) : (
        <Image
          source={{ uri: fallbackImageUri || 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80' }}
          style={styles.video}
          resizeMode="cover"
        />
      )}
      
      {/* Overlay gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)']}
        style={styles.overlay}
      />
      
      {/* Content - Text removed for cleaner video experience */}
      <View style={styles.content}>
        
        {showPlayButton && (
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#f0abfc', '#c084fc']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.playButtonGradient}
            >
              <MaterialCommunityIcons
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color="#312e81"
              />
            </LinearGradient>
          </TouchableOpacity>
        )}
        
        {/* Touch overlay per interazione con il video quando non c'è il pulsante */}
        {!showPlayButton && onPlayPress && (
          <TouchableOpacity
            style={styles.touchOverlay}
            onPress={onPlayPress}
            activeOpacity={1}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
    height: 240,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  playButtonGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
});

export default VideoHero;

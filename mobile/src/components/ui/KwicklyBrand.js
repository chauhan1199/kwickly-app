import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

/**
 * Official Kwickly Logo Icon with sleek dark background for maximum contrast
 */
export const KwicklyIcon = ({ size = 36, style }) => {
  return (
    <View style={[styles.iconBox, { width: size, height: size, borderRadius: Math.round(size * 0.28) }, style]}>
      <Image
        source={require('../../assets/logo.png')}
        style={{ width: size * 0.78, height: size * 0.78 }}
        resizeMode="contain"
      />
    </View>
  );
};

/**
 * Standard Kwickly Brand Logo with Wordmark
 */
const KwicklyBrand = ({
  size = 40,
  fontSize = 24,
  layout = 'horizontal',
  isDarkMode = false,
  showTagline = false,
  taglineColor = null
}) => {
  const isVert = layout === 'vertical';

  return (
    <View style={[styles.container, isVert ? styles.vertical : styles.horizontal]}>
      <KwicklyIcon size={size} />
      <View style={[styles.textBlock, isVert && styles.textBlockCenter]}>
        <Text style={[styles.wordmark, { fontSize, color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
          Kwick<Text style={{ color: '#6C47FF' }}>ly</Text>
        </Text>
        {showTagline && (
          <Text style={[styles.tagline, { color: taglineColor || (isDarkMode ? '#94A3B8' : '#64748B') }]}>
            Every Local Services & Products Anytime Near You
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  iconBox: {
    backgroundColor: '#0B0F19',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  horizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vertical: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  textBlock: {
    justifyContent: 'center',
  },
  textBlockCenter: {
    alignItems: 'center',
  },
  wordmark: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});

export default KwicklyBrand;

import React, { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Package } from 'lucide-react-native';
import { getImageUrl } from '../../utils/helpers';

/**
 * Product thumbnail with a real fallback.
 * Shows the product image when it loads; when there is no imageUrl, or the
 * URL fails (e.g. /uploads files lost on an ephemeral disk), it renders a
 * centred placeholder instead of an empty grey box.
 *
 * - iconSize >= 24: Package icon with the product's first letter under it
 * - iconSize  < 24: just the first letter (fits small list thumbnails)
 */
const ProductImage = ({
  imageUrl,
  name,
  style,
  resizeMode = 'contain',
  iconSize = 32,
  isDarkMode = false,
  color = '#6C47FF',
}) => {
  const uri = imageUrl ? getImageUrl(imageUrl) : null;
  const [failed, setFailed] = useState(false);

  // A new URL deserves a fresh attempt
  useEffect(() => { setFailed(false); }, [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={style}
        resizeMode={resizeMode}
        onError={() => setFailed(true)}
      />
    );
  }

  const letter = (name || '').trim().charAt(0).toUpperCase();
  const showIcon = iconSize >= 24 || !letter;

  return (
    <View
      style={[
        style,
        styles.fallback,
        { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
      ]}
      accessibilityLabel={name ? `${name} (no image)` : 'No product image'}
    >
      {showIcon ? <Package size={iconSize} color={color} strokeWidth={1.6} /> : null}
      {letter ? (
        <Text
          style={[
            styles.letter,
            { color, fontSize: showIcon ? Math.max(11, Math.round(iconSize * 0.42)) : Math.max(12, Math.round(iconSize * 0.9)) },
            showIcon && { marginTop: 2 },
          ]}
          numberOfLines={1}
        >
          {letter}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  letter: {
    fontWeight: '800',
  },
});

export default ProductImage;

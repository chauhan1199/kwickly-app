import { useState, useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Hook to provide accurate keyboard visibility and bottom inset
 * for ScrollViews and KeyboardAvoidingViews on both Android and iOS.
 */
export function useKeyboardBottomInset(extraPadding = 24) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const onShow = (e) => {
      const height = e?.endCoordinates?.height || 280;
      setKeyboardVisible(true);
      setKeyboardHeight(height);
    };

    const onHide = () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return {
    keyboardVisible,
    keyboardHeight,
    bottomInset: keyboardVisible ? keyboardHeight + extraPadding : 0,
  };
}

export default useKeyboardBottomInset;

import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import CustomAlert from './CustomAlert';

// Global singleton listener
let alertListener = null;

export const registerAlertListener = (listener) => {
  alertListener = listener;
  return () => {
    alertListener = null;
  };
};

/**
 * Direct programmatic invocation
 */
export const showCustomAlert = ({ title = '', message = '', buttons = [{ text: 'OK' }], type = null, options = {} }) => {
  if (alertListener) {
    alertListener({ title, message, buttons, type, options });
  } else {
    nativeAlert(title, message, buttons, options);
  }
};

export const hideCustomAlert = () => {
  if (alertListener) {
    alertListener(null);
  }
};

// Keep reference to original native Alert.alert
export const nativeAlert = Alert.alert;

/**
 * Monkey-patch Alert.alert so that ANY invocation anywhere in the app
 * (customer, worker, shop, auth, utilities) automatically uses Kwickly's CustomAlert!
 */
export const patchReactNativeAlert = () => {
  if (Alert._kwicklyCustomPatched) return;
  Alert._kwicklyCustomPatched = true;

  Alert.alert = (title, message, buttons, options) => {
    let resolvedButtons = buttons;
    if (!resolvedButtons || (Array.isArray(resolvedButtons) && resolvedButtons.length === 0)) {
      resolvedButtons = [{ text: 'OK' }];
    }
    
    if (alertListener) {
      alertListener({
        title: title || '',
        message: message || '',
        buttons: resolvedButtons,
        type: null, // CustomAlert will auto-detect type
        options: options || {},
      });
    } else {
      nativeAlert(title, message, resolvedButtons, options);
    }
  };
};

// Automatically activate patch on import
patchReactNativeAlert();

/**
 * GlobalAlertModal - Placed once at root inside App.tsx
 */
export const GlobalAlertModal = () => {
  const [alertConfig, setAlertConfig] = useState(null);

  useEffect(() => {
    const unregister = registerAlertListener((config) => {
      setAlertConfig(config);
    });
    return unregister;
  }, []);

  if (!alertConfig) return null;

  const handleButtonPress = (btn) => {
    setAlertConfig(null);
    if (btn && typeof btn.onPress === 'function') {
      setTimeout(() => {
        try {
          btn.onPress();
        } catch (e) {
          console.warn('[GlobalAlert] Button onPress error:', e);
        }
      }, 80);
    }
  };

  const handleRequestClose = () => {
    const cancelBtn = alertConfig.buttons?.find(b => b.style === 'cancel');
    setAlertConfig(null);
    if (cancelBtn && typeof cancelBtn.onPress === 'function') {
      setTimeout(() => {
        try {
          cancelBtn.onPress();
        } catch (e) {
          console.warn('[GlobalAlert] Cancel onPress error:', e);
        }
      }, 80);
    }
  };

  return (
    <CustomAlert
      visible={true}
      title={alertConfig.title}
      message={alertConfig.message}
      type={alertConfig.type}
      buttons={alertConfig.buttons}
      onRequestClose={handleRequestClose}
      onButtonPress={handleButtonPress}
    />
  );
};

export default GlobalAlertModal;

import api from '../services/api';

export const getImageUrl = (url) => {
  if (!url) return null;
  
  if (!url.includes('/') && !url.startsWith('http')) return null;
  
  let serverUrl = 'http://10.0.2.2:5000';
  if (api.defaults && api.defaults.baseURL) {
    serverUrl = api.defaults.baseURL.replace('/api/v1', '');
  }
  
  let finalUrl = url;
  if (url.startsWith('/')) {
    finalUrl = `${serverUrl}${url}`;
  } else {
    const hostMatch = serverUrl.match(/https?:\/\/([^\/:]+)/);
    if (hostMatch && hostMatch[1]) {
      finalUrl = url.replace(/(localhost|127\.0\.0\.1)/, hostMatch[1]);
    }
  }
  
  // Removed cache buster to prevent infinite re-renders in React Native Image components
  
  console.log(`[getImageUrl] Original: ${url} -> Final: ${finalUrl}`);
  return finalUrl;
};

import { useEffect, useState } from 'react';

export default function useKakaoLoader() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (window.kakao?.maps) {
      setLoaded(true);
      return;
    }

    const appKey = import.meta.env.VITE_KAKAO_APP_KEY;
    if (!appKey || appKey === 'YOUR_KAKAO_JAVASCRIPT_KEY_HERE') {
      setError('KAKAO_KEY_MISSING');
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
    script.onload = () => window.kakao.maps.load(() => setLoaded(true));
    script.onerror = () => setError('LOAD_FAILED');
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) document.head.removeChild(script);
    };
  }, []);

  return { loaded, error };
}

export default function BottomNav({ active = 'home' }) {
  return (
    <div className="flex items-center justify-around border-t border-gray-100 bg-white pt-4 pb-7 px-8">
      {/* 홈 */}
      <button className="flex flex-col items-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z"
            fill={active === 'home' ? '#1A1A1A' : 'none'}
            stroke={active === 'home' ? '#1A1A1A' : '#AAAAAA'}
            strokeWidth="1.8"
          />
        </svg>
      </button>

      {/* 지도 */}
      <button className="flex flex-col items-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <polygon
            points="3,6 9,3 15,6 21,3 21,18 15,21 9,18 3,21"
            fill={active === 'map' ? '#1A1A1A' : 'none'}
            stroke={active === 'map' ? '#1A1A1A' : '#AAAAAA'}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <line x1="9" y1="3" x2="9" y2="18" stroke={active === 'map' ? '#fff' : '#AAAAAA'} strokeWidth="1.4" />
          <line x1="15" y1="6" x2="15" y2="21" stroke={active === 'map' ? '#fff' : '#AAAAAA'} strokeWidth="1.4" />
        </svg>
      </button>

      {/* 설정 */}
      <button className="flex flex-col items-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke={active === 'settings' ? '#1A1A1A' : '#AAAAAA'} strokeWidth="1.8" />
          <path
            d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
            stroke={active === 'settings' ? '#1A1A1A' : '#AAAAAA'}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

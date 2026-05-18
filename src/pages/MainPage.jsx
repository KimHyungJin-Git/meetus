import { useState, useRef, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { reverseGeocode, searchKeyword } from '../services/kakaoApi';
import { calcAverageMidpoint, calcDistance } from '../services/midpoint';
import { detectSubwayRoute } from '../services/subwayData';
import { calculateMidpoint, reverseGeocodeFromServer, searchKeywordFromServer } from '../services/meetusApi';
import useKakaoLoader from '../hooks/useKakaoLoader';

const MAX_POINTS = 5;

// ── 아이콘들 ────────────────────────────────────────────────
function PinIcon({ color }) {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
      <path d="M9 0C4.03 0 0 4.03 0 9C0 15.75 9 22 9 22C9 22 18 15.75 18 9C18 4.03 13.97 0 9 0Z" fill={color} />
      <circle cx="9" cy="9" r="3.5" fill="white" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="8.5" cy="8.5" r="6" stroke="#999" strokeWidth="1.8" />
      <line x1="13" y1="13" x2="18" y2="18" stroke="#999" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function CloseIcon({ size = 14, color = '#AAAAAA' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <line x1="1" y1="1" x2="13" y2="13" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="13" y1="1" x2="1" y2="13" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function GpsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" fill="#F08472" />
      <circle cx="12" cy="12" r="8" stroke="#F08472" strokeWidth="1.8" />
      <line x1="12" y1="2" x2="12" y2="5" stroke="#F08472" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="22" stroke="#F08472" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="2" y1="12" x2="5" y2="12" stroke="#F08472" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="19" y1="12" x2="22" y2="12" stroke="#F08472" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const PIN_COLORS = ['#EF7878', '#F5C842', '#F5C842', '#F5C842', '#F5C842'];

// ── 위치 검색 바텀시트 ────────────────────────────────────────
function LocationSheet({ isFirstRow, onSelect, onClose, sdkLoaded }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [gpsFetching, setGpsFetching] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleQueryChange = (val) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = sdkLoaded
          ? await searchKeyword(val)
          : await searchKeywordFromServer(val);
        setResults(res.slice(0, 6));
      } catch { setResults([]); }
    }, 350);
  };

  const handleGPS = () => {
    if (!navigator.geolocation) { setGpsError('이 브라우저에서는 위치를 지원하지 않습니다.'); return; }
    setGpsFetching(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          let address = '';
          if (sdkLoaded) {
            address = await reverseGeocode(lat, lng);
          }
          if (!address) {
            address = await reverseGeocodeFromServer(lat, lng);
          }
          onSelect({ label: address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng, isMyLocation: true });
        } catch {
          onSelect({ label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng, isMyLocation: true });
        } finally {
          setGpsFetching(false);
        }
      },
      () => {
        setGpsError('위치 권한을 허용해주세요.');
        setGpsFetching(false);
      }
    );
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col">
      {/* 딤드 배경 */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* 시트 */}
      <div className="bg-white rounded-t-3xl shadow-2xl px-5 pt-4 pb-8 max-h-[70%] flex flex-col">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {/* 검색 입력 */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3 mb-3">
          <SearchIcon />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
            placeholder="장소, 주소 검색..."
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }}>
              <CloseIcon size={12} />
            </button>
          )}
        </div>

        {/* 내 위치 버튼 (첫 번째 행에만) */}
        {isFirstRow && (
          <button
            onClick={handleGPS}
            disabled={gpsFetching}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-[#F08472]/40 mb-3 text-[#F08472] text-sm font-medium active:bg-[#FFF0ED] transition-colors"
          >
            <GpsIcon />
            {gpsFetching ? '위치 가져오는 중...' : '내 위치 불러오기'}
          </button>
        )}
        {gpsError && <p className="text-xs text-red-400 mb-2 px-1">{gpsError}</p>}

        {/* 검색 결과 */}
        <div className="overflow-y-auto flex-1">
          {results.map(item => (
            <button
              key={item.id}
              onClick={() => onSelect({ label: item.label, lat: item.lat, lng: item.lng, isMyLocation: false })}
              className="w-full text-left px-2 py-3 border-b border-gray-50 last:border-0 active:bg-gray-50"
            >
              <p className="text-sm font-medium text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.address}</p>
            </button>
          ))}
          {query && results.length === 0 && (
            <button
              onClick={() => onSelect({ label: query, lat: null, lng: null, isMyLocation: false })}
              className="w-full text-left px-2 py-3 active:bg-gray-50"
            >
              <p className="text-sm text-gray-500">"{query}" 직접 입력</p>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const TRANSPORT_OPTIONS = [
  { id: 'transit',  label: '대중교통' },
  { id: 'driving',  label: '자동차' },
  { id: 'walking',  label: '도보' },
];
const CATEGORY_OPTIONS = [
  { code: 'CE7', label: '카페' },
  { code: 'FD6', label: '식당' },
];

// ── 메인 페이지 ────────────────────────────────────────────────
export default function MainPage({ onCalculate }) {
  const { loaded: sdkLoaded } = useKakaoLoader();

  const [points, setPoints] = useState([
    { id: 1, label: '', lat: null, lng: null, isMyLocation: false },
    { id: 2, label: '', lat: null, lng: null, isMyLocation: false },
  ]);
  const [activeSheet, setActiveSheet] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [mode, setMode] = useState('transit');
  const [category, setCategory] = useState('CE7');
  const [walkingPopup, setWalkingPopup] = useState(false);
  const [apiError, setApiError] = useState('');

  const openSheet = (idx) => { if (!calculating) setActiveSheet(idx); };
  const closeSheet = () => setActiveSheet(null);

  const handleSelect = (idx, location) => {
    setPoints(prev =>
      prev.map((p, i) => (i === idx ? { ...p, ...location } : p))
    );
    closeSheet();
  };

  const addPoint = () => {
    if (points.length >= MAX_POINTS) return;
    setPoints(prev => [...prev, { id: Date.now(), label: '', lat: null, lng: null, isMyLocation: false }]);
  };

  const removePoint = (idx) => {
    setPoints(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCalculate = async () => {
    const filled = points.filter(p => p.label);
    if (filled.length < 2) return;
    setCalculating(true);
    setApiError('');

    // 좌표가 있는 첫 두 지점으로 API 호출
    const withCoords = filled.filter(p => p.lat && p.lng);
    const [pointA, pointB] = withCoords;

    if (pointA && pointB) {
      try {
        const result = await calculateMidpoint({
          startLat: pointA.lat,
          startLon: pointA.lng,
          endLat: pointB.lat,
          endLon: pointB.lng,
          mode,
          category,
        });

        setCalculating(false);

        // Case B: 도보 + 5km 초과
        if (result.status === 'filtered') {
          setWalkingPopup(true);
          return;
        }

        // Case C: 파라미터 오류
        if (result.status === 'error') {
          setApiError(result.message || '요청 오류가 발생했습니다.');
          return;
        }

        // Case A: 성공
        if (result.status === 'success') {
          const mid = {
            lat: result.midpoint_geo.lat,
            lng: result.midpoint_geo.lng,
            address: result.midpoint_geo.address,
            snapped_station: result.midpoint_geo.snapped_station,
          };
          onCalculate(filled, mid, result);
          return;
        }
      } catch {
        // 백엔드 미연결 시 기존 클라이언트 계산으로 fallback
      }
    }

    // Fallback: 기존 로직
    const subwayRoute = detectSubwayRoute(filled);
    const mid = subwayRoute
      ? {
          lat: subwayRoute.meetingStation.lat,
          lng: subwayRoute.meetingStation.lng,
          address: subwayRoute.meetingStation.name,
          subwayRoute,
        }
      : (calcAverageMidpoint(filled) ?? { lat: 37.5665, lng: 126.978, address: '서울 시청 인근' });
    setCalculating(false);
    onCalculate(filled, mid, null);
  };

  const canCalculate = points.filter(p => p.label).length >= 2;

  return (
    <div className="w-full h-full flex flex-col bg-white relative">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-5 pt-14 pb-3">
        <span className="text-xl font-bold text-gray-900 mr-auto">Meetus</span>
        <div className="flex items-center bg-gray-100 rounded-full px-4 py-2 gap-2 flex-1 max-w-[200px]">
          <span className="text-gray-400 text-sm flex-1">검색하세요...</span>
          <SearchIcon />
        </div>
      </div>

      {/* 출발지 카드 */}
      <div className="mx-4 mt-3 bg-gray-50 rounded-2xl p-4 flex flex-col gap-3 relative"
           style={{ opacity: calculating ? 0.5 : 1 }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">출발지 목록</span>
            <span className="text-[10px] bg-blue-100 text-blue-500 px-2 py-0.5 rounded-full font-medium">DEMO</span>
          </div>
          {calculating
            ? <span className="text-xs bg-gray-300 text-white rounded-full px-3 py-0.5 font-medium">계산 중...</span>
            : <span className="text-xs bg-[#F08472] text-white rounded-full px-3 py-0.5 font-medium">최대 5명</span>
          }
        </div>

        {points.map((point, idx) => (
          <button
            key={point.id}
            onClick={() => openSheet(idx)}
            className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm text-left w-full"
          >
            <PinIcon color={PIN_COLORS[idx] ?? '#F5C842'} />
            <span className={`flex-1 text-sm ${point.label ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
              {point.label ||
                (idx === 0 ? '내 위치 또는 출발지 입력' : `친구 ${idx}의 출발지 추가`)}
            </span>
            {idx > 1 && (
              <span
                onClick={e => { e.stopPropagation(); removePoint(idx); }}
                className="p-1"
              >
                <CloseIcon />
              </span>
            )}
          </button>
        ))}

        {/* 계산 중 오버레이 */}
        {calculating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/70">
            <div className="w-9 h-9 border-4 border-gray-200 border-t-[#F08472] rounded-full animate-spin mb-3" />
            <div className="bg-white rounded-xl shadow-md px-5 py-3 text-center mx-6">
              <p className="text-sm font-bold text-gray-800 mb-1">가장 공평한 곳을 찾는중</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                대중교통/도보: 실시간 트래픽 반영<br />
                자동차: 실시간 트래픽 반영
              </p>
            </div>
          </div>
        )}

        {/* 친구 추가 */}
        {!calculating && points.length < MAX_POINTS && (
          <button
            onClick={addPoint}
            className="border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 font-medium"
          >
            + 친구 추가하기
          </button>
        )}
      </div>

      {/* 이동수단 선택 */}
      <div className="mx-4 mt-3">
        <p className="text-xs font-semibold text-gray-500 mb-2 px-1">이동수단</p>
        <div className="flex gap-2">
          {TRANSPORT_OPTIONS.map(t => (
            <button
              key={t.id}
              onClick={() => { setMode(t.id); setApiError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                mode === t.id
                  ? 'bg-[#F08472] text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 장소 유형 선택 */}
      <div className="mx-4 mt-3">
        <p className="text-xs font-semibold text-gray-500 mb-2 px-1">만날 장소 유형</p>
        <div className="flex gap-2">
          {CATEGORY_OPTIONS.map(c => (
            <button
              key={c.code}
              onClick={() => setCategory(c.code)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                category === c.code
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* API 오류 메시지 */}
      {apiError && (
        <div className="mx-4 mt-2 px-4 py-2 bg-red-50 rounded-xl">
          <p className="text-xs text-red-500">{apiError}</p>
        </div>
      )}

      {/* 계산하기 버튼 */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={handleCalculate}
          disabled={calculating || !canCalculate}
          className={`w-full py-4 rounded-2xl text-white font-semibold text-base transition-all ${
            calculating || !canCalculate ? 'bg-[#F08472]/40 cursor-not-allowed' : 'bg-[#F08472] active:scale-95'
          }`}
        >
          중간 지점 계산하기 →
        </button>
      </div>

      <div className="flex-1" />
      <BottomNav active="home" />

      {/* Case B: 도보 5km 초과 팝업 */}
      {walkingPopup && (
        <div className="absolute inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setWalkingPopup(false)} />
          <div className="relative w-full bg-white rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <p className="text-base font-bold text-gray-900 mb-2">도보로 가기엔 먼 거리예요</p>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              두 출발지의 직선 거리가 5km를 초과해서<br />도보 이동을 추천하지 않아요.<br />대중교통으로 변경할까요?
            </p>
            <button
              onClick={() => { setMode('transit'); setWalkingPopup(false); }}
              className="w-full bg-[#F08472] text-white rounded-2xl py-3.5 font-semibold text-sm mb-2"
            >
              대중교통으로 변경하기
            </button>
            <button
              onClick={() => setWalkingPopup(false)}
              className="w-full text-gray-400 py-2 text-sm"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 위치 선택 바텀시트 */}
      {activeSheet !== null && (
        <LocationSheet
          isFirstRow={activeSheet === 0}
          sdkLoaded={sdkLoaded}
          onSelect={loc => handleSelect(activeSheet, loc)}
          onClose={closeSheet}
        />
      )}
    </div>
  );
}

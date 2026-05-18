import { useState, useEffect, useRef, useCallback } from 'react';
import BottomNav from '../components/BottomNav';
import useKakaoLoader from '../hooks/useKakaoLoader';
import { searchByCategory } from '../services/kakaoApi';
import { calcDistance, estimateTravelTime } from '../services/midpoint';
import { LINE_INFO } from '../services/subwayData';
import { calculateMidpoint, fetchRoute } from '../services/meetusApi';

// ── 아이콘 ──────────────────────────────────────────────────
function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="18" cy="5" r="3" stroke="#999" strokeWidth="1.8" />
      <circle cx="6" cy="12" r="3" stroke="#999" strokeWidth="1.8" />
      <circle cx="18" cy="19" r="3" stroke="#999" strokeWidth="1.8" />
      <line x1="8.6" y1="10.7" x2="15.4" y2="6.3" stroke="#999" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8.6" y1="13.3" x2="15.4" y2="17.7" stroke="#999" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function HeartIcon({ filled }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21C12 21 2 14 2 8a5 5 0 0 1 10 0 5 5 0 0 1 10 0c0 6-10 13-10 13Z"
        fill={filled ? '#F08472' : 'none'}
        stroke={filled ? '#F08472' : '#CCC'}
        strokeWidth="1.8"
      />
    </svg>
  );
}
function StarIcon({ filled }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? '#F5C842' : '#E0E0E0'}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

// ── 좌표로 대략적인 지역명 추정 (SDK 없을 때 fallback) ────────
function guessAreaFromCoords(lat, lng) {
  if (lat > 37.50 && lat < 37.54 && lng > 127.05 && lng < 127.08) return '성동·광진구 인근';
  if (lat > 37.54 && lat < 37.58 && lng > 127.00 && lng < 127.06) return '동대문·중랑구 인근';
  if (lat > 37.48 && lat < 37.52 && lng > 126.98 && lng < 127.04) return '강남·서초구 인근';
  if (lat > 37.52 && lat < 37.56 && lng > 126.95 && lng < 127.00) return '마포·용산구 인근';
  return `${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E`;
}

// ── 동적 Mock 지도 SVG (카카오 SDK 없을 때) ────────────────────
const DEP_COLORS = ['#EF7878', '#7EB8F7', '#F5C842', '#AB47BC', '#4CAF50'];
const ROUTE_COLOR = { transit: '#F08472', car: '#7EB8F7', walk: '#4CAF50' };
const ROUTE_DASH  = { transit: '0', car: '0', walk: '6 4' };
const HAN_RIVER_LAT = 37.516; // 서울 동부 한강 대략 위도

function MockMapSVG({ departurePoints, midpoint, mode }) {
  const W = 390, H = 200;
  const validDeps = departurePoints.filter(p => p.lat && p.lng);
  const hasMid = midpoint?.lat && midpoint?.lng;
  const subwayRoute = mode === 'transit' ? midpoint?.subwayRoute : null;
  const lineColor = subwayRoute
    ? (LINE_INFO[subwayRoute.lineNumber]?.color ?? ROUTE_COLOR.transit)
    : ROUTE_COLOR[mode];

  // Include subway station waypoints in the bounding box so the full route is visible
  const stationPts = subwayRoute ? subwayRoute.stations : [];
  const allPts = [...validDeps, ...(hasMid ? [midpoint] : []), ...stationPts];
  if (allPts.length === 0) return <rect width={W} height={H} fill="#F0EDE8" />;

  const lats = allPts.map(p => p.lat);
  const lngs = allPts.map(p => p.lng);
  const latRange = Math.max(...lats) - Math.min(...lats) || 0.02;
  const lngRange = Math.max(...lngs) - Math.min(...lngs) || 0.02;
  const latPad = Math.max(latRange * 0.45, 0.008);
  const lngPad = Math.max(lngRange * 0.45, 0.008);
  const minLat = Math.min(...lats) - latPad;
  const maxLat = Math.max(...lats) + latPad;
  const minLng = Math.min(...lngs) - lngPad;
  const maxLng = Math.max(...lngs) + lngPad;

  const toXY = (lat, lng) => ({
    x: ((lng - minLng) / (maxLng - minLng)) * W,
    y: ((maxLat - lat) / (maxLat - minLat)) * H,
  });

  const curvePath = (p1, p2) => {
    const cx = (p1.x + p2.x) / 2 - (p2.y - p1.y) * 0.25;
    const cy = (p1.y + p2.y) / 2 + (p2.x - p1.x) * 0.25;
    return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  };

  const polylinePath = (stations) =>
    stations.map(s => toXY(s.lat, s.lng))
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(' ');

  const midXY = hasMid ? toXY(midpoint.lat, midpoint.lng) : null;

  const hanY = ((maxLat - HAN_RIVER_LAT) / (maxLat - minLat)) * H;
  const showHan = hanY > 15 && hanY < H - 15;

  // Badge placed at the midpoint of routeA
  const badgeStation = subwayRoute
    ? subwayRoute.routeA[Math.floor(subwayRoute.routeA.length / 2)]
    : null;
  const badgeXY = badgeStation ? toXY(badgeStation.lat, badgeStation.lng) : null;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect width={W} height={H} fill="#EEE9E3" />
      {/* 격자 */}
      {Array.from({ length: 11 }).map((_, i) => (
        <line key={`v${i}`} x1={(i + 1) * (W / 12)} y1="0" x2={(i + 1) * (W / 12)} y2={H} stroke="#E4DFD9" strokeWidth="1" />
      ))}
      {Array.from({ length: 5 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={(i + 1) * (H / 6)} x2={W} y2={(i + 1) * (H / 6)} stroke="#E4DFD9" strokeWidth="1" />
      ))}
      {/* 한강 */}
      {showHan && (
        <>
          <rect x={0} y={hanY - 6} width={W} height={12} fill="#B8D8F0" opacity={0.7} />
          <text x={8} y={hanY + 3} fill="#7AADCE" fontSize="8" fontWeight="600" opacity={0.8}>한강</text>
        </>
      )}

      {/* 경로 */}
      {subwayRoute ? (
        <>
          {/* 호선 폴리라인 */}
          <path d={polylinePath(subwayRoute.routeA)} stroke={lineColor} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.92} />
          <path d={polylinePath(subwayRoute.routeB)} stroke={lineColor} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.92} />

          {/* 호선 뱃지 */}
          {badgeXY && (
            <g>
              <rect x={badgeXY.x - 18} y={badgeXY.y - 27} width={36} height={15} rx={7} fill={lineColor} />
              <text x={badgeXY.x} y={badgeXY.y - 16} textAnchor="middle" fill="white" fontSize="8" fontWeight="800">
                {LINE_INFO[subwayRoute.lineNumber]?.name}
              </text>
            </g>
          )}

          {/* 역 도트 + 이름 */}
          {subwayRoute.stations.map((station, i) => {
            const { x, y } = toXY(station.lat, station.lng);
            const isMeeting = i === subwayRoute.meetingStationIdx;
            const isEndpoint = i === 0 || i === subwayRoute.stations.length - 1;
            return (
              <g key={station.name}>
                <circle cx={x} cy={y} r={isMeeting ? 6 : 3.5}
                  fill="white" stroke={lineColor}
                  strokeWidth={isMeeting ? 2.5 : 1.8} />
                {!isEndpoint && (
                  <text x={x} y={y - 8} textAnchor="middle"
                    fill={isMeeting ? '#222' : '#555'}
                    fontSize={isMeeting ? '8' : '6.5'}
                    fontWeight={isMeeting ? '700' : '500'}>
                    {station.name.replace('역', '')}
                  </text>
                )}
              </g>
            );
          })}
        </>
      ) : (
        midXY && validDeps.map((dep, i) => {
          const depXY = toXY(dep.lat, dep.lng);
          return (
            <path
              key={dep.id ?? i}
              d={curvePath(depXY, midXY)}
              stroke={ROUTE_COLOR[mode]}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={ROUTE_DASH[mode]}
              fill="none"
              opacity={0.85}
            />
          );
        })
      )}

      {/* 출발지 핀 */}
      {validDeps.map((dep, i) => {
        const { x, y } = toXY(dep.lat, dep.lng);
        return (
          <g key={dep.id ?? i}>
            <circle cx={x} cy={y} r={11} fill={DEP_COLORS[i % DEP_COLORS.length]} />
            <circle cx={x} cy={y} r={4.5} fill="white" />
            <rect x={x - 26} y={y - 26} width={52} height={16} rx={8} fill={DEP_COLORS[i % DEP_COLORS.length]} />
            <text x={x} y={y - 14} textAnchor="middle" fill="white" fontSize="8" fontWeight="700">
              {dep.isMyLocation ? '내 위치' : dep.label || `출발지 ${i + 1}`}
            </text>
          </g>
        );
      })}

      {/* 중간지점 핀 */}
      {midXY && (
        <g>
          <rect x={midXY.x - 52} y={midXY.y + 12} width={104} height={20} rx={10} fill="white" opacity={0.96} />
          <text x={midXY.x} y={midXY.y + 25} textAnchor="middle" fill="#444" fontSize="9" fontWeight="700">
            {subwayRoute ? subwayRoute.meetingStation.name : '우리들의 중간지점'}
          </text>
          <circle cx={midXY.x} cy={midXY.y} r={9} fill="#F5C842" />
          <circle cx={midXY.x} cy={midXY.y} r={3.5} fill="white" />
        </g>
      )}
    </svg>
  );
}

// 이동수단별 스타일
const MODE_STYLE = {
  transit: { strokeColor: '#F08472', strokeStyle: 'solid', strokeWeight: 4, strokeOpacity: 0.9 },
  car:     { strokeColor: '#7EB8F7', strokeStyle: 'solid', strokeWeight: 4, strokeOpacity: 0.9 },
  walk:    { strokeColor: '#4CAF50', strokeStyle: 'dot',   strokeWeight: 3, strokeOpacity: 0.9 },
};

// 마커 커스텀 이미지 URL (카카오 기본 핀 색상 커스터마이징)
const DEPARTURE_COLORS = ['#EF7878', '#F5C842', '#F5C842', '#F5C842', '#F5C842'];

// mock 장소 데이터 (API 키 없을 때 fallback)
const MOCK_PLACES = [
  { id: '1', name: '중간지점 카페', address: '서울 마포구 홍익로 10', distance: 120, categoryCode: 'CE7', stars: 4, liked: false },
  { id: '2', name: '중간지점 식당', address: '서울 마포구 어울마당로 65', distance: 240, categoryCode: 'FD6', stars: 5, liked: false },
  { id: '3', name: '근처 카페2', address: '서울 마포구 와우산로 11', distance: 380, categoryCode: 'CE7', stars: 3, liked: false },
];

const FILTER_TABS = ['전체', '식당', '카페'];
const CATEGORY_MAP = { '식당': 'FD6', '카페': 'CE7' };
const TRANSPORT_MODES = [
  { id: 'transit', label: '대중교통', icon: (active) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="3" stroke={active ? '#F08472' : '#AAA'} strokeWidth="1.8" />
      <circle cx="7.5" cy="18" r="1.5" fill={active ? '#F08472' : '#AAA'} />
      <circle cx="16.5" cy="18" r="1.5" fill={active ? '#F08472' : '#AAA'} />
      <line x1="3" y1="11" x2="21" y2="11" stroke={active ? '#F08472' : '#AAA'} strokeWidth="1.5" />
    </svg>
  )},
  { id: 'car', label: '자동차', icon: (active) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 11L6.5 5H17.5L20 11" stroke={active ? '#F08472' : '#AAA'} strokeWidth="1.8" strokeLinecap="round" />
      <rect x="2" y="11" width="20" height="7" rx="2" stroke={active ? '#F08472' : '#AAA'} strokeWidth="1.8" />
      <circle cx="7" cy="18" r="2" fill={active ? '#F08472' : '#AAA'} />
      <circle cx="17" cy="18" r="2" fill={active ? '#F08472' : '#AAA'} />
    </svg>
  )},
  { id: 'walk', label: '도보', icon: (active) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="4" r="2" fill={active ? '#F08472' : '#AAA'} />
      <path d="M9 20L10.5 14L8 10L12 9L14 12L17 11" stroke={active ? '#F08472' : '#AAA'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )},
];

// ── 경로 상세 바텀시트 ────────────────────────────────────────
const MODE_LABEL = { transit: '대중교통', driving: '자동차', walking: '도보' };
const MODE_COLOR = { transit: '#F08472', driving: '#7EB8F7', walking: '#4CAF50' };
const BY_CODE   = { transit: 'PUBLICTRANSIT', driving: 'CAR', walking: 'FOOT' };

function RouteStep({ color, icon, label, sub }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
             style={{ backgroundColor: `${color}20` }}>
          {icon}
        </div>
      </div>
      <div className="pt-1.5">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function RouteLine({ color, label }) {
  return (
    <div className="flex items-start gap-3 py-1">
      <div className="flex flex-col items-center w-9">
        <div className="w-0.5 h-4" style={{ backgroundColor: `${color}60` }} />
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5"
              style={{ backgroundColor: `${color}18`, color }}>
          {label}
        </span>
        <div className="w-0.5 h-4" style={{ backgroundColor: `${color}60` }} />
      </div>
    </div>
  );
}

function RouteDetailSheet({ dep, midpoint, mode, travelTime, distanceKm, onClose }) {
  const color = MODE_COLOR[mode];
  const modeLabel = MODE_LABEL[mode];
  const destName = midpoint?.snapped_station
    ? `${midpoint.snapped_station}역`
    : midpoint?.address || '중간지점';

  const kakaoMapUrl = dep?.lat && midpoint?.lat
    ? `https://map.kakao.com/link/from/${encodeURIComponent(dep.label)},${dep.lat},${dep.lng}/to/${encodeURIComponent(destName)},${midpoint.lat},${midpoint.lng}`
    : null;

  const steps = [];

  // 출발지
  steps.push({ type: 'point', label: dep?.label || '출발지', sub: dep?.isMyLocation ? '내 위치' : null });

  // 대중교통: 출발 → 지하철역 → 중간지점
  if (mode === 'transit' && midpoint?.snapped_station) {
    steps.push({ type: 'line', label: modeLabel });
    steps.push({ type: 'point', label: `${midpoint.snapped_station}역`, sub: '지하철 환승 포인트' });
    steps.push({ type: 'line', label: '도보' });
  } else {
    steps.push({ type: 'line', label: modeLabel });
  }

  // 중간지점
  steps.push({ type: 'point', label: destName, sub: midpoint?.address || null });

  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl px-6 pt-5 pb-10 shadow-2xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">경로 상세</p>
            <p className="text-base font-bold text-gray-900 mt-0.5">{travelTime} 예상</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
               style={{ backgroundColor: `${color}18` }}>
            <span className="text-xs font-bold" style={{ color }}>{modeLabel}</span>
            <span className="text-xs text-gray-400">· {distanceKm.toFixed(1)}km</span>
          </div>
        </div>

        {/* 경로 스텝 */}
        <div className="space-y-0">
          {steps.map((step, i) =>
            step.type === 'point' ? (
              <RouteStep
                key={i}
                color={step.label.includes('역') ? color : (i === 0 ? '#EF7878' : '#F5C842')}
                icon={
                  i === 0
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill={color}><circle cx="12" cy="10" r="4"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EF7878"/></svg>
                    : step.label.includes('역')
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="12" rx="3" fill={color} opacity=".9"/><circle cx="7.5" cy="18" r="1.5" fill={color}/><circle cx="16.5" cy="18" r="1.5" fill={color}/><line x1="3" y1="11" x2="21" y2="11" stroke="white" strokeWidth="1.5"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="#F5C842"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/></svg>
                }
                label={step.label}
                sub={step.sub}
              />
            ) : (
              <RouteLine key={i} color={color} label={step.label} />
            )
          )}
        </div>

        {/* 카카오맵 길찾기 버튼 */}
        {kakaoMapUrl && (
          <a
            href={kakaoMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-sm text-white"
            style={{ backgroundColor: color }}
          >
            카카오맵에서 길찾기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

// ── 지도 핀 SVG (카카오 CustomOverlay용 HTML 문자열) ──────────
function departurePinHTML(color, label) {
  return `
    <div style="display:flex;flex-direction:column;align-items:center">
      <div style="background:${color};color:white;font-size:10px;font-weight:700;padding:3px 7px;border-radius:10px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25)">${label}</div>
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${color}"></div>
    </div>`;
}
function midpointPinHTML(address) {
  return `
    <div style="display:flex;flex-direction:column;align-items:center">
      <div style="background:#fff;border:2px solid #F5C842;color:#333;font-size:10px;font-weight:700;padding:3px 8px;border-radius:10px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.2)">${address || '중간지점'}</div>
      <div style="width:12px;height:12px;background:#F5C842;border-radius:50%;border:2px solid white;margin-top:3px;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>
    </div>`;
}

// ── ResultPage ────────────────────────────────────────────────
export default function ResultPage({ departurePoints, midpoint, initialApiResult, onBack }) {
  const { loaded: sdkLoaded } = useKakaoLoader();
  const mapContainerRef = useRef(null);
  const kakaoMapRef = useRef(null);
  const polylinesRef = useRef([]);
  const overlaysRef = useRef([]);
  const distanceOverlaysRef = useRef([]);

  const [mode, setMode] = useState('transit');
  const [filter, setFilter] = useState('전체');
  const [places, setPlaces] = useState(MOCK_PLACES);
  const [liked, setLiked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('meetus_liked') || '{}'); }
    catch { return {}; }
  });
  const [currentMidpoint, setCurrentMidpoint] = useState(midpoint);
  const [midAddress, setMidAddress] = useState(midpoint?.address || '');
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [summary, setSummary] = useState(initialApiResult?.summary ?? null);
  const [walkingPopup, setWalkingPopup] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [routeSheet, setRouteSheet] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeStats, setRouteStats] = useState([]); // 출발지별 { duration_mins, distance_km }

  // 초기 API 추천 장소 적용
  useEffect(() => {
    if (!initialApiResult?.recommended_places?.length) return;
    const normalized = initialApiResult.recommended_places.map((p, i) => ({
      id: p.place_name + i,
      name: p.place_name,
      address: p.address_name,
      distance: parseInt(p.distance_meters, 10) || 0,
      url: p.place_url,
      categoryCode: 'CE7',
      stars: 4,
    }));
    setPlaces(normalized);
  }, [initialApiResult]);

  // 이동수단 변경 — API 재호출
  const handleModeChange = async (newMode) => {
    setMode(newMode);
    const withCoords = departurePoints.filter(p => p.lat && p.lng);
    const [pointA, pointB] = withCoords;
    if (!pointA || !pointB) return;

    setApiLoading(true);
    try {
      const result = await calculateMidpoint({
        startLat: pointA.lat,
        startLon: pointA.lng,
        endLat: pointB.lat,
        endLon: pointB.lng,
        mode: newMode,
        category: filter === '카페' ? 'CE7' : 'FD6',
      });

      if (result.status === 'filtered') {
        setWalkingPopup(true);
        setMode('transit');
        return;
      }
      if (result.status === 'success') {
        const mid = {
          lat: result.midpoint_geo.lat,
          lng: result.midpoint_geo.lng,
          address: result.midpoint_geo.address,
          snapped_station: result.midpoint_geo.snapped_station,
        };
        setCurrentMidpoint(mid);
        setMidAddress(result.midpoint_geo.address || '');
        setSummary(result.summary);
        if (result.recommended_places?.length) {
          setPlaces(result.recommended_places.map((p, i) => ({
            id: p.place_name + i,
            name: p.place_name,
            address: p.address_name,
            distance: parseInt(p.distance_meters, 10) || 0,
            url: p.place_url,
            categoryCode: 'CE7',
            stars: 4,
          })));
        }
        // 새 중간지점 기준 경로 재fetch
        const validDeps = departurePoints.filter(p => p.lat && p.lng);
        const results = await Promise.all(
          validDeps.map(dep =>
            fetchRoute({ startLat: dep.lat, startLon: dep.lng, endLat: mid.lat, endLon: mid.lng, mode: newMode })
              .catch(() => ({ coordinates: [], duration_mins: null, distance_km: null }))
          )
        );
        setRouteCoords(results.map(r => r.coordinates ?? r));
        setRouteStats(results.map(r => ({ duration_mins: r.duration_mins, distance_km: r.distance_km })));
      }
    } catch {
      // API 미연결 시 기존 동작 유지
    } finally {
      setApiLoading(false);
    }
  };

  // 하트 토글
  const toggleLike = (id) => {
    setLiked(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('meetus_liked', JSON.stringify(next));
      return next;
    });
  };

  // 공유
  const handleShare = async () => {
    const text = `Meetus 중간지점: ${midAddress || '확인해보세요!'}\n각자 출발해서 만나요 🗺️`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Meetus 중간지점', text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
      alert('클립보드에 복사됐습니다!');
    }
  };

  // 폴리라인 그리기 — routeCoordsList: 출발지별 [[lat,lng], ...] 배열, statsList: 출발지별 { distance_km, duration_mins }
  const drawRoutes = useCallback((map, deps, mid, transportMode, routeCoordsList = [], statsList = []) => {
    const { kakao } = window;
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];
    distanceOverlaysRef.current.forEach(o => o.setMap(null));
    distanceOverlaysRef.current = [];

    const style = MODE_STYLE[transportMode];
    deps.forEach((dep, i) => {
      if (!dep.lat || !dep.lng || !mid?.lat) return;
      const coords = routeCoordsList[i];
      const path = coords?.length > 1
        ? coords.map(([lat, lng]) => new kakao.maps.LatLng(lat, lng))
        : [new kakao.maps.LatLng(dep.lat, dep.lng), new kakao.maps.LatLng(mid.lat, mid.lng)];
      const routeColor = DEPARTURE_COLORS[i] ?? style.strokeColor;
      const polyline = new kakao.maps.Polyline({ map, path, ...style, strokeColor: routeColor });
      polylinesRef.current.push(polyline);

      // 경로 중간에 거리·시간 레이블
      const stats = statsList[i];
      if (stats?.distance_km != null && path.length > 0) {
        const midPos = path[Math.floor(path.length / 2)];
        const mins = stats.duration_mins != null ? Math.round(stats.duration_mins) : null;
        const labelText = `${stats.distance_km.toFixed(1)}km${mins != null ? ` · ${mins}분` : ''}`;
        const content = `<div style="background:white;border:1.5px solid ${routeColor};border-radius:8px;padding:2px 8px;font-size:10px;font-weight:700;color:#333;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.18)">${labelText}</div>`;
        const distOverlay = new kakao.maps.CustomOverlay({ map, position: midPos, content, yAnchor: 1.5 });
        distanceOverlaysRef.current.push(distOverlay);
      }
    });
  }, []);

  // 카카오맵 초기화
  useEffect(() => {
    if (!sdkLoaded || !mapContainerRef.current || !currentMidpoint) return;

    const { kakao } = window;
    const center = new kakao.maps.LatLng(
      currentMidpoint.lat ?? 37.5665,
      currentMidpoint.lng ?? 126.978
    );
    const map = new kakao.maps.Map(mapContainerRef.current, { center, level: 6 });
    kakaoMapRef.current = map;

    // 출발지 오버레이
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];

    departurePoints.forEach((dep, i) => {
      if (!dep.lat || !dep.lng) return;
      const pos = new kakao.maps.LatLng(dep.lat, dep.lng);
      const label = dep.isMyLocation ? '내 위치' : `출발지 ${i + 1}`;
      const overlay = new kakao.maps.CustomOverlay({
        map, position: pos,
        content: departurePinHTML(DEPARTURE_COLORS[i] ?? '#999', label),
        yAnchor: 1,
      });
      overlaysRef.current.push(overlay);
    });

    // 중간지점 오버레이
    const midOverlay = new kakao.maps.CustomOverlay({
      map, position: center,
      content: midpointPinHTML(midAddress || '중간지점'),
      yAnchor: 1,
    });
    overlaysRef.current.push(midOverlay);

    // 지도 범위 자동 조정
    const bounds = new kakao.maps.LatLngBounds();
    departurePoints.forEach(p => {
      if (p.lat && p.lng) bounds.extend(new kakao.maps.LatLng(p.lat, p.lng));
    });
    bounds.extend(center);
    map.setBounds(bounds, 60);

    // 실제 경로 좌표 + 소요시간 fetch
    const validDeps = departurePoints.filter(p => p.lat && p.lng);
    Promise.all(
      validDeps.map(dep =>
        fetchRoute({ startLat: dep.lat, startLon: dep.lng, endLat: currentMidpoint.lat, endLon: currentMidpoint.lng, mode })
          .catch(() => ({ coordinates: [], duration_mins: null, distance_km: null }))
      )
    ).then(results => {
      const coordsList = results.map(r => r.coordinates ?? r);
      const statsList  = results.map(r => ({ duration_mins: r.duration_mins, distance_km: r.distance_km }));
      setRouteCoords(coordsList);
      setRouteStats(statsList);
      drawRoutes(map, validDeps, currentMidpoint, mode, coordsList, statsList);
    });
  }, [sdkLoaded, currentMidpoint]);

  // 이동수단 변경 시 경로 재렌더
  useEffect(() => {
    if (!kakaoMapRef.current || !currentMidpoint) return;
    const validDeps = departurePoints.filter(p => p.lat && p.lng);
    if (routeCoords.length > 0) {
      drawRoutes(kakaoMapRef.current, validDeps, currentMidpoint, mode, routeCoords, routeStats);
    } else {
      drawRoutes(kakaoMapRef.current, validDeps, currentMidpoint, mode);
    }
  }, [mode, drawRoutes, currentMidpoint, routeCoords]);

  // 중간지점 근처 장소 검색 (API 결과 없을 때 카카오 fallback)
  useEffect(() => {
    if (!sdkLoaded || !currentMidpoint?.lat) return;
    if (initialApiResult?.recommended_places?.length) return; // API 결과 우선
    setLoadingPlaces(true);
    const catCode = filter === '전체' ? 'FD6' : (CATEGORY_MAP[filter] ?? 'FD6');
    searchByCategory(catCode, currentMidpoint.lat, currentMidpoint.lng, 800)
      .then(res => {
        if (res.length === 0) {
          if (filter === '전체') {
            return searchByCategory('CE7', currentMidpoint.lat, currentMidpoint.lng, 800);
          }
          return [];
        }
        return res;
      })
      .then(res => setPlaces(res.length > 0 ? res : MOCK_PLACES))
      .catch(() => setPlaces(MOCK_PLACES))
      .finally(() => setLoadingPlaces(false));
  }, [sdkLoaded, currentMidpoint, filter]);

  // 예상 소요시간 계산
  const modeForCalc = mode === 'driving' ? 'car' : mode === 'walking' ? 'walk' : mode;
  const travelTimes = departurePoints.map((dep, i) => {
    const actual = routeStats[i]?.duration_mins;
    if (actual != null) {
      const h = Math.floor(actual / 60);
      const m = Math.round(actual % 60);
      return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
    }
    return dep.lat && currentMidpoint?.lat
      ? estimateTravelTime(calcDistance(dep.lat, dep.lng, currentMidpoint.lat, currentMidpoint.lng), modeForCalc)
      : '–';
  });

  // 이동수단별 바 색상 — 대중교통은 호선 공식색, 자동차/도보는 고유색
  const modeBarColor = (() => {
    if (mode === 'car') return '#7EB8F7';
    if (mode === 'walk') return '#4CAF50';
    return currentMidpoint?.subwayRoute
      ? (LINE_INFO[currentMidpoint.subwayRoute.lineNumber]?.color ?? '#F08472')
      : '#F08472';
  })();

  // 분(숫자) 기준 소요시간 → 가장 긴 여정을 100%로 맞춰 비율 계산
  const speeds = { transit: 10, driving: 22, walking: 4.5 };
  const travelMinsArr = departurePoints.map((dep, i) => {
    const actual = routeStats[i]?.duration_mins;
    if (actual != null) return actual;
    return dep.lat && currentMidpoint?.lat
      ? (calcDistance(dep.lat, dep.lng, currentMidpoint.lat, currentMidpoint.lng) / speeds[mode]) * 60
      : 0;
  });
  const maxMins = Math.max(...travelMinsArr, 1);

  const filteredPlaces = places.filter(p => {
    if (filter === '전체') return true;
    return p.categoryCode === CATEGORY_MAP[filter];
  });

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-y-auto">
      {/* 지도 영역 */}
      <div className="flex-shrink-0 relative overflow-hidden" style={{ height: 240 }}>
        {sdkLoaded && currentMidpoint?.lat ? (
          <div ref={mapContainerRef} className="w-full h-full" />
        ) : (
          <MockMapSVG departurePoints={departurePoints} midpoint={currentMidpoint} mode={mode} />
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ESTIMATED CENTER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">ESTIMATED CENTER</p>
            <p className="text-lg font-bold text-gray-900 truncate">
              {currentMidpoint?.snapped_station
                ? `${currentMidpoint.snapped_station}역`
                : midAddress || currentMidpoint?.address ||
                  (currentMidpoint?.lat ? guessAreaFromCoords(currentMidpoint.lat, currentMidpoint.lng) : '계산 중...')}
            </p>
            {summary && (
              <p className="text-xs text-gray-400 mt-0.5">
                직선 {summary.direct_distance_km}km · 총 {summary.total_time_mins}분
              </p>
            )}
          </div>
          <button onClick={handleShare} className="p-2 active:bg-gray-50 rounded-xl flex-shrink-0">
            <ShareIcon />
          </button>
        </div>

        {/* 이동수단 탭 */}
        <div className="flex gap-2 px-5 py-3 border-b border-gray-100">
          {TRANSPORT_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              disabled={apiLoading}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                mode === m.id ? 'bg-[#FFF0ED] text-[#F08472] font-semibold' : 'text-gray-400'
              } ${apiLoading ? 'opacity-50' : ''}`}
            >
              {m.icon(mode === m.id)}
              {m.label}
            </button>
          ))}
          {apiLoading && (
            <div className="ml-auto flex items-center">
              <div className="w-4 h-4 border-2 border-gray-200 border-t-[#F08472] rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* 예상 소요 시간 */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800 mb-3">예상 소요 시간</p>
          <div className="space-y-3">
            {departurePoints.map((dep, i) => (
              <div key={dep.id ?? i} className="bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span className="text-[10px] text-gray-400 font-medium">{dep.isMyLocation ? '내 위치' : `출발지 ${i + 1}`} — {dep.label || '미입력'}</span>
                    <p className="text-sm font-semibold text-gray-800">{travelTimes[i]}</p>
                  </div>
                  <button
                    onClick={() => setRouteSheet(i)}
                    className="text-[10px] text-[#F08472] border border-[#F08472]/40 rounded px-2 py-0.5 whitespace-nowrap active:bg-[#FFF0ED]"
                  >
                    경로 자세히 보기 +
                  </button>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(6, (travelMinsArr[i] / maxMins) * 100)}%`,
                      backgroundColor: modeBarColor,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 근처 추천 장소 */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-800">근처 추천 장소</p>
            <div className="flex gap-1">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    filter === tab ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {loadingPlaces && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-[#F08472] rounded-full animate-spin" />
            </div>
          )}

          <div className="space-y-3 pb-24">
            {filteredPlaces.map(place => (
              <div key={place.id} className="flex gap-3 bg-gray-50 rounded-2xl p-3">
                <div className="w-16 h-16 bg-gray-200 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="#CCC" strokeWidth="1.5" />
                    <circle cx="9" cy="9" r="2" stroke="#CCC" strokeWidth="1.5" />
                    <path d="M3 16L7 12L11 15L15 11L21 16" stroke="#CCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{place.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    중간 지점에서 {place.distance}m
                    {place.distance ? ` (도보 ${Math.ceil(place.distance / 67)}분)` : ''}
                  </p>
                  <div className="flex items-center gap-1 mt-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <StarIcon key={i} filled={i < (place.stars ?? 3)} />
                    ))}
                    {place.reviews && <span className="text-xs text-gray-400 ml-1">리뷰 {place.reviews}개</span>}
                  </div>
                </div>
                <button onClick={() => toggleLike(place.id)} className="self-start pt-0.5">
                  <HeartIcon filled={!!liked[place.id]} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav active="home" />

      {/* 경로 상세 바텀시트 */}
      {routeSheet !== null && (
        <RouteDetailSheet
          dep={departurePoints[routeSheet]}
          midpoint={currentMidpoint}
          mode={mode}
          travelTime={travelTimes[routeSheet]}
          distanceKm={travelMinsArr[routeSheet] * speeds[mode] / 60}
          onClose={() => setRouteSheet(null)}
        />
      )}

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
              onClick={() => { handleModeChange('transit'); setWalkingPopup(false); }}
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
    </div>
  );
}

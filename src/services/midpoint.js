// 위도·경도 산술 평균으로 중간 좌표 산출
export function calcAverageMidpoint(points) {
  const valid = points.filter(p => p.lat && p.lng);
  if (valid.length === 0) return null;
  return {
    lat: valid.reduce((s, p) => s + p.lat, 0) / valid.length,
    lng: valid.reduce((s, p) => s + p.lng, 0) / valid.length,
  };
}

// Haversine 거리 (km)
export function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 이동 시간 추정 문자열 반환 (직선 거리 기반 fallback)
// transit: 역 정차·환승 감안, car: 도심 교통 감안, walk: 도보
export function estimateTravelTime(distanceKm, mode) {
  const speeds = { transit: 10, car: 22, walk: 4.5 };
  const minutes = (distanceKm / speeds[mode]) * 60;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

// 후보 중간지점들 중 각 출발지와의 편차가 가장 작은 곳 선택
// candidates: [{ label, lat, lng }]
// origins: [{ lat, lng }]
export function selectFairestPoint(candidates, origins) {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, cand) => {
    const times = origins.map(o => calcDistance(o.lat, o.lng, cand.lat, cand.lng));
    const mean = times.reduce((s, t) => s + t, 0) / times.length;
    const variance = times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length;
    return !best || variance < best.variance ? { ...cand, variance } : best;
  }, null);
}

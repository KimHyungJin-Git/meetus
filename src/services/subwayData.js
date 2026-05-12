export const LINE_INFO = {
  1: { color: '#0052A4', name: '1호선' },
  2: { color: '#009246', name: '2호선' },
  3: { color: '#EF7C1C', name: '3호선' },
  4: { color: '#00A5DE', name: '4호선' },
  5: { color: '#996CAC', name: '5호선' },
  6: { color: '#CD7C2F', name: '6호선' },
  7: { color: '#747F00', name: '7호선' },
  8: { color: '#E6186C', name: '8호선' },
  9: { color: '#BDB092', name: '9호선' },
};

// Line 2 stations between 삼성역 and 건대입구역 (clockwise)
const LINE2_SAMSUNG_KONKUK = [
  { name: '삼성역',      lat: 37.508595, lng: 127.063120 },
  { name: '종합운동장역', lat: 37.511085, lng: 127.073574 },
  { name: '잠실새내역',  lat: 37.511160, lng: 127.085599 },
  { name: '잠실역',      lat: 37.513194, lng: 127.100076 },
  { name: '잠실나루역',  lat: 37.521098, lng: 127.091413 },
  { name: '강변역',      lat: 37.530981, lng: 127.093778 },
  { name: '구의역',      lat: 37.536989, lng: 127.081773 },
  { name: '건대입구역',  lat: 37.540309, lng: 127.069510 },
];

// Returns a subway route object if the given points match a known demo route
export function detectSubwayRoute(points) {
  const labels = points.map(p => p.label);
  if (labels.includes('삼성역') && labels.includes('건대입구역')) {
    const stations = LINE2_SAMSUNG_KONKUK;
    const meetingIdx = Math.floor(stations.length / 2); // 4 → 잠실나루역
    return {
      lineNumber: 2,
      stations,
      meetingStationIdx: meetingIdx,
      meetingStation: stations[meetingIdx],
      routeA: stations.slice(0, meetingIdx + 1),           // 삼성 → 잠실나루
      routeB: [...stations.slice(meetingIdx)].reverse(),   // 건대입구 → 잠실나루
    };
  }
  return null;
}

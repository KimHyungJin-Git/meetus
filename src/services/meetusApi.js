const BASE_URL = '/meetus/calculate/';

export async function fetchRoute({ startLat, startLon, endLat, endLon, mode }) {
  const params = new URLSearchParams({ start_lat: startLat, start_lon: startLon, end_lat: endLat, end_lon: endLon, mode });
  const res = await fetch(`/meetus/route/?${params}`);
  const data = await res.json();
  return data.coordinates || [];
}

export async function searchKeywordFromServer(keyword) {
  if (!keyword.trim()) return [];
  const params = new URLSearchParams({ query: keyword });
  const res = await fetch(`/meetus/search/?${params}`);
  const data = await res.json();
  return data.documents || [];
}

export async function reverseGeocodeFromServer(lat, lng) {
  const params = new URLSearchParams({ lat, lon: lng });
  const res = await fetch(`/meetus/address/?${params}`);
  const data = await res.json();
  return data.address || '';
}

/**
 * @param {{ startLat, startLon, endLat, endLon, mode, category }} params
 * @returns {Promise<Object>} API response (status: 'success' | 'filtered' | 'error')
 */
export async function calculateMidpoint({ startLat, startLon, endLat, endLon, mode = 'transit', category = 'CE7' }) {
  const params = new URLSearchParams({
    start_lat: startLat,
    start_lon: startLon,
    end_lat: endLat,
    end_lon: endLon,
    mode,
    category,
  });

  const res = await fetch(`${BASE_URL}?${params}`);
  const data = await res.json();

  // lon → lng 정규화 (앱 내부 규약에 맞춤)
  if (data.midpoint_geo) {
    data.midpoint_geo.lng = data.midpoint_geo.lon;
  }

  return data;
}

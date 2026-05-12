const { kakao } = window;

// 좌표 → 주소 (역지오코딩)
export function reverseGeocode(lat, lng) {
  return new Promise((resolve, reject) => {
    const { Geocoder, Status } = window.kakao.maps.services;
    new Geocoder().coord2Address(lng, lat, (result, status) => {
      if (status !== Status.OK) return reject(new Error('역지오코딩 실패'));
      const addr = result[0];
      resolve(addr.road_address?.address_name ?? addr.address.address_name);
    });
  });
}

// 키워드 → 장소 목록 (주소 검색용)
export function searchKeyword(keyword, options = {}) {
  return new Promise((resolve, reject) => {
    if (!keyword.trim()) return resolve([]);
    const { Places, Status } = window.kakao.maps.services;
    new Places().keywordSearch(keyword, (data, status) => {
      if (status === Status.ZERO_RESULT) return resolve([]);
      if (status !== Status.OK) return reject(new Error('검색 실패'));
      resolve(
        data.map(item => ({
          id: item.id,
          label: item.place_name,
          address: item.road_address_name || item.address_name,
          lat: parseFloat(item.y),
          lng: parseFloat(item.x),
        }))
      );
    }, options);
  });
}

// 카테고리 검색 (중간지점 근처 음식점·카페)
// categoryCode: FD6=음식점, CE7=카페, SW8=지하철역
export function searchByCategory(categoryCode, lat, lng, radius = 1000) {
  return new Promise((resolve, reject) => {
    const { Places, Status } = window.kakao.maps.services;
    new Places().categorySearch(
      categoryCode,
      (data, status) => {
        if (status === Status.ZERO_RESULT) return resolve([]);
        if (status !== Status.OK) return reject(new Error('카테고리 검색 실패'));
        resolve(
          data.map(item => ({
            id: item.id,
            name: item.place_name,
            address: item.road_address_name || item.address_name,
            phone: item.phone,
            url: item.place_url,
            distance: parseInt(item.distance, 10),
            lat: parseFloat(item.y),
            lng: parseFloat(item.x),
            categoryCode,
          }))
        );
      },
      { location: new window.kakao.maps.LatLng(lat, lng), radius, sort: window.kakao.maps.services.SortBy.DISTANCE }
    );
  });
}

// 근처 지하철역 찾기 (SW8)
export function findNearbySubway(lat, lng, radius = 2000) {
  return searchByCategory('SW8', lat, lng, radius);
}

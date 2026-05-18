import math
import os
import httpx
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Meetus API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

KAKAO_REST_KEY = os.getenv("KAKAO_REST_API_KEY", "")
KAKAO_HEADERS = {"Authorization": f"KakaoAK {KAKAO_REST_KEY}"}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def reverse_geocode(lat: float, lon: float) -> str:
    if not KAKAO_REST_KEY:
        return ""
    url = "https://dapi.kakao.com/v2/local/geo/coord2address.json"
    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=KAKAO_HEADERS, params={"x": lon, "y": lat})
        docs = res.json().get("documents", [])
    if not docs:
        return ""
    road = docs[0].get("road_address")
    return road["address_name"] if road else docs[0]["address"]["address_name"]


async def find_nearest_subway(lat: float, lon: float, radius: int = 2000) -> str | None:
    if not KAKAO_REST_KEY:
        return None
    url = "https://dapi.kakao.com/v2/local/search/category.json"
    params = {"category_group_code": "SW8", "x": lon, "y": lat, "radius": radius, "sort": "distance", "size": 1}
    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=KAKAO_HEADERS, params=params)
        docs = res.json().get("documents", [])
    if not docs:
        return None
    return docs[0]["place_name"].replace("역", "")


async def search_places(lat: float, lon: float, category_code: str, radius: int = 1000) -> list:
    if not KAKAO_REST_KEY:
        return []
    url = "https://dapi.kakao.com/v2/local/search/category.json"
    params = {"category_group_code": category_code, "x": lon, "y": lat, "radius": radius, "sort": "distance", "size": 5}
    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=KAKAO_HEADERS, params=params)
        docs = res.json().get("documents", [])
    return [
        {
            "place_name": d["place_name"],
            "address_name": d["road_address_name"] or d["address_name"],
            "distance_meters": d["distance"],
            "place_url": d["place_url"],
        }
        for d in docs
    ][:5]


def _decode_polyline(encoded: str) -> list:
    points, index, lat, lng = [], 0, 0, 0
    while index < len(encoded):
        for is_lat in (True, False):
            result, shift = 0, 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 32:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if is_lat:
                lat += delta
            else:
                lng += delta
        points.append([lat / 1e5, lng / 1e5])
    return points


@app.get("/meetus/route/")
async def get_route(
    start_lat: float = Query(...),
    start_lon: float = Query(...),
    end_lat: float = Query(...),
    end_lon: float = Query(...),
    mode: str = Query("transit"),
):
    profile = "foot" if mode == "walking" else "driving"
    url = (
        f"https://router.project-osrm.org/route/v1/{profile}"
        f"/{start_lon},{start_lat};{end_lon},{end_lat}"
    )
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            res = await client.get(url, params={"overview": "full", "geometries": "polyline"})
            data = res.json()
        if data.get("code") != "Ok":
            return {"coordinates": []}
        route = data["routes"][0]
        coords = _decode_polyline(route["geometry"])
        duration_mins = round(route["duration"] / 60, 1)
        distance_km = round(route["distance"] / 1000, 2)
        return {"coordinates": coords, "duration_mins": duration_mins, "distance_km": distance_km}
    except Exception:
        return {"coordinates": [], "duration_mins": None, "distance_km": None}


@app.get("/meetus/search/")
async def search(query: str = Query(...), size: int = Query(6)):
    if not KAKAO_REST_KEY or not query.strip():
        return {"documents": []}
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    params = {"query": query, "size": size}
    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=KAKAO_HEADERS, params=params)
        docs = res.json().get("documents", [])
    return {
        "documents": [
            {
                "id": d["id"],
                "label": d["place_name"],
                "address": d["road_address_name"] or d["address_name"],
                "lat": float(d["y"]),
                "lng": float(d["x"]),
            }
            for d in docs
        ]
    }


@app.get("/meetus/address/")
async def address(lat: float = Query(...), lon: float = Query(...)):
    addr = await reverse_geocode(lat, lon)
    return {"address": addr}


@app.get("/meetus/calculate/")
async def calculate(
    start_lat: float = Query(37.5665, description="출발지 A 위도"),
    start_lon: float = Query(126.9780, description="출발지 A 경도"),
    end_lat: float = Query(37.5013, description="출발지 B 위도"),
    end_lon: float = Query(127.0396, description="출발지 B 경도"),
    mode: str = Query("transit", description="이동수단: transit / driving / walking"),
    category: str = Query("CE7", description="카카오 카테고리 코드: CE7(카페) / FD6(음식점)"),
):
    dist_km = haversine_km(start_lat, start_lon, end_lat, end_lon)

    # Case B: 도보 + 직선거리 5km 초과
    if mode == "walking" and dist_km > 5:
        return {
            "status": "filtered",
            "message": "Direct distance exceeds 5km. Walking is not recommended.",
            "recommend_transit": True,
        }

    # 산술 평균 중간지점
    mid_lat = (start_lat + end_lat) / 2
    mid_lon = (start_lon + end_lon) / 2

    # 이동수단별 평균 속도로 총 예상 시간 계산
    speeds = {"transit": 10.0, "driving": 22.0, "walking": 4.5}
    speed = speeds.get(mode, 10.0)
    total_time_mins = round((dist_km / speed) * 60, 1)

    address, snapped, places = await _gather(mid_lat, mid_lon, mode, category)

    return {
        "status": "success",
        "summary": {
            "mode": mode,
            "direct_distance_km": round(dist_km, 2),
            "total_time_mins": total_time_mins,
        },
        "midpoint_geo": {
            "lat": mid_lat,
            "lon": mid_lon,
            "address": address,
            "snapped_station": snapped,
        },
        "recommended_places": places,
    }


async def _gather(mid_lat, mid_lon, mode, category):
    import asyncio

    async def no_op():
        return None

    subway_task = find_nearest_subway(mid_lat, mid_lon) if mode == "transit" else no_op()
    address, snapped, places = await asyncio.gather(
        reverse_geocode(mid_lat, mid_lon),
        subway_task,
        search_places(mid_lat, mid_lon, category),
    )
    return address, snapped, places

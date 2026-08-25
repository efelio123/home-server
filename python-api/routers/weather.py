import os
from datetime import datetime, timedelta, timezone
from threading import Lock

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from auth import require_login

router = APIRouter(prefix="/weather", tags=["weather"])

class WeatherResponse(BaseModel):
    location_name: str
    temperature_f: float
    apparent_temperature_f: float
    condition: str
    is_day: bool
    today_high_f: float
    today_low_f: float

weather_cache: WeatherResponse | None = None
weather_cache_expires_at: datetime | None = None
weather_cache_lock = Lock()
weather_cache_duration = timedelta(minutes=10)

weather_conditions = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Light rain showers",
    81: "Moderate rain showers",
    82: "Heavy rain showers",
    95: "Thunderstorm",
}

@router.get("", response_model=WeatherResponse)
def get_weather(_username: str = Depends(require_login)):
    global weather_cache
    global weather_cache_expires_at

    now = datetime.now(timezone.utc)

    with weather_cache_lock:
        if (
            weather_cache is not None
            and weather_cache_expires_at is not None
            and now < weather_cache_expires_at
        ):
            return weather_cache

        try:
            response = httpx.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": os.environ["WEATHER_LATITUDE"],
                    "longitude": os.environ["WEATHER_LONGITUDE"],
                    "current": (
                        "temperature_2m,"
                        "apparent_temperature,"
                        "weather_code,"
                        "is_day"
                    ),
                    "daily": "temperature_2m_max,temperature_2m_min",
                    "temperature_unit": "fahrenheit",
                    "timezone": os.environ["WEATHER_TIMEZONE"],
                    "forecast_days": 1,
                },
                timeout=10.0,
            )
            response.raise_for_status()
            weather_data = response.json()

            current_weather = weather_data["current"]
            daily_weather = weather_data["daily"]

            weather_cache = WeatherResponse(
                location_name=os.environ["WEATHER_LOCATION_NAME"],
                temperature_f=current_weather["temperature_2m"],
                apparent_temperature_f=current_weather["apparent_temperature"],
                condition=weather_conditions.get(
                    current_weather["weather_code"],
                    "Unknown conditions",
                ),
                is_day=bool(current_weather["is_day"]),
                today_high_f=daily_weather["temperature_2m_max"][0],
                today_low_f=daily_weather["temperature_2m_min"][0],
            )
            weather_cache_expires_at = now + weather_cache_duration

            return weather_cache
        except (httpx.HTTPError, KeyError, IndexError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Weather data is temporarily unavailable",
            )
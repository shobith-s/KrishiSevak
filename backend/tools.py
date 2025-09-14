import os
import requests
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

def get_weather(city: str = "Mysuru") -> str:
    """Fetches the current weather for a specified city in India using WeatherAPI.com."""
    api_key = os.environ.get("WEATHERAPI_API_KEY")
    if not api_key: return "Error: WeatherAPI.com key is not configured."

    base_url = "http://api.weatherapi.com/v1/current.json"
    params = {"key": api_key, "q": city}
    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()
        report = (f"The current weather in {data['location']['name']} is {data['current']['condition']['text']} "
                  f"with a temperature of {data['current']['temp_c']}°C.")
        return report
    except Exception as e:
        logger.error(f"Error fetching weather: {e}")
        return "Sorry, I couldn't fetch the weather information."

def get_market_price(commodity: str, market: str = "Mysore") -> str:
    """Fetches the latest wholesale market price for a commodity from data.gov.in."""
    api_key = os.environ.get("DATAGOV_API_KEY")
    if not api_key: return "Error: Market Price API key is not configured."

    api_url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
    params = {"api-key": api_key, "format": "json", "limit": "10",
              "filters[market]": market.title(), "filters[commodity]": commodity.title()}
    try:
        response = requests.get(api_url, params=params)
        response.raise_for_status()
        data = response.json()
        if data['records']:
            latest = max(data['records'], key=lambda r: datetime.strptime(r['arrival_date'], '%d/%m/%Y'))
            report = (f"Latest price for {latest['commodity']} in {latest['market']} (on {latest['arrival_date']}): "
                      f"₹{latest['modal_price']} per Quintal.")
            return report
        return f"Sorry, no recent price data found for {commodity} in {market}."
    except Exception as e:
        logger.error(f"Error fetching market price: {e}")
        return "Sorry, I couldn't fetch the market price."
import os
import requests
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

def get_weather(city: str = "Mysuru", days: int = 1) -> str:
    """
    Fetches the weather forecast for a specified city in India from WeatherAPI.com.
    Can fetch either the current weather (days=1) or a forecast for up to 3 days.
    """
    api_key = os.environ.get("WEATHERAPI_API_KEY")
    if not api_key:
        return "Error: Weather API key is not configured."

    base_url = "http://api.weatherapi.com/v1/forecast.json"
    params = {"key": api_key, "q": city, "days": days, "aqi": "no", "alerts": "no"}
    
    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # If the user wants a forecast for more than one day
        if days > 1:
            forecast_text = f"Weather forecast for {data['location']['name']}:\n"
            for day in data['forecast']['forecastday']:
                forecast_text += (
                    f"- {day['date']}: {day['day']['condition']['text']}, "
                    f"Max Temp: {day['day']['maxtemp_c']}°C, Min Temp: {day['day']['mintemp_c']}°C, "
                    f"Chance of Rain: {day['day']['daily_chance_of_rain']}%\n"
                )
            return forecast_text

        # Otherwise, return the current weather
        current = data['current']
        weather_report = (
            f"The current weather in {data['location']['name']} is {current['condition']['text']} "
            f"with a temperature of {current['temp_c']}°C."
        )
        return weather_report
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching weather data: {e}")
        return "Sorry, I couldn't fetch the weather information at this time."


def get_market_price(commodity: str, state: str = "Karnataka", market: str = None) -> str:
    """
    Fetches the latest wholesale market price for a commodity from data.gov.in (AGMARKNET).
    If a specific market is not found, it searches for prices across the entire state.
    """
    api_key = os.environ.get("DATAGOV_API_KEY")
    if not api_key:
        return "Error: Market Price API key is not configured."

    api_url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
    
    # First, try to find data for the specific market if provided
    if market:
        params = {
            "api-key": api_key, "format": "json", "limit": "10",
            "filters[state]": state,
            "filters[market]": market, 
            "filters[commodity]": commodity.title()
        }
        logger.info(f"Attempting to fetch market price with params: {params}")
        try:
            response = requests.get(api_url, params=params)
            response.raise_for_status()
            data = response.json()
            if data['records']:
                latest_record = max(data['records'], key=lambda x: datetime.strptime(x['arrival_date'], '%d/%m/%Y'))
                return (f"Latest price for {latest_record['commodity']} in {latest_record['market']} (on {latest_record['arrival_date']}): "
                        f"₹{latest_record['modal_price']} per Quintal.")
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed for specific market: {e}")
            return f"Sorry, there was an error connecting to the market price service."

    # If no data was found for the specific market, search the entire state as a fallback
    logger.info(f"No data for specific market. Searching for '{commodity}' in the entire state of '{state}'...")
    params = {
        "api-key": api_key, "format": "json", "limit": "10",
        "filters[state]": state,
        "filters[commodity]": commodity.title()
    }
    try:
        response = requests.get(api_url, params=params)
        response.raise_for_status()
        data = response.json()
        if data['records']:
            latest_record = max(data['records'], key=lambda x: datetime.strptime(x['arrival_date'], '%d/%m/%Y'))
            return (f"Sorry, I couldn't find recent data for '{commodity}' specifically in the '{market}' market. "
                    f"However, here are the latest prices from other markets in {state}:\n"
                    f"- {latest_record['market']} (on {latest_record['arrival_date']}): ₹{latest_record['modal_price']} per Quintal.")
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed for state-wide search: {e}")
        return f"Sorry, there was an error connecting to the market price service."

    return f"Sorry, I couldn't find any recent price data for '{commodity}' in any market in {state}. Please check the commodity spelling or try again later."
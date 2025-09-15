import os
import requests
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# --- Weather Tool (No Changes) ---
def get_weather(city: str = "Mysuru") -> str:
    """Fetches the current weather for a specified city from WeatherAPI.com."""
    api_key = os.environ.get("WEATHERAPI_API_KEY")
    if not api_key:
        logger.error("WeatherAPI.com key is not configured.")
        return "Error: Weather API key is not configured."

    base_url = "http://api.weatherapi.com/v1/current.json"
    params = {"key": api_key, "q": city, "aqi": "no"}
    
    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()
        
        weather_report = (
            f"The current weather in {data['location']['name']} is {data['current']['condition']['text']} "
            f"with a temperature of {data['current']['temp_c']}°C."
        )
        return weather_report
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching weather data: {e}")
        return "Sorry, I couldn't fetch the weather information at this time."

# --- Market Price Tool (Completely Rewritten with Smarter Logic) ---
def get_market_price(commodity: str, market: str, state: str = "Karnataka") -> str:
    """
    Fetches the latest wholesale market price for a commodity.
    If the specified market has no data, it intelligently searches for data in other markets within the same state.
    """
    api_key = os.environ.get("DATAGOV_API_KEY")
    if not api_key:
        logger.error("Data.gov.in API key is not configured.")
        return "Error: Market Price API key is not configured."

    api_url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
    
    def fetch_data(params):
        try:
            response = requests.get(api_url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching market price data: {e}")
            return None

    # Step 1: Try the specific market first
    logger.info(f"Attempting to fetch market price for '{commodity}' in '{market}'...")
    specific_params = {
        "api-key": api_key, "format": "json", "limit": "10",
        "filters[market]": market.title(), "filters[commodity]": commodity.title()
    }
    data = fetch_data(specific_params)

    if data and data.get('records'):
        latest_record = max(data['records'], key=lambda x: datetime.strptime(x['arrival_date'], '%d/%m/%Y'))
        return (
            f"Latest price for {latest_record['commodity']} in {latest_record['market']} (on {latest_record['arrival_date']}): "
            f"₹{latest_record['modal_price']} per Quintal."
        )

    # Step 2: If no data, try a broader search across the state
    logger.warning(f"No data found for '{market}'. Trying a broader search in '{state}'...")
    broad_params = {
        "api-key": api_key, "format": "json", "limit": "20", # Get more records for a broad search
        "filters[state]": state.title(), "filters[commodity]": commodity.title()
    }
    data = fetch_data(broad_params)

    if data and data.get('records'):
        # Get the top 3 most recent records from different markets
        sorted_records = sorted(data['records'], key=lambda x: datetime.strptime(x['arrival_date'], '%d/%m/%Y'), reverse=True)
        
        # Filter for unique markets
        unique_market_records = []
        seen_markets = set()
        for record in sorted_records:
            if record['market'] not in seen_markets:
                unique_market_records.append(record)
                seen_markets.add(record['market'])
            if len(unique_market_records) >= 3:
                break
        
        if unique_market_records:
            response_text = f"Sorry, I couldn't find recent data for '{commodity}' specifically in the '{market}' market. However, here are the latest prices from other markets in {state}:\n"
            for record in unique_market_records:
                response_text += f"- **{record['market']}** (on {record['arrival_date']}): ₹{record['modal_price']} per Quintal.\n"
            return response_text

    # Step 3: If still no data, return a final "not found" message
    return f"Sorry, I couldn't find any recent price data for '{commodity}' in any market in {state}. Please check the commodity spelling or try again later."


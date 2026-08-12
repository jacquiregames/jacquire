# src/server/utils.py
import socket
from typing import Tuple
from .models import HotelChain

def get_ip():
    """Helper function to get the local IP address of the server."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

# Price tables for different hotel chains:
PRICE_TABLE_LUXOR_TOWER = [
    (2, 200, 2000, 1000), (3, 300, 3000, 1500), (4, 400, 4000, 2000),
    (5, 500, 5000, 2500), ((6, 10), 600, 6000, 3000), ((11, 20), 700, 7000, 3500),
    ((21, 30), 800, 8000, 4000), ((31, 40), 900, 9000, 4500), ((41, 108), 1000, 10000, 5000),
]
PRICE_TABLE_FESTIVAL_WORLDWIDE_AMERICA = [
    (2, 300, 3000, 1500), (3, 400, 4000, 2000), (4, 500, 5000, 2500),
    (5, 600, 6000, 3000), ((6, 10), 700, 7000, 3500), ((11, 20), 800, 8000, 4000),
    ((21, 30), 900, 9000, 4500), ((31, 40), 1000, 10000, 5000), ((41, 108), 1100, 11000, 5500),
]
PRICE_TABLE_CONTINENTAL_IMPERIAL = [
    (2, 400, 4000, 2000), (3, 500, 5000, 2500), (4, 600, 6000, 3000),
    (5, 700, 7000, 3500), ((6, 10), 800, 8000, 4000), ((11, 20), 900, 9000, 4500),
    ((21, 30), 1000, 10000, 5000), ((31, 40), 1100, 11000, 5500), ((41, 108), 1200, 12000, 6000),
]

def get_price_info(size: int, chain: HotelChain) -> Tuple[int, int, int]:
    if chain in [HotelChain.LUXOR, HotelChain.TOWER]: table = PRICE_TABLE_LUXOR_TOWER
    elif chain in [HotelChain.FESTIVAL, HotelChain.WORLDWIDE, HotelChain.AMERICAN]: table = PRICE_TABLE_FESTIVAL_WORLDWIDE_AMERICA
    else: table = PRICE_TABLE_CONTINENTAL_IMPERIAL
    for condition, price, major, minor in table:
        if isinstance(condition, int) and size == condition: return price, major, minor
        elif isinstance(condition, tuple) and condition[0] <= size <= condition[1]: return price, major, minor
    return 0, 0, 0

# FIX: single source of truth for pricing. The frontend used to hardcode a
# second copy of these three tables (src/utils/stockPricing.ts) purely for
# display purposes (merger/majority-minority previews, stock ticker). Nothing
# enforced the two stayed in sync. This helper serializes the tables the
# server actually uses so the frontend can fetch them once at startup instead
# of maintaining its own copy.
def get_price_tables_for_client() -> dict:
    def serialize(table):
        return [
            {
                "min_size": cond[0] if isinstance(cond, tuple) else cond,
                "max_size": cond[1] if isinstance(cond, tuple) else cond,
                "price": price,
                "majority": major,
                "minority": minor,
            }
            for cond, price, major, minor in table
        ]

    return {
        "Luxor": serialize(PRICE_TABLE_LUXOR_TOWER),
        "Tower": serialize(PRICE_TABLE_LUXOR_TOWER),
        "Festival": serialize(PRICE_TABLE_FESTIVAL_WORLDWIDE_AMERICA),
        "Worldwide": serialize(PRICE_TABLE_FESTIVAL_WORLDWIDE_AMERICA),
        "American": serialize(PRICE_TABLE_FESTIVAL_WORLDWIDE_AMERICA),
        "Continental": serialize(PRICE_TABLE_CONTINENTAL_IMPERIAL),
        "Imperial": serialize(PRICE_TABLE_CONTINENTAL_IMPERIAL),
    }

def get_chain_color(chain: str) -> str:
    return {
        "Luxor": "#f73406",      # Red
        "Tower": "#f0d143",      # Gold
        "Festival": "#24a32e",   # Bright Green
        "Worldwide": "#be6e17",  # Tan
        "American": "#0e233a",   # Navy Blue
        "Continental": "#007a87",# Aqua
        "Imperial": "#e24666",   # Lavender
    }.get(chain, "#aaa")  # fallback: light gray

import requests
import time
import schedule
from datetime import datetime
import os
from dotenv import load_dotenv
from database import DatabaseManager

load_dotenv()

class OpenSkyCollector:
    def __init__(self):
        self.base_url = "https://opensky-network.org/api"
        self.db = DatabaseManager()
        print("📡 Using anonymous access (rate limited)")
    
    def get_states(self):
        """Get current aircraft states without authentication"""
        try:
            params = {
                'lamin': 3.5,
                'lamax': 6.0,
                'lomin': 100.0,
                'lomax': 102.0
            }
            
            print(f"📡 Fetching data...", end=' ')
            
            response = requests.get(
                f"{self.base_url}/states/all",
                params=params,
                timeout=30
            )
            
            if response.status_code == 200:
                print(f"✅ Success")
                data = response.json()
                flights = self._parse_states(data)
                print(f"   Found {len(flights)} flights in region")
                return flights
            elif response.status_code == 429:
                print(f"⚠️ Rate limited (429)")
                return []
            else:
                print(f"❌ Error {response.status_code}")
                return []
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return []
    
    def _parse_states(self, data):
        flights = []
        if 'states' not in data or not data['states']:
            return flights
        
        for state in data['states']:
            if state[5] and state[6]:  # longitude and latitude exist
                flight = {
                    'icao24': state[0],
                    'callsign': state[1].strip() if state[1] else 'Unknown',
                    'latitude': state[6],
                    'longitude': state[5],
                    'altitude': state[7] if state[7] else 0,
                    'on_ground': state[8] if state[8] else False,
                    'velocity': state[9] if state[9] else 0,
                    'heading': state[10] if state[10] else 0,
                    'vertical_rate': state[11] if state[11] else 0
                }
                flights.append(flight)
        
        return flights
    
    def collect_data(self):
        print(f"\n{'='*50}")
        print(f"🕒 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*50}")
        
        flights = self.get_states()
        
        if flights:
            self.db.save_flight_data(flights)
            airports = self.db.detect_airports(flights)
            
            perak_flights = [f for f in flights if self.db._is_over_perak(f)]
            print(f"\n✈️  Flights over Perak: {len(perak_flights)}")
            
            for flight in perak_flights[:5]:
                callsign = flight['callsign'] if flight['callsign'] != 'Unknown' else flight['icao24'][:6]
                alt = flight['altitude']
                alt_display = f"{alt:.0f}m" if alt > 0 else "On ground"
                print(f"   • {callsign}: {alt_display}")
        else:
            print("❌ No flights found")
    
    def run_continuous(self):
        print("\n🚀 Starting continuous data collection...")
        print("📋 System will collect data every 2 minutes")
        print("⌨️  Press Ctrl+C to stop\n")
        
        self.collect_data()
        schedule.every(2).minutes.do(self.collect_data)
        
        try:
            while True:
                schedule.run_pending()
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\n👋 Data collection stopped")
            stats = self.db.get_statistics()
            print(f"📊 Final statistics:")
            print(f"   Total flights recorded: {stats['total_flights']}")
            print(f"   Airports detected: {stats['airports_detected']}")

if __name__ == "__main__":
    collector = OpenSkyCollector()
    collector.run_continuous()
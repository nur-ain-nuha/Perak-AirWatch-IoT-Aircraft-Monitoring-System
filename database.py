import os
import csv
from datetime import datetime
from pathlib import Path

# Try to import pandas, but don't fail if not available
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    print("Warning: pandas not installed. Some features will be limited.")

class DatabaseManager:
    def __init__(self, db_type='csv', db_path='./data'):
        self.db_type = db_type
        self.db_path = db_path
        
        # Create data directory if it doesn't exist
        Path(db_path).mkdir(parents=True, exist_ok=True)
        
        if db_type == 'csv':
            self.flights_file = os.path.join(db_path, 'flights_data.csv')
            self.airports_file = os.path.join(db_path, 'detected_airports.csv')
            self._init_csv_files()
    
    def _init_csv_files(self):
        """Initialize CSV files with headers if they don't exist"""
        if not os.path.exists(self.flights_file):
            with open(self.flights_file, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'timestamp', 'icao24', 'callsign', 'latitude', 
                    'longitude', 'altitude', 'velocity', 'heading',
                    'vertical_rate', 'on_ground'
                ])
        
        if not os.path.exists(self.airports_file):
            with open(self.airports_file, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'timestamp', 'icao24', 'callsign', 'latitude', 
                    'longitude', 'altitude', 'reason'
                ])
    
    def save_flight_data(self, flights):
        """Save flight data to CSV"""
        if not flights:
            return
        
        with open(self.flights_file, 'a', newline='') as f:
            writer = csv.writer(f)
            current_time = datetime.now().isoformat()
            
            for flight in flights:
                # Only save flights over Perak (approximate bounds)
                if self._is_over_perak(flight):
                    writer.writerow([
                        current_time,
                        flight.get('icao24', ''),
                        flight.get('callsign', ''),
                        flight.get('latitude', 0),
                        flight.get('longitude', 0),
                        flight.get('altitude', 0),
                        flight.get('velocity', 0),
                        flight.get('heading', 0),
                        flight.get('vertical_rate', 0),
                        flight.get('on_ground', False)
                    ])
    
    def _is_over_perak(self, flight):
        """Check if flight is over Perak state (approximate bounds)"""
        lat = flight.get('latitude', 0)
        lon = flight.get('longitude', 0)
        
        # Approximate bounds for Perak
        perak_bounds = {
            'min_lat': 3.7,
            'max_lat': 5.5,
            'min_lon': 100.3,
            'max_lon': 101.6
        }
        
        return (perak_bounds['min_lat'] <= lat <= perak_bounds['max_lat'] and 
                perak_bounds['min_lon'] <= lon <= perak_bounds['max_lon'])
    
    def detect_airports(self, flights):
        """Detect potential airports from flight patterns"""
        potential_airports = []
        
        for flight in flights:
            # Check for grounded aircraft (potential airport location)
            if flight.get('on_ground', False):
                lat = flight.get('latitude')
                lon = flight.get('longitude')
                
                # Check if we haven't recorded this location recently
                if not self._is_duplicate_airport(lat, lon):
                    airport_data = {
                        'timestamp': datetime.now().isoformat(),
                        'icao24': flight.get('icao24', ''),
                        'callsign': flight.get('callsign', ''),
                        'latitude': lat,
                        'longitude': lon,
                        'altitude': 0,
                        'reason': 'Aircraft on ground'
                    }
                    potential_airports.append(airport_data)
                    
                    # Save to airports file
                    with open(self.airports_file, 'a', newline='') as f:
                        writer = csv.writer(f)
                        writer.writerow(airport_data.values())
        
        return potential_airports
    
    def _is_duplicate_airport(self, lat, lon, threshold_km=5):
        """Check if airport location is duplicate (within threshold km)"""
        if not os.path.exists(self.airports_file):
            return False
        
        try:
            # Simple check without pandas
            with open(self.airports_file, 'r') as f:
                reader = csv.reader(f)
                next(reader)  # Skip header
                
                for row in reader:
                    if len(row) >= 5:
                        try:
                            existing_lat = float(row[3])
                            existing_lon = float(row[4])
                            
                            # Simple distance calculation (approximate)
                            lat_diff = (lat - existing_lat) * 111  # km per degree
                            lon_diff = (lon - existing_lon) * 111 * 0.7  # adjust for latitude
                            distance = (lat_diff**2 + lon_diff**2)**0.5
                            
                            if distance < threshold_km:
                                return True
                        except:
                            continue
            return False
        except:
            return False
    
    def get_historical_data(self, hours=24):
        """Get historical flight data for visualization"""
        if not os.path.exists(self.flights_file):
            return []
        
        if PANDAS_AVAILABLE:
            try:
                df = pd.read_csv(self.flights_file)
                if df.empty:
                    return []
                
                df['timestamp'] = pd.to_datetime(df['timestamp'])
                cutoff_time = datetime.now() - pd.Timedelta(hours=hours)
                df = df[df['timestamp'] >= cutoff_time]
                
                return df.to_dict('records')
            except:
                pass
        
        # Fallback: return last 100 records without filtering
        return self._get_recent_records(100)
    
    def _get_recent_records(self, limit=100):
        """Get recent records without pandas"""
        records = []
        try:
            with open(self.flights_file, 'r') as f:
                reader = csv.reader(f)
                next(reader)  # Skip header
                for row in reader:
                    if len(row) >= 6:
                        records.append({
                            'timestamp': row[0],
                            'icao24': row[1],
                            'callsign': row[2],
                            'latitude': float(row[3]),
                            'longitude': float(row[4]),
                            'altitude': float(row[5])
                        })
            return records[-limit:]
        except:
            return []
    
    def get_airport_data(self):
        """Get detected airport data"""
        airports = []
        try:
            with open(self.airports_file, 'r') as f:
                reader = csv.reader(f)
                next(reader)  # Skip header
                for row in reader:
                    if len(row) >= 7:
                        airports.append({
                            'timestamp': row[0],
                            'icao24': row[1],
                            'callsign': row[2],
                            'latitude': float(row[3]),
                            'longitude': float(row[4]),
                            'altitude': float(row[5]),
                            'reason': row[6]
                        })
            return airports
        except:
            return []
    
    def get_statistics(self):
        """Get basic statistics for dashboard"""
        stats = {
            'total_flights': 0,
            'airports_detected': 0,
            'avg_altitude': 0,
            'max_altitude': 0,
            'active_flights': 0,
            'collection_days': 0
        }
        
        # Count flights
        try:
            with open(self.flights_file, 'r') as f:
                reader = csv.reader(f)
                next(reader)  # Skip header
                rows = list(reader)
                stats['total_flights'] = len(rows)
                
                if rows:
                    # Calculate average and max altitude
                    altitudes = []
                    for row in rows:
                        try:
                            altitudes.append(float(row[5]))
                        except:
                            pass
                    
                    if altitudes:
                        stats['avg_altitude'] = sum(altitudes) / len(altitudes)
                        stats['max_altitude'] = max(altitudes)
                    
                    # Calculate collection days
                    if len(rows) > 1 and rows[0] and rows[-1]:
                        try:
                            first = datetime.fromisoformat(rows[0][0])
                            last = datetime.fromisoformat(rows[-1][0])
                            days = (last - first).total_seconds() / 86400
                            stats['collection_days'] = round(days, 1)
                        except:
                            pass
        except:
            pass
        
        # Count airports
        try:
            with open(self.airports_file, 'r') as f:
                reader = csv.reader(f)
                next(reader)
                stats['airports_detected'] = len(list(reader))
        except:
            pass
        
        return stats
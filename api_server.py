from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from database import DatabaseManager
from data_collector import OpenSkyCollector
import threading
import time
from datetime import datetime
import os

app = Flask(__name__, static_folder='../frontend')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

db = DatabaseManager()
collector = OpenSkyCollector()

latest_data = {'flights': [], 'timestamp': None}

def data_collection_thread():
    global latest_data
    while True:
        try:
            flights = collector.get_states()
            if flights:
                db.save_flight_data(flights)
                db.detect_airports(flights)
                
                latest_data = {
                    'flights': flights,
                    'timestamp': datetime.now().isoformat()
                }
                
                socketio.emit('data_update', {
                    'flights': flights,
                    'timestamp': datetime.now().isoformat()
                })
                print(f"📊 Updated: {len(flights)} flights")
            
            time.sleep(120)
            
        except Exception as e:
            print(f"❌ Error in collection thread: {e}")
            time.sleep(60)

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'dashboard.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

@app.route('/api/flights/current')
def get_current_flights():
    return jsonify({
        'flights': latest_data['flights'],
        'timestamp': latest_data['timestamp']
    })

@app.route('/api/flights/historical')
def get_historical_flights():
    data = db.get_historical_data(hours=24)
    return jsonify(data)

@app.route('/api/airports')
def get_airports():
    airports = db.get_airport_data()
    return jsonify(airports)

@app.route('/api/stats')
def get_stats():
    stats = db.get_statistics()
    return jsonify(stats)

@app.route('/api/flights/recent/<int:hours>')
def get_recent_flights(hours):
    data = db.get_historical_data(hours=hours)
    return jsonify(data)

@socketio.on('connect')
def handle_connect():
    print('👤 Client connected')
    emit('connected', {'data': 'Connected to server'})

if __name__ == '__main__':
    print("🚀 Starting Perak Aircraft Monitoring System")
    print("📡 Initializing data collection...")
    thread = threading.Thread(target=data_collection_thread, daemon=True)
    thread.start()
    
    print("🌐 Web server starting at http://localhost:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)
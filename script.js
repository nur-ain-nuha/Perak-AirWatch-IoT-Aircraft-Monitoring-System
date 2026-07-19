// Global variables
let map;
let flightMarkers = [];
let airportMarkers = [];
let altitudeChart;
let timelineChart;
let socket;
let currentFlights = [];
let heatmapLayer = null;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeCharts();
    connectWebSocket();
    fetchStats();
    fetchAirports();
    fetchCurrentFlights();
    
    // Update data every 30 seconds
    setInterval(fetchCurrentFlights, 30000);
    setInterval(fetchStats, 60000);
    setInterval(fetchAirports, 300000); // Every 5 minutes
});

// Initialize Leaflet map
function initializeMap() {
    map = L.map('map').setView([4.5, 101.0], 8); // Centered on Perak
    
    // Use a more modern map style
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
    
    // Add Perak boundary with better styling
    const perakBounds = [
        [3.7, 100.3],
        [5.5, 101.6]
    ];
    
    L.rectangle(perakBounds, {
        color: "#667eea",
        weight: 3,
        fillOpacity: 0.1,
        dashArray: '5, 5',
        className: 'perak-boundary'
    }).addTo(map).bindTooltip("Perak Airspace", { 
        permanent: false,
        direction: 'center',
        className: 'boundary-tooltip'
    });
    
    // Add scale bar
    L.control.scale({ imperial: false, metric: true }).addTo(map);
}

// Initialize charts
function initializeCharts() {
    // Altitude Chart
    const altitudeCtx = document.getElementById('altitudeChart').getContext('2d');
    altitudeChart = new Chart(altitudeCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Altitude (m)',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#667eea',
                pointBorderColor: 'white',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1e293b',
                    bodyColor: '#64748b',
                    borderColor: '#667eea',
                    borderWidth: 2,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            return `Altitude: ${context.raw.toFixed(0)} m`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                    },
                    title: {
                        display: true,
                        text: 'Altitude (meters)',
                        color: '#64748b',
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            return value + ' m';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 11
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
    
    // Timeline Chart
    const timelineCtx = document.getElementById('timelineChart').getContext('2d');
    timelineChart = new Chart(timelineCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Number of Flights',
                data: [],
                backgroundColor: 'rgba(118, 75, 162, 0.8)',
                hoverBackgroundColor: 'rgba(102, 126, 234, 1)',
                borderRadius: 8,
                barPercentage: 0.7,
                categoryPercentage: 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1e293b',
                    bodyColor: '#64748b',
                    borderColor: '#764ba2',
                    borderWidth: 2,
                    callbacks: {
                        label: function(context) {
                            return `Flights: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                    },
                    title: {
                        display: true,
                        text: 'Flight Count',
                        color: '#64748b',
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    },
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            if (Math.floor(value) === value) {
                                return value;
                            }
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 10
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

// Connect to WebSocket for real-time updates
function connectWebSocket() {
    socket = io('http://localhost:5000');
    
    socket.on('connect', function() {
        console.log('✅ Connected to server');
        showToast('Connected to live data stream', 'success');
    });
    
    socket.on('data_update', function(data) {
        console.log('📡 Received real-time update:', data);
        if (data.flights && data.flights.length > 0) {
            updateMap(data.flights);
            updateFlightsList(data.flights);
            currentFlights = data.flights;
            updateAltitudeChart(data.flights);
            updateFlightCount(data.flights);
            showToast(`Tracking ${data.flights.length} aircraft`, 'info');
        }
    });
    
    socket.on('disconnect', function() {
        console.log('❌ Disconnected from server');
        showToast('Disconnected from server. Reconnecting...', 'warning');
    });
    
    socket.on('connect_error', function(error) {
        console.log('Connection error:', error);
        showToast('Connection error. Retrying...', 'error');
    });
}

// Fetch current flights
function fetchCurrentFlights() {
    fetch('/api/flights/current')
        .then(response => response.json())
        .then(data => {
            if (data.flights) {
                updateMap(data.flights);
                updateFlightsList(data.flights);
                currentFlights = data.flights;
                updateAltitudeChart(data.flights);
                updateFlightCount(data.flights);
            }
        })
        .catch(error => {
            console.error('Error fetching flights:', error);
            showToast('Failed to fetch flight data', 'error');
        });
}

// Fetch statistics
function fetchStats() {
    fetch('/api/stats')
        .then(response => response.json())
        .then(data => {
            // Animate the number changes
            animateValue('totalFlights', document.getElementById('totalFlights').textContent, data.total_flights || 0);
            animateValue('activeFlights', document.getElementById('activeFlights').textContent, data.active_flights || 0);
            animateValue('avgAltitude', document.getElementById('avgAltitude').textContent, Math.round(data.avg_altitude || 0));
            animateValue('maxAltitude', document.getElementById('maxAltitude').textContent, Math.round(data.max_altitude || 0));
            animateValue('airportsDetected', document.getElementById('airportsDetected').textContent, data.airports_detected || 0);
            animateValue('collectionDays', document.getElementById('collectionDays').textContent, data.collection_days || 0);
            
            // Update timeline chart
            updateTimelineChart();
        })
        .catch(error => {
            console.error('Error fetching stats:', error);
        });
}

// Fetch airports
function fetchAirports() {
    fetch('/api/airports')
        .then(response => response.json())
        .then(data => {
            updateAirportsList(data);
            updateAirportMarkers(data);
            if (data.length > 0) {
                document.querySelector('.list-badge').innerHTML = `<i class="fas fa-gem"></i> ${data.length} Airports Found`;
            }
        })
        .catch(error => {
            console.error('Error fetching airports:', error);
            document.getElementById('airportsList').innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 40px; color: #ef4444;"></i>
                    <p>Failed to load airport data</p>
                </div>
            `;
        });
}

// Update map with flight markers
function updateMap(flights) {
    // Clear existing markers
    flightMarkers.forEach(marker => map.removeLayer(marker));
    flightMarkers = [];
    
    // Filter flights over Perak for better visualization
    const perakFlights = flights.filter(flight => 
        flight.latitude && flight.longitude &&
        flight.latitude >= 3.7 && flight.latitude <= 5.5 &&
        flight.longitude >= 100.3 && flight.longitude <= 101.6
    );
    
    // Add new markers
    perakFlights.forEach(flight => {
        if (flight.latitude && flight.longitude) {
            // Determine marker color based on altitude
            let color = '#28a745'; // Low altitude
            let altitudeLevel = 'Low';
            if (flight.altitude > 5000) {
                color = '#dc3545'; // High altitude
                altitudeLevel = 'High';
            } else if (flight.altitude > 2000) {
                color = '#fd7e14'; // Medium altitude
                altitudeLevel = 'Medium';
            }
            
            // Create custom icon with altitude indicator
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `
                    <div style="
                        background-color: ${color}; 
                        width: 16px; 
                        height: 16px; 
                        border-radius: 50%; 
                        border: 3px solid white; 
                        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                        animation: pulse-marker 2s infinite;
                    ">
                        <div style="
                            position: absolute;
                            top: -20px;
                            left: 50%;
                            transform: translateX(-50%);
                            background: rgba(0,0,0,0.7);
                            color: white;
                            padding: 2px 6px;
                            border-radius: 12px;
                            font-size: 10px;
                            white-space: nowrap;
                            display: ${flight.callsign && flight.callsign !== 'Unknown' ? 'block' : 'none'};
                        ">${flight.callsign || ''}</div>
                    </div>
                `,
                iconSize: [22, 22],
                popupAnchor: [0, -15]
            });
            
            const marker = L.marker([flight.latitude, flight.longitude], { icon })
                .bindPopup(`
                    <div style="font-family: 'Poppins', sans-serif; min-width: 200px;">
                        <h4 style="margin: 0 0 10px 0; color: #1e293b; border-bottom: 2px solid #667eea; padding-bottom: 5px;">
                            <i class="fas fa-plane" style="color: #667eea;"></i> 
                            ${flight.callsign && flight.callsign !== 'Unknown' ? flight.callsign : 'Aircraft ' + flight.icao24.slice(0,6)}
                        </h4>
                        <table style="width: 100%; font-size: 12px;">
                            <tr>
                                <td style="color: #64748b;">ICAO24:</td>
                                <td style="font-weight: 500;">${flight.icao24}</td>
                            </tr>
                            <tr>
                                <td style="color: #64748b;">Altitude:</td>
                                <td style="font-weight: 600; color: ${color};">${Math.round(flight.altitude)} m (${altitudeLevel})</td>
                            </tr>
                            <tr>
                                <td style="color: #64748b;">Speed:</td>
                                <td>${Math.round(flight.velocity || 0)} m/s</td>
                            </tr>
                            <tr>
                                <td style="color: #64748b;">Heading:</td>
                                <td>${Math.round(flight.heading || 0)}°</td>
                            </tr>
                            <tr>
                                <td style="color: #64748b;">Position:</td>
                                <td>${flight.latitude.toFixed(4)}, ${flight.longitude.toFixed(4)}</td>
                            </tr>
                        </table>
                    </div>
                `);
            
            marker.addTo(map);
            flightMarkers.push(marker);
        }
    });
    
    // Update map bounds if there are flights
    if (perakFlights.length > 0) {
        const bounds = perakFlights.map(f => [f.latitude, f.longitude]);
        if (bounds.length > 0) {
            // Only fit bounds if not too spread out
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
        }
    }
}

// Update airport markers
function updateAirportMarkers(airports) {
    // Clear existing markers
    airportMarkers.forEach(marker => map.removeLayer(marker));
    airportMarkers = [];
    
    // Add new markers
    airports.forEach(airport => {
        if (airport.latitude && airport.longitude) {
            const icon = L.divIcon({
                className: 'airport-marker',
                html: `
                    <div style="
                        background: linear-gradient(135deg, #f43f5e, #ef4444);
                        width: 30px;
                        height: 30px;
                        border-radius: 50%;
                        border: 3px solid white;
                        box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        animation: pulse-airport 2s infinite;
                    ">
                        <i class="fas fa-map-pin" style="color: white; font-size: 14px;"></i>
                    </div>
                `,
                iconSize: [36, 36],
                popupAnchor: [0, -15]
            });
            
            const marker = L.marker([airport.latitude, airport.longitude], { icon })
                .bindPopup(`
                    <div style="font-family: 'Poppins', sans-serif;">
                        <h4 style="margin: 0 0 10px 0; color: #f43f5e;">
                            <i class="fas fa-map-pin"></i> Potential Airport
                        </h4>
                        <p style="margin: 5px 0; font-size: 12px;">
                            <i class="fas fa-clock" style="color: #64748b;"></i> 
                            ${new Date(airport.timestamp).toLocaleString()}
                        </p>
                        <p style="margin: 5px 0; font-size: 12px;">
                            <i class="fas fa-plane" style="color: #64748b;"></i> 
                            Flight: ${airport.callsign || airport.icao24}
                        </p>
                        <p style="margin: 5px 0; font-size: 12px;">
                            <i class="fas fa-info-circle" style="color: #64748b;"></i> 
                            ${airport.reason}
                        </p>
                        <p style="margin: 5px 0; font-size: 12px; color: #10b981;">
                            <i class="fas fa-check-circle"></i> GPS-Inferred Location
                        </p>
                    </div>
                `);
            
            marker.addTo(map);
            airportMarkers.push(marker);
        }
    });
}

// Update flights list
function updateFlightsList(flights) {
    const container = document.getElementById('flightsList');
    
    if (!flights || flights.length === 0) {
        container.innerHTML = `
            <div class="loading-state">
                <div class="loader"></div>
                <p>Scanning Perak airspace for aircraft...</p>
                <small style="color: #94a3b8; margin-top: 10px;">No flights detected at this moment</small>
            </div>
        `;
        return;
    }
    
    // Filter flights over Perak
    const perakFlights = flights.filter(flight => 
        flight.latitude >= 3.7 && flight.latitude <= 5.5 &&
        flight.longitude >= 100.3 && flight.longitude <= 101.6
    );
    
    if (perakFlights.length === 0) {
        container.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-map-marker-alt" style="font-size: 40px; color: #667eea; margin-bottom: 15px;"></i>
                <p>No flights currently over Perak</p>
                <small style="color: #94a3b8;">Aircraft detected in nearby regions</small>
            </div>
        `;
        return;
    }
    
    let html = '';
    perakFlights.sort((a, b) => b.altitude - a.altitude).forEach((flight, index) => {
        let altitudeClass = 'altitude-low';
        let altitudeIcon = 'fa-arrow-down';
        if (flight.altitude > 5000) {
            altitudeClass = 'altitude-high';
            altitudeIcon = 'fa-rocket';
        } else if (flight.altitude > 2000) {
            altitudeClass = 'altitude-medium';
            altitudeIcon = 'fa-arrow-up';
        }
        
        // Add animation delay based on index
        const delay = index * 0.1;
        
        html += `
            <div class="flight-item" style="animation: slideIn 0.5s ease ${delay}s both;">
                <div class="flight-callsign">
                    <i class="fas fa-plane" style="color: #667eea;"></i>
                    <span style="font-weight: 600;">${flight.callsign && flight.callsign !== 'Unknown' ? flight.callsign : flight.icao24.slice(0,8)}</span>
                    <span style="margin-left: auto; font-size: 11px; background: rgba(102,126,234,0.1); padding: 2px 8px; border-radius: 12px;">
                        ${flight.icao24.slice(-4)}
                    </span>
                </div>
                <div class="flight-details">
                    <span>
                        <i class="fas fa-map-marker-alt"></i>
                        ${flight.latitude.toFixed(3)}, ${flight.longitude.toFixed(3)}
                    </span>
                    <span class="${altitudeClass}">
                        <i class="fas ${altitudeIcon}"></i>
                        ${Math.round(flight.altitude)}m
                    </span>
                    <span>
                        <i class="fas fa-tachometer-alt"></i>
                        ${Math.round(flight.velocity || 0)}m/s
                    </span>
                </div>
                <div style="font-size: 10px; color: #94a3b8; margin-top: 5px;">
                    <i class="fas fa-compass"></i> Heading: ${Math.round(flight.heading || 0)}°
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Update airports list
function updateAirportsList(airports) {
    const container = document.getElementById('airportsList');
    
    if (!airports || airports.length === 0) {
        container.innerHTML = `
            <div class="loading-state">
                <div class="pulse-circles">
                    <div class="circle"></div>
                    <div class="circle"></div>
                    <div class="circle"></div>
                </div>
                <p>Analyzing aircraft ground patterns...</p>
                <small style="color: #94a3b8; margin-top: 10px;">Waiting for aircraft to land for airport detection</small>
            </div>
        `;
        return;
    }
    
    let html = '';
    airports.slice(-5).reverse().forEach((airport, index) => {
        const delay = index * 0.1;
        html += `
            <div class="airport-item" style="animation: slideIn 0.5s ease ${delay}s both;">
                <i class="fas fa-map-pin" style="color: #f43f5e; font-size: 18px;"></i>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="color: #1e293b;">${airport.callsign || airport.icao24}</strong>
                        <span style="background: rgba(244, 63, 94, 0.1); color: #f43f5e; padding: 2px 8px; border-radius: 12px; font-size: 10px;">
                            <i class="fas fa-star"></i> GPS
                        </span>
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
                        <i class="fas fa-clock"></i> ${new Date(airport.timestamp).toLocaleTimeString()}
                    </div>
                    <div style="font-size: 11px; color: #64748b;">
                        ${airport.reason}
                    </div>
                </div>
                <div class="airport-coords">
                    ${airport.latitude.toFixed(3)}<br>
                    ${airport.longitude.toFixed(3)}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Update altitude chart
function updateAltitudeChart(flights) {
    const perakFlights = flights.filter(flight => 
        flight.latitude >= 3.7 && flight.latitude <= 5.5 &&
        flight.longitude >= 100.3 && flight.longitude <= 101.6
    );
    
    if (perakFlights.length === 0) {
        altitudeChart.data.labels = ['No Flights'];
        altitudeChart.data.datasets[0].data = [0];
        altitudeChart.update();
        return;
    }
    
    // Sort by altitude for better visualization
    perakFlights.sort((a, b) => b.altitude - a.altitude);
    
    const labels = perakFlights.map(f => {
        const callsign = f.callsign && f.callsign !== 'Unknown' ? f.callsign : f.icao24.slice(0, 8);
        return callsign.length > 8 ? callsign.slice(0, 8) + '...' : callsign;
    });
    
    const altitudes = perakFlights.map(f => f.altitude);
    
    // Update chart with animation
    altitudeChart.data.labels = labels;
    altitudeChart.data.datasets[0].data = altitudes;
    
    // Set different colors for each bar based on altitude
    altitudeChart.data.datasets[0].pointBackgroundColor = altitudes.map(alt => 
        alt > 5000 ? '#dc3545' : alt > 2000 ? '#fd7e14' : '#28a745'
    );
    
    altitudeChart.update();
}

// Update timeline chart with hourly data
function updateTimelineChart() {
    fetch('/api/flights/recent/24')
        .then(response => response.json())
        .then(data => {
            if (!data || data.length === 0) {
                timelineChart.data.labels = Array(24).fill('').map((_, i) => `${i}:00`);
                timelineChart.data.datasets[0].data = Array(24).fill(0);
                timelineChart.update();
                return;
            }
            
            // Group by hour
            const hourlyCounts = {};
            for (let i = 0; i < 24; i++) {
                hourlyCounts[i] = 0;
            }
            
            data.forEach(flight => {
                try {
                    const hour = new Date(flight.timestamp).getHours();
                    hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
                } catch (e) {
                    console.log('Invalid timestamp:', flight.timestamp);
                }
            });
            
            // Create labels for last 24 hours
            const labels = [];
            const counts = [];
            const now = new Date();
            
            for (let i = 23; i >= 0; i--) {
                const hour = new Date(now - i * 3600000).getHours();
                const hourStr = hour.toString().padStart(2, '0') + ':00';
                labels.push(hourStr);
                counts.push(hourlyCounts[hour] || 0);
            }
            
            timelineChart.data.labels = labels;
            timelineChart.data.datasets[0].data = counts;
            
            // Add colors based on activity
            timelineChart.data.datasets[0].backgroundColor = counts.map(count => 
                count > 10 ? '#dc3545' : count > 5 ? '#fd7e14' : '#10b981'
            );
            
            timelineChart.update();
            
            // Update footer with peak hour
            const maxCount = Math.max(...counts);
            const maxHourIndex = counts.indexOf(maxCount);
            if (maxCount > 0) {
                document.querySelector('.chart-footer span').innerHTML = 
                    `<i class="fas fa-clock"></i> Peak: ${labels[maxHourIndex]} (${maxCount} flights)`;
            }
        })
        .catch(error => {
            console.error('Error updating timeline:', error);
        });
}

// Update flight count
function updateFlightCount(flights) {
    const perakFlights = flights.filter(flight => 
        flight.latitude >= 3.7 && flight.latitude <= 5.5 &&
        flight.longitude >= 100.3 && flight.longitude <= 101.6
    );
    const countElement = document.querySelector('.list-count');
    if (countElement) {
        countElement.textContent = perakFlights.length;
        
        // Add animation
        countElement.style.transform = 'scale(1.2)';
        setTimeout(() => {
            countElement.style.transform = 'scale(1)';
        }, 200);
    }
}

// Animate value changes
function animateValue(elementId, oldValue, newValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const start = parseInt(oldValue) || 0;
    const end = parseInt(newValue) || 0;
    
    if (start === end) return;
    
    // Add highlight animation
    element.style.backgroundColor = 'rgba(102, 126, 234, 0.2)';
    element.style.transition = 'background-color 0.5s';
    
    setTimeout(() => {
        element.style.backgroundColor = 'transparent';
    }, 500);
    
    // Update the value
    element.textContent = end;
}

// Map control functions
function centerMap() {
    map.setView([4.5, 101.0], 8);
    showToast('Map centered on Perak airspace', 'info');
}

function toggleHeatmap() {
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
        showToast('Heatmap disabled', 'info');
    } else {
        showToast('Heatmap feature coming soon!', 'warning');
        // You can implement actual heatmap here if desired
    }
}

function refreshMap() {
    showToast('Refreshing flight data...', 'info');
    fetchCurrentFlights();
}

// Toast notification system
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}" style="font-size: 20px;"></i>
        <div style="flex: 1;">
            <div style="font-weight: 500;">${message}</div>
            <div style="font-size: 11px; opacity: 0.7;">${new Date().toLocaleTimeString()}</div>
        </div>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; cursor: pointer; opacity: 0.5;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }
    }, 5000);
}

// Update datetime display
function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
    };
    
    document.getElementById('currentDateTime').innerHTML = `
        <i class="fas fa-calendar-alt" style="margin-right: 5px;"></i>
        ${now.toLocaleString('en-MY', options)}
    `;
}

// Initialize datetime updates
setInterval(updateDateTime, 1000);
updateDateTime();

// Add CSS animations dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse-marker {
        0%, 100% {
            transform: scale(1);
            opacity: 1;
        }
        50% {
            transform: scale(1.2);
            opacity: 0.8;
        }
    }
    
    @keyframes pulse-airport {
        0%, 100% {
            transform: scale(1);
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
        }
        50% {
            transform: scale(1.1);
            box-shadow: 0 8px 25px rgba(239, 68, 68, 0.6);
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .perak-boundary {
        animation: dash 20s linear infinite;
    }
    
    @keyframes dash {
        to {
            stroke-dashoffset: -20;
        }
    }
    
    .boundary-tooltip {
        background: rgba(102, 126, 234, 0.9) !important;
        color: white !important;
        font-weight: 500 !important;
        padding: 5px 10px !important;
        border-radius: 20px !important;
        border: none !important;
    }
`;
document.head.appendChild(style);
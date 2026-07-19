import requests

# Try different combinations
credentials = [
    ("husna", "Husnasky7"),
    ("hsnsyza@gmail.com", "Husnasky7"),
]

print("Testing OpenSky Network login...\n")

for username, password in credentials:
    print(f"Trying: {username}")
    try:
        session = requests.Session()
        session.auth = (username, password)
        
        response = session.get(
            "https://opensky-network.org/api/states/all",
            params={"lamin": 3.5, "lamax": 6.0, "lomin": 100.0, "lomax": 102.0},
            timeout=30
        )
        
        if response.status_code == 200:
            print(f"✅ SUCCESS! Credentials work with {username}")
            data = response.json()
            if 'states' in data and data['states']:
                print(f"   Found {len(data['states'])} aircraft")
            else:
                print("   No aircraft found at the moment")
            break
        elif response.status_code == 401:
            print(f"❌ Authentication failed for {username}")
        else:
            print(f"❌ Error {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    print()
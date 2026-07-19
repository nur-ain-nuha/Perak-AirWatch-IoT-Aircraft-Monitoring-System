import requests

print("Testing OpenSky Network API...\n")

# Test 1: Without authentication (public)
print("Test 1: Public access (no login):")
try:
    response = requests.get(
        "https://opensky-network.org/api/states/all",
        params={"lamin": 3.5, "lamax": 6.0, "lomin": 100.0, "lomax": 102.0},
        timeout=30
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success! Found {len(data.get('states', []))} aircraft")
    elif response.status_code == 429:
        print("⚠️ Rate limited - too many requests")
    else:
        print(f"❌ Failed: {response.text[:100]}")
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "="*50 + "\n")

# Test 2: With your credentials
print("Test 2: With your credentials:")
credentials = [
    ("husna", "Husnasky7"),
    ("hsnsyza@gmail.com", "Husnasky7"),
]

for username, password in credentials:
    print(f"\nTrying: {username}")
    try:
        session = requests.Session()
        session.auth = (username, password)
        
        response = session.get(
            "https://opensky-network.org/api/states/all",
            params={"lamin": 3.5, "lamax": 6.0, "lomin": 100.0, "lomax": 102.0},
            timeout=30
        )
        
        if response.status_code == 200:
            print(f"✅ SUCCESS! Credentials work!")
            data = response.json()
            print(f"Found {len(data.get('states', []))} aircraft")
            break
        elif response.status_code == 401:
            print(f"❌ Authentication failed")
        else:
            print(f"❌ Error {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
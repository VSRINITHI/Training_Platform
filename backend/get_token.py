import requests
import getpass

SUPABASE_URL = input("Supabase URL: ").strip()
SUPABASE_ANON_KEY = getpass.getpass("Supabase anon/publishable key: ").strip()
EMAIL = input("Supabase user email: ").strip()
PASSWORD = getpass.getpass("Supabase user password: ")

response = requests.post(
    f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
    headers={
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    },
    json={
        "email": EMAIL,
        "password": PASSWORD,
    },
)

print("\nStatus:", response.status_code)

if response.ok:
    data = response.json()
    print("\nACCESS TOKEN:\n")
    print(data["access_token"])
else:
    print("\nLogin failed:")
    print(response.text)
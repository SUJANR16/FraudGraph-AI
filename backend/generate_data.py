from pathlib import Path
import random
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT = DATA_DIR / "transactions.csv"

random.seed(42)

cities = [
    "Chennai", "Coimbatore", "Bengaluru", "Madurai",
    "Hyderabad", "Mumbai", "Delhi", "Pune",
    "Kochi", "Tiruchirappalli"
]

accounts = [f"A{i:04d}" for i in range(1, 1001)]
devices = [f"D{i:04d}" for i in range(1, 701)]
merchants = [f"M{i:04d}" for i in range(1, 301)]

rows = []

# Generate normal transactions.
for i in range(1, 9951):
    account = random.choice(accounts)
    rows.append({
        "transaction_id": f"TXN{i:06d}",
        "account_id": account,
        "device_id": random.choice(devices),
        "merchant_id": random.choice(merchants),
        "location": random.choice(cities),
        "amount": round(random.uniform(150, 18000), 2),
        "timestamp": (
            pd.Timestamp("2026-09-01")
            + pd.Timedelta(minutes=random.randint(0, 500000))
        ).isoformat(),
        "is_fraud": 0,
        "ring_id": "",
        "pattern": "NORMAL"
    })

# Inject four coordinated fraud patterns.
patterns = [
    ("RING_001", "SHARED_DEVICE_COMMON_DESTINATION"),
    ("RING_002", "COORDINATED_TRANSACTION_SEQUENCE"),
    ("RING_003", "ACCOUNT_BEHAVIOR_CHANGE"),
    ("RING_004", "COMMON_DESTINATION")
]

next_id = 9951

for ring_id, pattern in patterns:
    ring_accounts = random.sample(accounts, 5)
    shared_device = random.choice(devices)
    shared_merchant = random.choice(merchants)
    shared_city = random.choice(cities)

    for account in ring_accounts:
        for _ in range(2):
            if pattern == "SHARED_DEVICE_COMMON_DESTINATION":
                device = shared_device
                merchant = shared_merchant
                city = shared_city

            elif pattern == "COORDINATED_TRANSACTION_SEQUENCE":
                device = shared_device
                merchant = random.choice(merchants)
                city = shared_city

            elif pattern == "ACCOUNT_BEHAVIOR_CHANGE":
                device = random.choice(devices)
                merchant = shared_merchant
                city = random.choice(cities)

            else:
                device = random.choice(devices)
                merchant = shared_merchant
                city = shared_city

            rows.append({
                "transaction_id": f"TXN{next_id:06d}",
                "account_id": account,
                "device_id": device,
                "merchant_id": merchant,
                "location": city,
                "amount": round(random.uniform(25000, 95000), 2),
                "timestamp": (
                    pd.Timestamp("2026-09-25")
                    + pd.Timedelta(minutes=random.randint(0, 10000))
                ).isoformat(),
                "is_fraud": 1,
                "ring_id": ring_id,
                "pattern": pattern
            })

            next_id += 1

df = pd.DataFrame(rows)
df.to_csv(OUTPUT, index=False)

print("=" * 55)
print("       FRAUDGRAPH AI - DATA GENERATOR")
print("=" * 55)
print(f"Dataset saved: {OUTPUT}")
print(f"Total transactions: {len(df):,}")
print(f"Simulated fraud transactions: {int(df['is_fraud'].sum())}")
print(f"Normal transactions: {int((df['is_fraud'] == 0).sum())}")
print(f"Accounts represented: {df['account_id'].nunique()}")
print(f"Devices represented: {df['device_id'].nunique()}")
print(f"Merchants represented: {df['merchant_id'].nunique()}")
print(f"Fraud rings: {df.loc[df['ring_id'] != '', 'ring_id'].nunique()}")
print("=" * 55)
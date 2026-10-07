from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import pandas as pd


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="FraudGraph AI",
    description="Real-Time Financial Fraud Intelligence API",
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATA PATH
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_FILE = BASE_DIR / "data" / "transactions.csv"


# ============================================================
# LOAD DATA
# ============================================================

if not DATA_FILE.exists():
    raise FileNotFoundError(
        f"Transaction data not found at: {DATA_FILE}"
    )


df = pd.read_csv(DATA_FILE)


# ============================================================
# CLEAN DATA
# ============================================================

# Convert timestamp
if "timestamp" in df.columns:
    df["timestamp"] = pd.to_datetime(
        df["timestamp"],
        errors="coerce"
    )


# Make amount numeric
if "amount" in df.columns:
    df["amount"] = pd.to_numeric(
        df["amount"],
        errors="coerce"
    ).fillna(0)


# ============================================================
# PRE-CALCULATED COUNTS
# IMPORTANT:
# This prevents calculate_transaction_risk()
# from scanning the entire dataframe for every transaction.
# ============================================================

device_counts = (
    df["device_id"].value_counts().to_dict()
    if "device_id" in df.columns
    else {}
)

merchant_counts = (
    df["merchant_id"].value_counts().to_dict()
    if "merchant_id" in df.columns
    else {}
)


# ============================================================
# HELPER - CLEAN RING ID
# ============================================================

def clean_ring_id(value):

    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    value = str(value).strip()

    if not value:
        return None

    if value.lower() == "nan":
        return None

    return value


# ============================================================
# RISK SCORING
# ============================================================

def calculate_transaction_risk(row):

    score = 0

    amount = float(
        row.get("amount", 0) or 0
    )


    # ========================================================
    # HIGH-VALUE TRANSACTION
    # ========================================================

    if amount >= 75000:

        score += 25

    elif amount >= 50000:

        score += 18

    elif amount >= 25000:

        score += 10


    # ========================================================
    # DEVICE ACTIVITY
    # ========================================================

    device_id = row.get("device_id")

    if pd.notna(device_id):

        device_count = device_counts.get(
            device_id,
            0
        )

        if device_count >= 8:

            score += 15


    # ========================================================
    # MERCHANT ACTIVITY
    # ========================================================

    merchant_id = row.get("merchant_id")

    if pd.notna(merchant_id):

        merchant_count = merchant_counts.get(
            merchant_id,
            0
        )

        if merchant_count >= 20:

            score += 10


    # ========================================================
    # KNOWN SIMULATED FRAUD
    # ========================================================

    if int(
        row.get("is_fraud", 0)
    ) == 1:

        score = max(
            score,
            85
        )


    return min(
        score,
        99
    )


# ============================================================
# RISK LEVEL
# ============================================================

def risk_level(score):

    if score >= 80:

        return "HIGH"

    elif score >= 50:

        return "MEDIUM"

    else:

        return "LOW"


# ============================================================
# RECOMMENDED ACTION
# ============================================================

def recommended_action(score):

    if score >= 80:

        return "BLOCK / INVESTIGATE"

    elif score >= 50:

        return "REVIEW"

    else:

        return "ALLOW"


# ============================================================
# TRANSACTION EXPLANATION
# ============================================================

def explain_transaction(row, score):

    reasons = []

    amount = float(
        row.get("amount", 0) or 0
    )


    # ========================================================
    # AMOUNT
    # ========================================================

    if amount >= 75000:

        reasons.append(
            "Very high transaction amount"
        )

    elif amount >= 50000:

        reasons.append(
            "High transaction amount"
        )

    elif amount >= 25000:

        reasons.append(
            "Elevated transaction amount"
        )


    # ========================================================
    # DEVICE
    # ========================================================

    device_id = row.get("device_id")

    if pd.notna(device_id):

        device_count = device_counts.get(
            device_id,
            0
        )

        if device_count >= 8:

            reasons.append(
                f"Device linked to {device_count} transactions"
            )


    # ========================================================
    # MERCHANT
    # ========================================================

    merchant_id = row.get("merchant_id")

    if pd.notna(merchant_id):

        merchant_count = merchant_counts.get(
            merchant_id,
            0
        )

        if merchant_count >= 20:

            reasons.append(
                f"Merchant linked to {merchant_count} transactions"
            )


    # ========================================================
    # FRAUD
    # ========================================================

    if int(
        row.get("is_fraud", 0)
    ) == 1:

        reasons.append(
            "Transaction belongs to a known simulated fraud pattern"
        )


    # ========================================================
    # NO REASONS
    # ========================================================

    if not reasons:

        reasons.append(
            "No major risk indicators detected"
        )


    return reasons


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {

        "message":
            "FraudGraph AI API is running",

        "status":
            "online",

        "frontend": [

            "http://localhost:5173",

            "http://localhost:5175"

        ]

    }


# ============================================================
# DASHBOARD
# ============================================================

@app.get("/api/dashboard")
def dashboard():

    total_transactions = len(df)


    total_accounts = (

        df["account_id"].nunique()

        if "account_id" in df.columns

        else 0

    )


    suspicious_transactions = (

        int(
            df["is_fraud"].sum()
        )

        if "is_fraud" in df.columns

        else 0

    )


    # Only count real ring IDs
    if "ring_id" in df.columns:

        valid_ring_ids = df[
            df["ring_id"].notna()
            & (
                df["ring_id"]
                .astype(str)
                .str.strip()
                .ne("")
            )
            & (
                df["ring_id"]
                .astype(str)
                .str.lower()
                .ne("nan")
            )
        ]

        fraud_rings = (
            valid_ring_ids["ring_id"]
            .nunique()
        )

    else:

        fraud_rings = 0


    total_fraud_labels = (
        suspicious_transactions
    )


    total_amount = float(
        df["amount"].sum()
    )


    return {

        "total_transactions":
            total_transactions,

        "total_accounts":
            total_accounts,

        "suspicious_transactions":
            suspicious_transactions,

        "fraud_rings":
            fraud_rings,

        "total_fraud_labels":
            total_fraud_labels,

        "total_amount":
            round(
                total_amount,
                2
            )

    }


# ============================================================
# TRANSACTIONS
# ============================================================

@app.get("/api/transactions")
def transactions(limit: int = 10000):

    records = []


    # Never exceed available records
    limit = max(
        1,
        min(
            limit,
            len(df)
        )
    )


    selected = df.head(
        limit
    )


    for _, row in selected.iterrows():

        score = calculate_transaction_risk(
            row
        )


        # ====================================================
        # TIMESTAMP
        # ====================================================

        timestamp = row.get(
            "timestamp"
        )

        if pd.isna(timestamp):

            timestamp_value = None

        else:

            timestamp_value = str(
                timestamp
            )


        # ====================================================
        # RING ID
        # ====================================================

        ring_value = clean_ring_id(
            row.get("ring_id")
        )


        # ====================================================
        # RECORD
        # ====================================================

        records.append({

            "transaction_id":
                str(
                    row.get(
                        "transaction_id",
                        ""
                    )
                ),

            "account_id":
                str(
                    row.get(
                        "account_id",
                        ""
                    )
                ),

            "device_id":
                str(
                    row.get(
                        "device_id",
                        ""
                    )
                ),

            "merchant_id":
                str(
                    row.get(
                        "merchant_id",
                        ""
                    )
                ),

            "location":
                str(
                    row.get(
                        "location",
                        ""
                    )
                ),

            "amount":
                round(
                    float(
                        row.get(
                            "amount",
                            0
                        )
                    ),
                    2
                ),

            "timestamp":
                timestamp_value,

            "is_fraud":
                int(
                    row.get(
                        "is_fraud",
                        0
                    )
                ),

            "ring_id":
                ring_value,

            "pattern":
                str(
                    row.get(
                        "pattern",
                        ""
                    )
                ),

            "risk_score":
                score,

            "risk_level":
                risk_level(
                    score
                ),

            "recommended_action":
                recommended_action(
                    score
                )

        })


    return {

        "transactions":
            records,

        "total":
            len(df)

    }


# ============================================================
# HIGH-RISK TRANSACTIONS
# ============================================================

@app.get("/api/high-risk")
def high_risk(limit: int = 50):

    records = []


    for _, row in df.iterrows():

        score = calculate_transaction_risk(
            row
        )


        if score >= 80:

            timestamp = row.get(
                "timestamp"
            )


            if pd.isna(timestamp):

                timestamp_value = None

            else:

                timestamp_value = str(
                    timestamp
                )


            ring_value = clean_ring_id(
                row.get("ring_id")
            )


            records.append({

                "transaction_id":
                    str(
                        row.get(
                            "transaction_id",
                            ""
                        )
                    ),

                "account_id":
                    str(
                        row.get(
                            "account_id",
                            ""
                        )
                    ),

                "device_id":
                    str(
                        row.get(
                            "device_id",
                            ""
                        )
                    ),

                "merchant_id":
                    str(
                        row.get(
                            "merchant_id",
                            ""
                        )
                    ),

                "amount":
                    round(
                        float(
                            row.get(
                                "amount",
                                0
                            )
                        ),
                        2
                    ),

                "timestamp":
                    timestamp_value,

                "is_fraud":
                    int(
                        row.get(
                            "is_fraud",
                            0
                        )
                    ),

                "ring_id":
                    ring_value,

                "pattern":
                    str(
                        row.get(
                            "pattern",
                            ""
                        )
                    ),

                "risk_score":
                    score,

                "risk_level":
                    risk_level(
                        score
                    ),

                "recommended_action":
                    recommended_action(
                        score
                    )

            })


    # Highest risk first
    records = sorted(

        records,

        key=lambda x:
            x["risk_score"],

        reverse=True

    )


    return {

        "transactions":
            records[:limit],

        "total":
            len(records)

    }


# ============================================================
# FRAUD RINGS
# ============================================================

@app.get("/api/fraud-rings")
def fraud_rings():

    rings = []


    if "ring_id" not in df.columns:

        return {

            "rings": [],

            "total": 0

        }


    # ========================================================
    # ONLY REAL RING IDs
    # ========================================================

    fraud_df = df[

        df["ring_id"].notna()

        & (
            df["ring_id"]
            .astype(str)
            .str.strip()
            .ne("")
        )

        & (
            df["ring_id"]
            .astype(str)
            .str.lower()
            .ne("nan")
        )

    ]


    grouped = fraud_df.groupby(
        "ring_id"
    )


    for ring_id, group in grouped:

        # ====================================================
        # ACCOUNTS
        # ====================================================

        accounts = sorted(

            group["account_id"]
            .dropna()
            .astype(str)
            .unique()
            .tolist()

        )


        # ====================================================
        # DEVICES
        # ====================================================

        devices = sorted(

            group["device_id"]
            .dropna()
            .astype(str)
            .unique()
            .tolist()

        )


        # ====================================================
        # MERCHANTS
        # ====================================================

        merchants = sorted(

            group["merchant_id"]
            .dropna()
            .astype(str)
            .unique()
            .tolist()

        )


        # ====================================================
        # PATTERN
        # ====================================================

        pattern = "UNKNOWN"


        if "pattern" in group.columns:

            patterns = (

                group["pattern"]

                .dropna()

                .astype(str)

                .unique()

                .tolist()

            )


            if patterns:

                pattern = patterns[0]


        # ====================================================
        # TOTAL AMOUNT
        # ====================================================

        total_amount = float(
            group["amount"].sum()
        )


        # ====================================================
        # RING OBJECT
        # ====================================================

        rings.append({

            "ring_id":
                str(ring_id),

            "pattern":
                pattern,

            "accounts":
                accounts,

            "devices":
                devices,

            "merchants":
                merchants,

            "transaction_count":
                len(group),

            "total_amount":
                round(
                    total_amount,
                    2
                ),

            "risk_score":
                95,

            "status":
                "HIGH RISK"

        })


    # Highest risk first
    rings.sort(

        key=lambda x:
            x["risk_score"],

        reverse=True

    )


    return {

        "rings":
            rings,

        "total":
            len(rings)

    }


# ============================================================
# ACCOUNTS
# ============================================================

@app.get("/api/accounts")
def accounts():

    account_data = []


    if "account_id" not in df.columns:

        return {

            "accounts": [],

            "total": 0

        }


    grouped = df.groupby(
        "account_id"
    )


    for account_id, group in grouped:

        # ====================================================
        # CALCULATE RISK SCORES
        # ====================================================

        scores = [

            calculate_transaction_risk(
                row
            )

            for _, row in group.iterrows()

        ]


        max_score = (

            max(scores)

            if scores

            else 0

        )


        avg_score = (

            sum(scores) / len(scores)

            if scores

            else 0

        )


        # ====================================================
        # FRAUD COUNT
        # ====================================================

        fraud_count = (

            int(
                group["is_fraud"].sum()
            )

            if "is_fraud" in group.columns

            else 0

        )


        # ====================================================
        # ACCOUNT
        # ====================================================

        account_data.append({

            "account_id":
                str(account_id),

            "transaction_count":
                len(group),

            "total_amount":
                round(
                    float(
                        group["amount"].sum()
                    ),
                    2
                ),

            "fraud_transactions":
                fraud_count,

            "risk_score":
                int(max_score),

            "average_risk_score":
                round(
                    avg_score,
                    2
                ),

            "risk_level":
                risk_level(
                    max_score
                )

        })


    # Highest risk accounts first
    account_data.sort(

        key=lambda x:
            x["risk_score"],

        reverse=True

    )


    return {

        "accounts":
            account_data,

        "total":
            len(account_data)

    }


# ============================================================
# GRAPH
# ============================================================

@app.get("/api/graph")
def graph():

    nodes = {}

    edges = set()


    # ========================================================
    # ONLY FRAUD TRANSACTIONS
    # ========================================================

    suspicious = df[
        df["is_fraud"] == 1
    ].copy()


    for _, row in suspicious.iterrows():

        account = str(
            row.get(
                "account_id",
                ""
            )
        )


        device = str(
            row.get(
                "device_id",
                ""
            )
        )


        merchant = str(
            row.get(
                "merchant_id",
                ""
            )
        )


        score = calculate_transaction_risk(
            row
        )


        # ====================================================
        # ACCOUNT NODE
        # ====================================================

        if account not in nodes:

            nodes[account] = {

                "id":
                    account,

                "type":
                    "account",

                "risk_score":
                    score

            }

        else:

            nodes[account][
                "risk_score"
            ] = max(

                nodes[account][
                    "risk_score"
                ],

                score

            )


        # ====================================================
        # DEVICE NODE
        # ====================================================

        if device:

            if device not in nodes:

                nodes[device] = {

                    "id":
                        device,

                    "type":
                        "device"

                }


            edges.add(
                (
                    account,
                    device
                )
            )


        # ====================================================
        # MERCHANT NODE
        # ====================================================

        if merchant:

            if merchant not in nodes:

                nodes[merchant] = {

                    "id":
                        merchant,

                    "type":
                        "merchant"

                }


            edges.add(
                (
                    account,
                    merchant
                )
            )


    # ========================================================
    # EDGE LIST
    # ========================================================

    edge_list = [

        {

            "source":
                source,

            "target":
                target

        }

        for source, target
        in sorted(edges)

    ]


    return {

        "nodes":
            list(
                nodes.values()
            ),

        "edges":
            edge_list

    }


# ============================================================
# TRANSACTION DETAILS
# ============================================================

@app.get(
    "/api/transaction/{transaction_id}"
)
def transaction_details(
    transaction_id: str
):

    matches = df[

        df["transaction_id"]
        .astype(str)
        == str(transaction_id)

    ]


    if matches.empty:

        raise HTTPException(

            status_code=404,

            detail=
                "Transaction not found"

        )


    row = matches.iloc[0]


    score = calculate_transaction_risk(
        row
    )


    # ========================================================
    # TIMESTAMP
    # ========================================================

    timestamp = row.get(
        "timestamp"
    )


    if pd.isna(timestamp):

        timestamp_value = None

    else:

        timestamp_value = str(
            timestamp
        )


    # ========================================================
    # RING
    # ========================================================

    ring_value = clean_ring_id(
        row.get("ring_id")
    )


    return {

        "transaction_id":
            str(
                row.get(
                    "transaction_id",
                    ""
                )
            ),

        "account_id":
            str(
                row.get(
                    "account_id",
                    ""
                )
            ),

        "device_id":
            str(
                row.get(
                    "device_id",
                    ""
                )
            ),

        "merchant_id":
            str(
                row.get(
                    "merchant_id",
                    ""
                )
            ),

        "location":
            str(
                row.get(
                    "location",
                    ""
                )
            ),

        "amount":
            round(
                float(
                    row.get(
                        "amount",
                        0
                    )
                ),
                2
            ),

        "timestamp":
            timestamp_value,

        "is_fraud":
            int(
                row.get(
                    "is_fraud",
                    0
                )
            ),

        "ring_id":
            ring_value,

        "pattern":
            str(
                row.get(
                    "pattern",
                    ""
                )
            ),

        "risk_score":
            score,

        "risk_level":
            risk_level(
                score
            ),

        "explanation":
            explain_transaction(
                row,
                score
            ),

        "recommended_action":
            recommended_action(
                score
            )

    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health():

    return {

        "status":
            "online",

        "api":
            "FraudGraph AI",

        "data_loaded":
            True,

        "total_records":
            len(df)

    }
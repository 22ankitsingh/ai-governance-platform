"""
One-time migration: Add officers table and seed officers into existing database.
Run: python -m app.migrate_officers
"""
import asyncio
from sqlalchemy import select, text
from app.database import engine, async_session_factory, Base
from app.models.officer import Officer
from app.models.department import Department
from app.models.issue_type import IssueType
from app.middleware.auth import hash_password

# Officers data — same as seed.py
OFFICERS_BY_DEPT = {
    "Municipal Administration & Urban Development": [
        {"name": "Rajesh Sharma", "email": "officer@gov.in", "password": "officer123", "designation": "Junior Engineer", "mobile": "+91-9000000001"},
        {"name": "Priya Mehta", "email": "priya.mehta@gov.in", "password": "officer123", "designation": "Ward Officer", "mobile": "+91-9000000002"},
        {"name": "Arun Patel", "email": "arun.patel@gov.in", "password": "officer123", "designation": "Sanitary Inspector", "mobile": "+91-9000000003"},
    ],
    "Panchayat Raj and Rural Development": [
        {"name": "Deepa Kumari", "email": "deepa.kumari@gov.in", "password": "officer123", "designation": "Gram Panchayat Officer", "mobile": "+91-9000000004"},
        {"name": "Vikram Singh", "email": "vikram.singh@gov.in", "password": "officer123", "designation": "Block Development Officer", "mobile": "+91-9000000005"},
        {"name": "Sita Devi", "email": "sita.devi@gov.in", "password": "officer123", "designation": "Rural Engineer", "mobile": "+91-9000000006"},
    ],
    "Consumer Affairs, Food & Civil Supplies": [
        {"name": "Mohan Lal", "email": "mohan.lal@gov.in", "password": "officer123", "designation": "Food Inspector", "mobile": "+91-9000000007"},
        {"name": "Anita Gupta", "email": "anita.gupta@gov.in", "password": "officer123", "designation": "Supply Inspector", "mobile": "+91-9000000008"},
        {"name": "Suresh Kumar", "email": "suresh.kumar@gov.in", "password": "officer123", "designation": "Fair Price Shop Inspector", "mobile": "+91-9000000009"},
    ],
    "Transport, Roads and Buildings": [
        {"name": "Kiran Rao", "email": "kiran.rao@gov.in", "password": "officer123", "designation": "Highway Engineer", "mobile": "+91-9000000010"},
        {"name": "Amit Joshi", "email": "amit.joshi@gov.in", "password": "officer123", "designation": "Transport Inspector", "mobile": "+91-9000000011"},
        {"name": "Pooja Verma", "email": "pooja.verma@gov.in", "password": "officer123", "designation": "Safety Officer", "mobile": "+91-9000000012"},
    ],
    "Energy": [
        {"name": "Ramesh Yadav", "email": "ramesh.yadav@gov.in", "password": "officer123", "designation": "Electrical Engineer", "mobile": "+91-9000000013"},
        {"name": "Neha Agarwal", "email": "neha.agarwal@gov.in", "password": "officer123", "designation": "Power Distribution Officer", "mobile": "+91-9000000014"},
        {"name": "Sanjay Mishra", "email": "sanjay.mishra@gov.in", "password": "officer123", "designation": "Lineman Supervisor", "mobile": "+91-9000000015"},
    ],
    "Health, Medical & Family Welfare": [
        {"name": "Dr. Kavita Singh", "email": "kavita.singh@gov.in", "password": "officer123", "designation": "District Health Officer", "mobile": "+91-9000000016"},
        {"name": "Dr. Rahul Verma", "email": "rahul.verma@gov.in", "password": "officer123", "designation": "Medical Inspector", "mobile": "+91-9000000017"},
        {"name": "Sunita Rani", "email": "sunita.rani@gov.in", "password": "officer123", "designation": "Health Inspector", "mobile": "+91-9000000018"},
    ],
    "Environment, Forests, Science and Technology": [
        {"name": "Arjun Reddy", "email": "arjun.reddy@gov.in", "password": "officer123", "designation": "Environmental Officer", "mobile": "+91-9000000019"},
        {"name": "Maya Sharma", "email": "maya.sharma@gov.in", "password": "officer123", "designation": "Forest Ranger", "mobile": "+91-9000000020"},
        {"name": "Ravi Teja", "email": "ravi.teja@gov.in", "password": "officer123", "designation": "Pollution Control Officer", "mobile": "+91-9000000021"},
    ],
    "Agriculture and Co-operation": [
        {"name": "Lakshmi Naidu", "email": "lakshmi.naidu@gov.in", "password": "officer123", "designation": "Agriculture Officer", "mobile": "+91-9000000022"},
        {"name": "Ganesh Patil", "email": "ganesh.patil@gov.in", "password": "officer123", "designation": "Co-op Inspector", "mobile": "+91-9000000023"},
        {"name": "Meera Iyer", "email": "meera.iyer@gov.in", "password": "officer123", "designation": "Soil Scientist", "mobile": "+91-9000000024"},
    ],
}

EXPECTED_HOURS = {
    "Garbage Accumulation": 3, "Sewer Blockage": 6, "Potholes / Road Damage": 48,
    "Water Supply Issues": 8, "Streetlight Failure": 12, "Stray Animal Menace": 24,
    "Urban Flooding / Waterlogging": 4, "Illegal Encroachments": 72, "Property Tax Issues": 120,
    "Open Defecation / Lack of Toilets": 72, "Stagnant Drain Water": 12,
    "Mud Roads / Village Roads": 96, "Handpump / Water Tank Failure": 8,
    "Wage Payment Delays": 168, "Village Streetlight Failure": 24,
    "Public Infrastructure Maintenance": 72, "Panchayat Fund Misuse": 168,
    "Ration Shop Closed": 24, "Underweight Ration Supply": 48, "Ration Card Delay": 168,
    "MRP Overcharging": 24, "Adulterated / Expired Products": 12,
    "Illegal Service Charges": 48, "LPG Delivery Bribes": 48,
    "Market Fraud (Weights/Scales)": 24,
    "Highway Safety Issues": 12, "Bus Service Issues": 24, "Driver Misconduct": 48,
    "Auto/Cab Refusal / Meter Fraud": 24, "RTO Corruption": 72,
    "Vehicle Pollution": 48, "Unsafe Government Buildings": 24,
    "Power Outages": 5, "Voltage Fluctuation": 8, "Electrical Hazards": 2,
    "Fallen Power Lines": 2, "Billing Issues": 72, "New Connection Delays": 168,
    "Agricultural Power Issues": 24,
    "Doctor Absenteeism": 8, "Medicine Shortage": 12, "Hospital Hygiene Issues": 24,
    "Hospital Corruption": 72, "Ambulance Delays": 2, "Emergency Denial": 2,
    "Illegal Clinics": 48,
    "Water Pollution": 24, "Air Pollution": 48, "Noise Pollution": 24,
    "Illegal Tree Cutting": 12, "Wildlife Intrusion": 8,
    "Biomedical Waste Dumping": 6, "Illegal Mining": 72,
    "Fake Seeds": 48, "Fertilizer Black Marketing": 48, "Pest Attacks": 24,
    "Soil Testing Issues": 72, "Storage Problems": 48, "Cooperative Fraud": 168,
}


async def migrate():
    print("🔄 Starting officer migration...")

    # Create new tables (officers, + new columns on issues/issue_types)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Schema updated (officers table + new columns)")

    async with async_session_factory() as db:
        # Check if officers already exist
        result = await db.execute(select(Officer).limit(1))
        if result.scalar_one_or_none():
            print("⚠️  Officers already exist, skipping officer seeding")
        else:
            # Get department map
            result = await db.execute(select(Department))
            depts = {d.name: d for d in result.scalars().all()}

            count = 0
            for dept_name, officers in OFFICERS_BY_DEPT.items():
                dept = depts.get(dept_name)
                if not dept:
                    print(f"  ⚠️  Department '{dept_name}' not found, skipping")
                    continue
                for o_data in officers:
                    officer = Officer(
                        name=o_data["name"],
                        email=o_data["email"],
                        hashed_password=hash_password(o_data["password"]),
                        mobile_number=o_data["mobile"],
                        department_id=dept.id,
                        designation=o_data["designation"],
                    )
                    db.add(officer)
                    count += 1

            await db.flush()
            print(f"✅ Seeded {count} officers")

        # Update expected_resolution_hours on issue types
        result = await db.execute(select(IssueType))
        issue_types = result.scalars().all()
        updated = 0
        for it in issue_types:
            if it.name in EXPECTED_HOURS and it.expected_resolution_hours is None:
                it.expected_resolution_hours = EXPECTED_HOURS[it.name]
                updated += 1

        if updated:
            print(f"✅ Updated expected_resolution_hours on {updated} issue types")
        else:
            print("ℹ️  expected_resolution_hours already set (or no matching types)")

        await db.commit()

    print("")
    print("✅ Migration complete!")
    print("   Demo officer: officer@gov.in / officer123")


if __name__ == "__main__":
    asyncio.run(migrate())

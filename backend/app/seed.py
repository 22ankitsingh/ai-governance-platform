"""
Database seeder — creates real government departments, issue types, admin account,
sample citizen, and sample issues using the structured issue_type system.
"""
import uuid
import random
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.department import Department
from app.models.issue_type import IssueType
from app.models.officer_label import OfficerLabel
from app.models.issue import Issue
from app.models.issue_media import IssueMedia
from app.models.ai_prediction import AIPrediction
from app.models.status_history import StatusHistory
from app.models.notification import Notification
from app.middleware.auth import hash_password


# ─────────────────────────────────────────────────────────────────────────────
# DEPARTMENTS — 8 real government departments
# ─────────────────────────────────────────────────────────────────────────────
DEPARTMENTS = [
    {
        "name": "Municipal Administration & Urban Development",
        "code": "MAUD",
        "description": "Urban civic services, roads, water, street lights, and encroachments",
    },
    {
        "name": "Panchayat Raj and Rural Development",
        "code": "PRRD",
        "description": "Rural infrastructure, drainage, village roads, MGNREGA wages, and panchayat services",
    },
    {
        "name": "Consumer Affairs, Food & Civil Supplies",
        "code": "CAFCS",
        "description": "Ration shops, PDS supplies, LPG delivery, MRP enforcement, and market fraud",
    },
    {
        "name": "Transport, Roads and Buildings",
        "code": "TRB",
        "description": "Highway safety, bus services, RTO corruption, vehicle pollution, and government buildings",
    },
    {
        "name": "Energy",
        "code": "ENERGY",
        "description": "Power outages, voltage fluctuation, electrical hazards, billing issues, and new connections",
    },
    {
        "name": "Health, Medical & Family Welfare",
        "code": "HMFW",
        "description": "Doctor absenteeism, medicine shortages, hospital hygiene, ambulance delays, and illegal clinics",
    },
    {
        "name": "Environment, Forests, Science and Technology",
        "code": "EFST",
        "description": "Water/air/noise pollution, illegal tree cutting, wildlife intrusion, biomedical waste",
    },
    {
        "name": "Agriculture and Co-operation",
        "code": "AGRI",
        "description": "Fake seeds, fertilizer black marketing, pest attacks, soil testing, storage problems",
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# ISSUE TYPES — mapped to departments
# ─────────────────────────────────────────────────────────────────────────────
ISSUE_TYPES_BY_DEPT = {
    "Municipal Administration & Urban Development": [
        "Garbage Accumulation",
        "Sewer Blockage",
        "Potholes / Road Damage",
        "Water Supply Issues",
        "Streetlight Failure",
        "Stray Animal Menace",
        "Urban Flooding / Waterlogging",
        "Illegal Encroachments",
        "Property Tax Issues",
    ],
    "Panchayat Raj and Rural Development": [
        "Open Defecation / Lack of Toilets",
        "Stagnant Drain Water",
        "Mud Roads / Village Roads",
        "Handpump / Water Tank Failure",
        "Wage Payment Delays",
        "Village Streetlight Failure",
        "Public Infrastructure Maintenance",
        "Panchayat Fund Misuse",
    ],
    "Consumer Affairs, Food & Civil Supplies": [
        "Ration Shop Closed",
        "Underweight Ration Supply",
        "Ration Card Delay",
        "MRP Overcharging",
        "Adulterated / Expired Products",
        "Illegal Service Charges",
        "LPG Delivery Bribes",
        "Market Fraud (Weights/Scales)",
    ],
    "Transport, Roads and Buildings": [
        "Highway Safety Issues",
        "Bus Service Issues",
        "Driver Misconduct",
        "Auto/Cab Refusal / Meter Fraud",
        "RTO Corruption",
        "Vehicle Pollution",
        "Unsafe Government Buildings",
    ],
    "Energy": [
        "Power Outages",
        "Voltage Fluctuation",
        "Electrical Hazards",
        "Fallen Power Lines",
        "Billing Issues",
        "New Connection Delays",
        "Agricultural Power Issues",
    ],
    "Health, Medical & Family Welfare": [
        "Doctor Absenteeism",
        "Medicine Shortage",
        "Hospital Hygiene Issues",
        "Hospital Corruption",
        "Ambulance Delays",
        "Emergency Denial",
        "Illegal Clinics",
    ],
    "Environment, Forests, Science and Technology": [
        "Water Pollution",
        "Air Pollution",
        "Noise Pollution",
        "Illegal Tree Cutting",
        "Wildlife Intrusion",
        "Biomedical Waste Dumping",
        "Illegal Mining",
    ],
    "Agriculture and Co-operation": [
        "Fake Seeds",
        "Fertilizer Black Marketing",
        "Pest Attacks",
        "Soil Testing Issues",
        "Storage Problems",
        "Cooperative Fraud",
    ],
}

OFFICER_LABELS = [
    "Junior Engineer", "Senior Engineer", "Ward Officer", "Sanitary Inspector",
    "Health Inspector", "Environmental Officer", "Safety Officer", "Zonal Officer",
    "Assistant Commissioner", "Executive Engineer",
]

# ─────────────────────────────────────────────────────────────────────────────
# SAMPLE ISSUES — each references a specific issue_type name
# ─────────────────────────────────────────────────────────────────────────────
SAMPLE_ISSUES = [
    {
        "title": "Large pothole on MG Road near City Mall",
        "description": "There is a dangerous pothole approximately 2 feet wide and 8 inches deep on MG Road, right near the City Mall entrance. Multiple vehicles have been damaged. This needs urgent attention as it is on a high-traffic road.",
        "issue_type_name": "Potholes / Road Damage",
        "severity": "high", "priority": 2, "status": "in_progress",
        "latitude": 28.6139, "longitude": 77.2090, "context": "urban",
    },
    {
        "title": "Sewer blocked near Sector 15 Market",
        "description": "The main sewer line near Sector 15 Market has been completely blocked for 3 days. Sewage water is overflowing onto the road. The stench is unbearable and poses a serious health risk to residents.",
        "issue_type_name": "Sewer Blockage",
        "severity": "critical", "priority": 1, "status": "in_progress",
        "latitude": 28.5800, "longitude": 77.3100, "context": "urban",
    },
    {
        "title": "Garbage not collected for 5 days in Green Colony",
        "description": "The garbage collection vehicle has not visited Green Colony for the past 5 days. Garbage is piling up at the community dumping point. Stray dogs are tearing open bags.",
        "issue_type_name": "Garbage Accumulation",
        "severity": "high", "priority": 2, "status": "not_assigned",
        "latitude": 28.6200, "longitude": 77.2300, "context": "urban",
    },
    {
        "title": "Ration shop closed for 2 weeks",
        "description": "The government ration shop in Ward 4 has been closed for the past 2 weeks. BPL families are unable to collect their monthly ration. The shopkeeper is not responding to calls.",
        "issue_type_name": "Ration Shop Closed",
        "severity": "high", "priority": 2, "status": "not_assigned",
        "latitude": 28.6350, "longitude": 77.2250, "context": "urban",
    },
    {
        "title": "Dense smoke from factory in industrial area",
        "description": "A factory in the industrial zone has been emitting thick black smoke throughout the day. Air quality in surrounding residential areas has deteriorated significantly. Residents are experiencing breathing difficulties.",
        "issue_type_name": "Air Pollution",
        "severity": "high", "priority": 2, "status": "in_progress",
        "latitude": 28.6500, "longitude": 77.1800, "context": "urban",
    },
    {
        "title": "Doctor absent at Primary Health Center",
        "description": "The only government doctor posted at the Sector 9 PHC has been absent for 3 consecutive days. Patients, especially pregnant women and elderly, are being turned away without treatment.",
        "issue_type_name": "Doctor Absenteeism",
        "severity": "critical", "priority": 1, "status": "in_progress",
        "latitude": 28.5900, "longitude": 77.2500, "context": "urban",
    },
    {
        "title": "Street lights not working on Ring Road",
        "description": "All street lights on Ring Road between Sector 10 and Sector 12 have been off for the past week. The stretch is completely dark at night making it dangerous for commuters and pedestrians.",
        "issue_type_name": "Streetlight Failure",
        "severity": "medium", "priority": 3, "status": "resolved",
        "latitude": 28.6050, "longitude": 77.2700, "context": "urban",
        "resolution_notes": "All 24 street lights on the stretch have been repaired and tested. LED bulbs replaced where needed.",
    },
    {
        "title": "Power outage in residential colony for 18 hours",
        "description": "The entire residential colony in Block B has been without electricity for the past 18 hours. DISCOM helpline is not responding. Residents with medical equipment are in critical condition.",
        "issue_type_name": "Power Outages",
        "severity": "critical", "priority": 1, "status": "in_progress",
        "latitude": 28.6450, "longitude": 77.2100, "context": "urban",
    },
    {
        "title": "Village road damaged after monsoon — farmers unable to transport produce",
        "description": "The road connecting the village to the agricultural fields has been badly damaged by recent heavy rains. Farmers cannot transport their produce to the market. The road has multiple craters.",
        "issue_type_name": "Mud Roads / Village Roads",
        "severity": "high", "priority": 2, "status": "not_assigned",
        "latitude": 28.5500, "longitude": 77.3500, "context": "rural",
    },
    {
        "title": "LPG delivery agent demanding extra cash",
        "description": "The LPG delivery agent is demanding Rs 200 extra per cylinder as bribe for home delivery. He refuses to deliver at the subsidized price. This is the third consecutive month he has done this.",
        "issue_type_name": "LPG Delivery Bribes",
        "severity": "medium", "priority": 3, "status": "not_assigned",
        "latitude": 28.6300, "longitude": 77.2200, "context": "urban",
    },
]


# ─────────────────────────────────────────────────────────────────────────────
async def seed_database(db: AsyncSession):
    """Seed the database with initial data if empty."""
    # Check if already seeded
    result = await db.execute(select(Department).limit(1))
    if result.scalar_one_or_none():
        return  # Already seeded

    print("🌱 Seeding database...")

    # ── Create departments ────────────────────────────────────────────────────
    dept_map: dict[str, Department] = {}
    for dept_data in DEPARTMENTS:
        dept = Department(**dept_data)
        db.add(dept)
        await db.flush()
        dept_map[dept.name] = dept

    # ── Create issue types ────────────────────────────────────────────────────
    issue_type_map: dict[str, IssueType] = {}  # name → IssueType
    for dept_name, type_names in ISSUE_TYPES_BY_DEPT.items():
        dept = dept_map.get(dept_name)
        for type_name in type_names:
            it = IssueType(
                name=type_name,
                department_id=dept.id if dept else None,
            )
            db.add(it)
            await db.flush()
            issue_type_map[type_name] = it

    # ── Create officer labels ─────────────────────────────────────────────────
    for i, label_name in enumerate(OFFICER_LABELS):
        dept = list(dept_map.values())[i % len(dept_map)]
        ol = OfficerLabel(name=label_name, department_id=dept.id)
        db.add(ol)

    # ── Create admin user ─────────────────────────────────────────────────────
    admin = User(
        email="admin@gov.in",
        hashed_password=hash_password("admin123"),
        full_name="System Administrator",
        phone="+91-9999999999",
        role="admin",
    )
    db.add(admin)

    # ── Create sample citizen ─────────────────────────────────────────────────
    citizen = User(
        email="citizen@example.com",
        hashed_password=hash_password("citizen123"),
        full_name="Rajesh Kumar",
        phone="+91-9876543210",
        role="citizen",
    )
    db.add(citizen)
    await db.flush()

    # ── Create sample issues ──────────────────────────────────────────────────
    for issue_data in SAMPLE_ISSUES:
        type_name = issue_data["issue_type_name"]
        issue_type = issue_type_map.get(type_name)
        dept_id = issue_type.department_id if issue_type else None
        dept = next((d for d in dept_map.values() if d.id == dept_id), None)
        dept_name = dept.name if dept else "Unknown"

        days_ago = random.randint(1, 30)
        created = datetime.utcnow() - timedelta(days=days_ago)

        issue = Issue(
            title=issue_data["title"],
            description=issue_data["description"],
            issue_type_id=issue_type.id if issue_type else None,
            category=type_name,  # legacy field — mirrors issue_type name
            severity=issue_data["severity"],
            priority=issue_data["priority"],
            status=issue_data["status"],
            latitude=issue_data.get("latitude"),
            longitude=issue_data.get("longitude"),
            context=issue_data.get("context"),
            department_id=dept_id,
            reporter_id=citizen.id,
            resolution_notes=issue_data.get("resolution_notes"),
            ai_confidence=round(random.uniform(0.6, 0.95), 2),
            ai_reasoning=(
                f"AI analysis identified this as a '{type_name}' issue under "
                f"'{dept_name}' department based on keywords and context."
            ),
            created_at=created,
            updated_at=created,
            resolved_at=(
                created + timedelta(days=random.randint(1, 5))
                if issue_data["status"] == "resolved" else None
            ),
        )
        db.add(issue)
        await db.flush()

        # AI prediction record
        prediction = AIPrediction(
            issue_id=issue.id,
            predicted_category=type_name,
            predicted_department=dept_name,
            predicted_severity=issue_data["severity"],
            predicted_priority=issue_data["priority"],
            confidence=issue.ai_confidence,
            reasoning=issue.ai_reasoning,
            model_version="demo-seed-v1",
            created_at=created,
        )
        db.add(prediction)

        # Status history
        db.add(StatusHistory(
            issue_id=issue.id, from_status=None, to_status="not_assigned",
            changed_by=citizen.id, notes="Issue created", created_at=created,
        ))
        if issue_data["status"] != "not_assigned":
            db.add(StatusHistory(
                issue_id=issue.id, from_status="not_assigned",
                to_status=issue_data["status"],
                changed_by=admin.id, notes="Status updated by admin",
                created_at=created + timedelta(hours=random.randint(1, 48)),
            ))

    # ── Welcome notification ──────────────────────────────────────────────────
    db.add(Notification(
        user_id=citizen.id,
        title="Welcome to PrajaGov",
        message="Thank you for registering. You can now report civic issues using our structured issue type system.",
        notification_type="info",
    ))

    await db.commit()
    print("✅ Database seeded successfully!")
    print("   Admin:   admin@gov.in  / admin123")
    print("   Citizen: citizen@example.com / citizen123")
    print(f"   Departments: {len(DEPARTMENTS)}")
    print(f"   Issue Types: {sum(len(v) for v in ISSUE_TYPES_BY_DEPT.values())}")

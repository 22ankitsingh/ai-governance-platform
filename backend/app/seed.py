"""
Database seeder — creates demo departments, issue types, officer labels,
admin account, sample citizen, and sample issues.
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


DEPARTMENTS = [
    {"name": "Public Works Department", "code": "PWD", "description": "Handles roads, bridges, and public infrastructure"},
    {"name": "Water Supply Department", "code": "WSD", "description": "Manages water supply, pipelines, and drainage systems"},
    {"name": "Sanitation Department", "code": "SAN", "description": "Garbage collection, waste management, and public hygiene"},
    {"name": "Public Safety Department", "code": "PSD", "description": "Public safety hazards, structural risks, and emergency response"},
    {"name": "Environment Department", "code": "ENV", "description": "Environmental protection, tree management, pollution control"},
    {"name": "Health Department", "code": "HLT", "description": "Public health, disease control, and medical facility management"},
]

ISSUE_TYPES = {
    "Road & Infrastructure": ["Pothole", "Road Damage", "Bridge Issue", "Traffic Signal Malfunction", "Street Light Outage", "Footpath Damage", "Road Flooding"],
    "Water Issues": ["Water Leak", "Supply Disruption", "Contamination", "Drainage Blockage", "Flooding", "Low Pressure"],
    "Sanitation": ["Garbage Not Collected", "Illegal Dumping", "Overflowing Bin", "Public Toilet Issue", "Street Cleaning", "Waste Burning"],
    "Public Safety": ["Structural Hazard", "Fire Risk", "Vandalism", "Unsafe Area", "Missing Railing", "Collapsed Wall"],
    "Environment": ["Air Pollution", "Noise Pollution", "Tree Falling Risk", "Park Maintenance", "Illegal Construction", "Deforestation"],
    "Health": ["Disease Outbreak Risk", "Stagnant Water", "Medical Facility Issue", "Pest Infestation", "Health Hazard", "Mosquito Breeding"],
}

OFFICER_LABELS = [
    "Junior Engineer", "Senior Engineer", "Ward Officer", "Sanitary Inspector",
    "Health Inspector", "Environmental Officer", "Safety Officer", "Zonal Officer",
    "Assistant Commissioner", "Executive Engineer",
]

SAMPLE_ISSUES = [
    {
        "title": "Large pothole on MG Road near City Mall",
        "description": "There is a dangerous pothole approximately 2 feet wide and 8 inches deep on MG Road, right near the City Mall entrance. Multiple vehicles have been damaged. This needs urgent attention as it's on a high-traffic road.",
        "category": "Road & Infrastructure", "subcategory": "Pothole",
        "severity": "high", "priority": 2, "status": "in_progress",
        "latitude": 28.6139, "longitude": 77.2090, "context": "urban",
    },
    {
        "title": "Water pipeline burst in Sector 15",
        "description": "A major water pipeline has burst near Block C, Sector 15. Water has been flowing continuously for the past 6 hours, flooding the entire street. Residents are unable to get clean water.",
        "category": "Water Issues", "subcategory": "Water Leak",
        "severity": "critical", "priority": 1, "status": "in_progress",
        "latitude": 28.5800, "longitude": 77.3100, "context": "urban",
    },
    {
        "title": "Garbage not collected for 5 days in Green Colony",
        "description": "The garbage collection vehicle has not visited Green Colony for the past 5 days. Garbage is piling up at the community dumping point and the smell is unbearable. Stray dogs are tearing open bags.",
        "category": "Sanitation", "subcategory": "Garbage Not Collected",
        "severity": "high", "priority": 2, "status": "not_assigned",
        "latitude": 28.6200, "longitude": 77.2300, "context": "urban",
    },
    {
        "title": "Broken boundary wall near primary school",
        "description": "The boundary wall of the community park near Sunrise Primary School has partially collapsed. Sharp concrete debris is exposed and children walking to school are at risk.",
        "category": "Public Safety", "subcategory": "Structural Hazard",
        "severity": "critical", "priority": 1, "status": "not_assigned",
        "latitude": 28.6350, "longitude": 77.2250, "context": "urban",
    },
    {
        "title": "Dense smoke from factory in industrial area",
        "description": "A factory in the industrial zone has been emitting thick black smoke throughout the day. The air quality in surrounding residential areas has deteriorated significantly. Residents are experiencing breathing difficulties.",
        "category": "Environment", "subcategory": "Air Pollution",
        "severity": "high", "priority": 2, "status": "in_progress",
        "latitude": 28.6500, "longitude": 77.1800, "context": "urban",
    },
    {
        "title": "Stagnant water breeding mosquitoes near lake",
        "description": "Stagnant water has accumulated in several areas around the community lake. Multiple residents have reported mosquito infestation and there are 3 confirmed dengue cases in the neighborhood.",
        "category": "Health", "subcategory": "Stagnant Water",
        "severity": "critical", "priority": 1, "status": "in_progress",
        "latitude": 28.5900, "longitude": 77.2500, "context": "urban",
    },
    {
        "title": "Street lights not working on Ring Road",
        "description": "All street lights on Ring Road between Sector 10 and Sector 12 have been off for the past week. The stretch is completely dark at night making it dangerous for commuters and pedestrians.",
        "category": "Road & Infrastructure", "subcategory": "Street Light Outage",
        "severity": "medium", "priority": 3, "status": "resolved",
        "latitude": 28.6050, "longitude": 77.2700, "context": "urban",
        "resolution_notes": "All 24 street lights on the stretch have been repaired and tested. LED bulbs replaced where needed.",
    },
    {
        "title": "Illegal construction blocking drainage channel",
        "description": "An unauthorized structure has been built over the main drainage channel in Ward 7. This is causing waterlogging in the entire area during rains. The construction appears to be a commercial shop.",
        "category": "Environment", "subcategory": "Illegal Construction",
        "severity": "high", "priority": 2, "status": "in_progress",
        "latitude": 28.6450, "longitude": 77.2100, "context": "urban",
    },
    {
        "title": "Damaged road in village connecting farmland",
        "description": "The road connecting the village to the agricultural fields has been badly damaged by recent heavy rains. Farmers cannot transport their produce to the market. The road has multiple craters.",
        "category": "Road & Infrastructure", "subcategory": "Road Damage",
        "severity": "high", "priority": 2, "status": "not_assigned",
        "latitude": 28.5500, "longitude": 77.3500, "context": "rural",
    },
    {
        "title": "Public toilet in non-functional state at bus stand",
        "description": "The public toilet facility at the central bus stand has been non-functional for over a month. Water supply is cut off, doors are broken, and there is no cleaning staff. This facility serves hundreds of commuters daily.",
        "category": "Sanitation", "subcategory": "Public Toilet Issue",
        "severity": "medium", "priority": 3, "status": "not_assigned",
        "latitude": 28.6300, "longitude": 77.2200, "context": "urban",
    },
]


async def seed_database(db: AsyncSession):
    """Seed the database with initial data if empty."""
    # Check if already seeded
    result = await db.execute(select(Department).limit(1))
    if result.scalar_one_or_none():
        return  # Already seeded

    print("🌱 Seeding database...")

    # Create departments
    dept_map = {}
    for dept_data in DEPARTMENTS:
        dept = Department(**dept_data)
        db.add(dept)
        await db.flush()
        dept_map[dept.name] = dept

    # Create issue types
    category_dept_map = {
        "Road & Infrastructure": "Public Works Department",
        "Water Issues": "Water Supply Department",
        "Sanitation": "Sanitation Department",
        "Public Safety": "Public Safety Department",
        "Environment": "Environment Department",
        "Health": "Health Department",
    }
    for category, subcategories in ISSUE_TYPES.items():
        dept_name = category_dept_map.get(category)
        dept_id = dept_map[dept_name].id if dept_name in dept_map else None
        for sub in subcategories:
            it = IssueType(category=category, subcategory=sub, department_id=dept_id)
            db.add(it)

    # Create officer labels
    for i, label_name in enumerate(OFFICER_LABELS):
        dept = list(dept_map.values())[i % len(dept_map)]
        ol = OfficerLabel(name=label_name, department_id=dept.id)
        db.add(ol)

    # Create admin user
    admin = User(
        email="admin@gov.in",
        hashed_password=hash_password("admin123"),
        full_name="System Administrator",
        phone="+91-9999999999",
        role="admin",
    )
    db.add(admin)

    # Create sample citizen
    citizen = User(
        email="citizen@example.com",
        hashed_password=hash_password("citizen123"),
        full_name="Rajesh Kumar",
        phone="+91-9876543210",
        role="citizen",
    )
    db.add(citizen)
    await db.flush()

    # Create sample issues
    for i, issue_data in enumerate(SAMPLE_ISSUES):
        dept_name = category_dept_map.get(issue_data["category"])
        dept_id = dept_map[dept_name].id if dept_name in dept_map else None

        days_ago = random.randint(1, 30)
        created = datetime.utcnow() - timedelta(days=days_ago)

        issue = Issue(
            title=issue_data["title"],
            description=issue_data["description"],
            category=issue_data["category"],
            subcategory=issue_data["subcategory"],
            severity=issue_data["severity"],
            priority=issue_data["priority"],
            status=issue_data["status"],
            latitude=issue_data["latitude"],
            longitude=issue_data["longitude"],
            context=issue_data.get("context"),
            department_id=dept_id,
            reporter_id=citizen.id,
            resolution_notes=issue_data.get("resolution_notes"),
            ai_confidence=round(random.uniform(0.6, 0.95), 2),
            ai_reasoning=f"AI analysis identified this as a {issue_data['category']} issue with {issue_data['subcategory']} characteristics.",
            created_at=created,
            updated_at=created,
            resolved_at=created + timedelta(days=random.randint(1, 5)) if issue_data["status"] == "resolved" else None,
        )
        db.add(issue)
        await db.flush()

        # Add AI prediction
        prediction = AIPrediction(
            issue_id=issue.id,
            predicted_category=issue_data["category"],
            predicted_subcategory=issue_data["subcategory"],
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
                issue_id=issue.id, from_status="not_assigned", to_status=issue_data["status"],
                changed_by=admin.id, notes="Status updated by admin",
                created_at=created + timedelta(hours=random.randint(1, 48)),
            ))

    # Create sample notification for citizen
    db.add(Notification(
        user_id=citizen.id,
        title="Welcome to Governance Platform",
        message="Thank you for registering. You can now report civic issues in your area.",
        notification_type="info",
    ))

    await db.commit()
    print("✅ Database seeded successfully!")
    print("   Admin: admin@gov.in / admin123")
    print("   Citizen: citizen@example.com / citizen123")

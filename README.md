# PrajaGov 🏛️

**PrajaGov** is an AI-powered civic grievance management platform that enables citizens to report public issues, track their resolution, and interact with government authorities through a transparent and structured workflow.

The platform leverages Artificial Intelligence to analyze complaints, determine their severity and priority, assign them to the appropriate department, and streamline the issue resolution process. By connecting citizens, officers, and administrators on a single platform, PrajaGov promotes accountability, transparency, and efficient governance.

---

## 🌐 Live Demo

🔗 https://prajagov-hazel.vercel.app/

Explore the platform and experience the complete grievance management workflow.

---

## 📚 Features

### 👤 Citizen Portal

* Register and securely log in
* Submit civic complaints with descriptions, images, and location details
* Track complaint status in real time
* View issue timelines and assignment history
* Verify completed resolutions
* Reopen unresolved complaints
* Provide ratings and feedback

### 👮 Officer Portal

* Dedicated officer dashboard
* View assigned complaints
* Update issue status and progress
* Upload proof of resolution
* Manage availability and workload

### 🛠️ Administrator Portal

* Monitor complaints across all departments
* Manage officers and assignments
* Override AI-generated classifications when necessary
* View analytics and performance metrics
* Access complete audit logs

### 🤖 AI-Powered Complaint Analysis

* Automatic complaint classification using Gemini AI
* Severity prediction
* Priority prediction
* Department mapping
* Detection of irrelevant or invalid complaints
* Fallback classification system for improved reliability

### 📧 Notification System

* Email notifications for status changes
* Resolution verification requests
* Assignment updates and workflow alerts

---

## 🛠️ Tech Stack

* **Frontend:** React.js, Vite, JavaScript
* **Backend:** FastAPI, Python
* **Database:** PostgreSQL (NeonDB)
* **ORM:** SQLAlchemy
* **AI Integration:** Google Gemini API
* **Image Storage:** Cloudinary
* **Authentication:** JWT Authentication
* **Notifications:** SMTP Email Service
* **Deployment:** Vercel & Render

---

## 🚀 How It Works

1. A citizen submits a complaint with details and supporting images.
2. The AI module analyzes the complaint and predicts:

   * Issue Type
   * Severity
   * Priority
   * Responsible Department
3. The issue is assigned to an available officer.
4. The officer resolves the issue and uploads proof.
5. The citizen receives a notification to verify the resolution.
6. The issue is either:

   * Closed (approved by citizen)
   * Reopened (if the issue persists)

---

## 🚀 How to Run Locally

### Clone the Repository

```bash
git clone https://github.com/22ankitsingh/ai-governance-platform.git
cd ai-governance-platform
```

### Backend Setup

```bash
cd backend

pip install -r requirements.txt

uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

### Environment Variables

Create a `.env` file and configure:

```env
DATABASE_URL=your_database_url
SECRET_KEY=your_secret_key
GEMINI_API_KEY=your_gemini_api_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
SMTP_EMAIL=your_email
SMTP_PASSWORD=your_password
```
---

## 📊 Key Highlights

* AI-powered complaint triaging and classification
* Automated officer assignment workflow
* Real-time issue tracking and status management
* Citizen-driven verification process
* Analytics dashboard for performance monitoring
* Role-based access control for Citizens, Officers, and Administrators

---

## 🌱 Future Scope

* Mobile application support
* Multilingual complaint processing
* GIS-based issue visualization
* Smart city integration
* AI-powered chatbot assistance
* Predictive analytics for civic planning

---

This project was developed as part of the Bachelor of Technology (B.Tech) Major Project at JNTUH University College of Engineering, Science & Technology Hyderabad.

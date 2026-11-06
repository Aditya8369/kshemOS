
"""
Official Indian emergency and cybercrime reporting contacts.

Only contacts verified against official government sources
should be included in this public directory.
"""

OFFICIAL_CONTACTS = [
    {
        "id": "india-emergency-112",
        "name": "Emergency Response Support System",
        "category": "immediate_emergency",
        "contact_type": "phone",
        "value": "112",
        "description": (
            "Pan-India emergency number for police, fire, "
            "health and other emergency assistance."
        ),
        "authority": "Ministry of Home Affairs, Government of India",
        "source_url": "https://112.gov.in/",
        "verification_status": "verified",
        "last_verified": "2026-11-07",
    },
    {
        "id": "india-cyber-financial-fraud-1930",
        "name": "National Cyber Crime Helpline",
        "category": "cyber_financial_fraud",
        "contact_type": "phone",
        "value": "1930",
        "description": (
            "Helpline for immediate reporting of financial "
            "cyber fraud."
        ),
        "authority": "Indian Cyber Crime Coordination Centre, MHA",
        "source_url": (
            "https://www.pib.gov.in/PressReleasePage.aspx"
            "?PRID=2290377&lang=1&reg=3"
        ),
        "verification_status": "verified",
        "last_verified": "2026-11-07",
    },
    {
        "id": "india-national-cybercrime-portal",
        "name": "National Cyber Crime Reporting Portal",
        "category": "cybercrime_reporting",
        "contact_type": "url",
        "value": "https://cybercrime.gov.in/",
        "description": (
            "Official Government of India portal for reporting "
            "cybercrime incidents."
        ),
        "authority": "Indian Cyber Crime Coordination Centre, MHA",
        "source_url": "https://cybercrime.gov.in/",
        "verification_status": "verified",
        "last_verified": "2026-11-07",
    },
]

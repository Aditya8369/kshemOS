"""
Verified India-specific official emergency and cybercrime contacts.

Only contacts with traceable official sources and valid verification
metadata are eligible for public display.
"""

OFFICIAL_CONTACTS = [
    {
        "id": "india-emergency-112",
        "jurisdiction": "India",
        "incident_category": "immediate_emergency",
        "category": "immediate_emergency",
        "display_name": "Emergency Response Support System",
        "name": "Emergency Response Support System",
        "contact_type": "phone",
        "contact_value": "112",
        "value": "112",
        "description": (
            "Pan-India emergency number for police, fire, "
            "health and other immediate emergency assistance."
        ),
        "authority": "Ministry of Home Affairs, Government of India",
        "official_source_url": "https://112.gov.in/",
        "source_url": "https://112.gov.in/",
        "verification_status": "verified",
        "last_verified_at": "2026-11-07",
        "last_verified": "2026-11-07",
    },
    {
        "id": "india-cyber-financial-fraud-1930",
        "jurisdiction": "India",
        "incident_category": "cyber_financial_fraud",
        "category": "cyber_financial_fraud",
        "display_name": "National Cyber Crime Helpline",
        "name": "National Cyber Crime Helpline",
        "contact_type": "phone",
        "contact_value": "1930",
        "value": "1930",
        "description": (
            "Helpline for reporting financial cyber fraud. "
            "This is not an emergency dispatch number."
        ),
        "authority": "Indian Cyber Crime Coordination Centre, MHA",
        "official_source_url": "https://cybercrime.gov.in/",
        "source_url": "https://cybercrime.gov.in/",
        "verification_status": "verified",
        "last_verified_at": "2026-11-07",
        "last_verified": "2026-11-07",
    },
    {
        "id": "india-national-cybercrime-portal",
        "jurisdiction": "India",
        "incident_category": "cybercrime_reporting",
        "category": "cybercrime_reporting",
        "display_name": "National Cyber Crime Reporting Portal",
        "name": "National Cyber Crime Reporting Portal",
        "contact_type": "url",
        "contact_value": "https://cybercrime.gov.in/",
        "value": "https://cybercrime.gov.in/",
        "description": (
            "Official Government of India portal for reporting "
            "cybercrime incidents."
        ),
        "authority": "Indian Cyber Crime Coordination Centre, MHA",
        "official_source_url": "https://cybercrime.gov.in/",
        "source_url": "https://cybercrime.gov.in/",
        "verification_status": "verified",
        "last_verified_at": "2026-11-07",
        "last_verified": "2026-11-07",
    },
]
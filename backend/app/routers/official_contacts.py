
from fastapi import APIRouter, Query

from app.data.official_contacts import OFFICIAL_CONTACTS


router = APIRouter(
    prefix="/api/official-contacts",
    tags=["Official Contacts"],
)


@router.get("")
def get_official_contacts(
    category: str | None = Query(default=None),
):
    """
    Return verified official Indian emergency and
    cybercrime reporting contacts.
    """

    contacts = [
        contact
        for contact in OFFICIAL_CONTACTS
        if contact["verification_status"] == "verified"
    ]

    if category:
        contacts = [
            contact
            for contact in contacts
            if contact["category"] == category
        ]

    return {
        "count": len(contacts),
        "contacts": contacts,
    }

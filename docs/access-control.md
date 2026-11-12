# Access Control and Data Redaction



## Overview



KshemOS uses centralized role-based and resource-level access control to protect incident and citizen information. Authorization is enforced by the backend; frontend visibility is not considered a security boundary.



## Authentication



Protected endpoints use bearer-token authentication.



Configure the `KSHEMOS_ACCESS_TOKENS` environment variable as a JSON object mapping long, secret tokens to identity claims.



Example structure:



```json

{

  "<secret-token-of-at-least-32-characters>": {

    "subject": "OFFICER-001",

    "role": "officer",

    "jurisdictions": \["West Zone"],

    "case_ids": \["INC-1001"]

  }

}

```



Use securely generated tokens and keep them out of source control.



## Role Permission Matrix



| Role | Permitted actions |

|---|---|

| Citizen | Create citizen reports |

| Officer | Read and update authorised incidents; perform permitted DPDP operations |

| Supervisor | Read and update authorised incidents; manage staffing; review unmask requests; read audit records |

| Bank | DPDP sanitization and pseudonymization |

| Telecom | DPDP sanitization and pseudonymization |

| Admin | Incident management and permitted DPDP operations |



The authoritative permissions are defined in `backend/app/security.py`.



## Resource-Level Access



Incident access is restricted using configured jurisdiction and case scopes.



\- Administrators have unrestricted incident scope.

\- Other roles must have an applicable jurisdiction or case assignment.

\- Out-of-scope incidents return a not-found response to avoid revealing their existence.

\- Offline synchronization checks incident scope before processing updates.



## Field-Level Redaction



Redaction is centralized in `redact_incident()` in `backend/app/security.py`.



\- Citizen, bank, and telecom responses omit selected sensitive fields.

\- Officer and supervisor responses mask linked account identifiers.

\- Only fields needed for the caller's permitted workflow should be exposed.



## Sensitive Operations and Auditing



DPDP unmasking follows a request-and-review workflow. Sensitive unmasking operations are recorded in the DPDP audit trail.



Access to unmask requests, reviews, reveals, and audit records is controlled by the centralized permission matrix.



## Security Testing



Tests cover incident permissions, incident access, redaction, DPDP sanitization, and offline synchronization.



Run the backend tests from the `backend` directory:



```powershell

python -m pytest -q

```



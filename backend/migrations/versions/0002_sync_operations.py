"""Add offline sync idempotency ledger.

Revision ID: 0002_sync_operations
Revises: 0001_initial
Create Date: 2026-11-14
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_sync_operations"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "sync_operations",
        sa.Column("subject", sa.String(length=128), primary_key=True),
        sa.Column("operation_id", sa.String(length=128), primary_key=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("applied_at", sa.BigInteger(), nullable=False),
    )


def downgrade():
    op.drop_table("sync_operations")

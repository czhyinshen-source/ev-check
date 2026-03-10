# 通信机模型
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CommunicationGroup(Base):
    """通信机分组"""
    __tablename__ = "communication_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    communications: Mapped[list["Communication"]] = relationship(
        "Communication",
        back_populates="group",
        cascade="all, delete-orphan"
    )


class Communication(Base):
    """通信机"""
    __tablename__ = "communications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[Optional[int]] = mapped_column(ForeignKey("communication_groups.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    port: Mapped[int] = mapped_column(Integer, default=22)
    username: Mapped[str] = mapped_column(String(100), default="root")
    password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    private_key_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    group: Mapped[Optional["CommunicationGroup"]] = relationship(
        "CommunicationGroup",
        back_populates="communications"
    )
    snapshot_instances: Mapped[list["SnapshotInstance"]] = relationship(
        "SnapshotInstance",
        back_populates="communication",
        cascade="all, delete-orphan"
    )
    check_results: Mapped[list["CheckResult"]] = relationship(
        "CheckResult",
        back_populates="communication",
        cascade="all, delete-orphan"
    )

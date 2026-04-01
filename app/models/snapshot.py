# 快照模型
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, func, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SnapshotGroup(Base):
    """快照组"""
    __tablename__ = "snapshot_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("snapshot_groups.id", ondelete="CASCADE"),
        nullable=True
    )
    check_item_list_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("check_item_lists.id", ondelete="SET NULL"),
        nullable=True
    )
    default_snapshot_id: Mapped[Optional[int]] = mapped_column(nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    parent: Mapped[Optional["SnapshotGroup"]] = relationship(
        "SnapshotGroup",
        remote_side=[id],
        back_populates="children"
    )
    children: Mapped[list["SnapshotGroup"]] = relationship(
        "SnapshotGroup",
        remote_side=[parent_id],
        back_populates="parent",
        cascade="all, delete-orphan"
    )
    check_item_list: Mapped[Optional["CheckItemList"]] = relationship(
        "CheckItemList",
        back_populates="snapshot_groups"
    )
    snapshots: Mapped[list["Snapshot"]] = relationship(
        "Snapshot",
        back_populates="group",
        cascade="all, delete-orphan"
    )


class Snapshot(Base):
    """快照"""
    __tablename__ = "snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("snapshot_groups.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    snapshot_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    group: Mapped["SnapshotGroup"] = relationship(
        "SnapshotGroup",
        back_populates="snapshots"
    )
    instances: Mapped[list["SnapshotInstance"]] = relationship(
        "SnapshotInstance",
        back_populates="snapshot",
        cascade="all, delete-orphan"
    )
    build_tasks: Mapped[list["SnapshotBuildTask"]] = relationship(
        "SnapshotBuildTask",
        back_populates="snapshot",
        cascade="all, delete-orphan"
    )


class SnapshotInstance(Base):
    """快照实例"""
    __tablename__ = "snapshot_instances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("snapshots.id", ondelete="CASCADE"), nullable=False)
    communication_id: Mapped[int] = mapped_column(ForeignKey("communications.id", ondelete="CASCADE"), nullable=False)
    check_item_list_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("check_item_lists.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    snapshot: Mapped["Snapshot"] = relationship(
        "Snapshot",
        back_populates="instances"
    )
    communication: Mapped["Communication"] = relationship(
        "Communication",
        back_populates="snapshot_instances"
    )
    environment_data: Mapped[list["EnvironmentData"]] = relationship(
        "EnvironmentData",
        back_populates="snapshot_instance",
        cascade="all, delete-orphan"
    )


class EnvironmentData(Base):
    """环境数据"""
    __tablename__ = "environment_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    snapshot_instance_id: Mapped[int] = mapped_column(
        ForeignKey("snapshot_instances.id", ondelete="CASCADE"),
        nullable=False
    )
    check_item_id: Mapped[int] = mapped_column(ForeignKey("check_items.id", ondelete="CASCADE"), nullable=False)
    data_value: Mapped[dict] = mapped_column(JSON, nullable=False)
    checksum: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    snapshot_instance: Mapped["SnapshotInstance"] = relationship(
        "SnapshotInstance",
        back_populates="environment_data"
    )
    check_item: Mapped["CheckItem"] = relationship(
        "CheckItem",
        back_populates="environment_data"
    )


from app.models.communication import Communication
from app.models.check_item import CheckItemList
from app.models.check_result import CheckRule

SnapshotGroup.check_item_list = relationship("CheckItemList", back_populates="snapshot_groups")


class SnapshotBuildTask(Base):
    """快照构建任务"""
    __tablename__ = "snapshot_build_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("snapshots.id", ondelete="CASCADE"),
        nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="pending")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    total_groups: Mapped[int] = mapped_column(Integer, default=0)
    completed_groups: Mapped[int] = mapped_column(Integer, default=0)
    total_communications: Mapped[int] = mapped_column(Integer, default=0)
    completed_communications: Mapped[int] = mapped_column(Integer, default=0)
    current_communication: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    build_config: Mapped[dict] = mapped_column(JSON, default=dict)

    snapshot: Mapped["Snapshot"] = relationship(
        "Snapshot",
        back_populates="build_tasks"
    )

# 检查结果模型
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CheckRule(Base):
    """检查规则"""
    __tablename__ = "check_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    check_item_list_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("check_item_lists.id", ondelete="SET NULL"),
        nullable=True
    )
    snapshot_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("snapshots.id", ondelete="SET NULL"),
        nullable=True
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    check_item_list: Mapped[Optional["CheckItemList"]] = relationship(
        "CheckItemList",
        back_populates="check_rules"
    )
    snapshot: Mapped[Optional["Snapshot"]] = relationship(
        "Snapshot",
        back_populates="check_rules"
    )
    check_results: Mapped[list["CheckResult"]] = relationship(
        "CheckResult",
        back_populates="rule",
        cascade="all, delete-orphan"
    )
    scheduled_tasks: Mapped[list["ScheduledTask"]] = relationship(
        "ScheduledTask",
        back_populates="rule",
        cascade="all, delete-orphan"
    )


class CheckResult(Base):
    """检查结果"""
    __tablename__ = "check_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rule_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("check_rules.id", ondelete="SET NULL"),
        nullable=True
    )
    communication_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("communications.id", ondelete="SET NULL"),
        nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    rule: Mapped[Optional["CheckRule"]] = relationship(
        "CheckRule",
        back_populates="check_results"
    )
    communication: Mapped[Optional["Communication"]] = relationship(
        "Communication",
        back_populates="check_results"
    )
    details: Mapped[list["CheckResultDetail"]] = relationship(
        "CheckResultDetail",
        back_populates="result",
        cascade="all, delete-orphan"
    )


class CheckResultDetail(Base):
    """检查结果详情"""
    __tablename__ = "check_result_details"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    result_id: Mapped[int] = mapped_column(ForeignKey("check_results.id", ondelete="CASCADE"), nullable=False)
    check_item_id: Mapped[int] = mapped_column(ForeignKey("check_items.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    expected_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    actual_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    result: Mapped["CheckResult"] = relationship(
        "CheckResult",
        back_populates="details"
    )
    check_item: Mapped["CheckItem"] = relationship(
        "CheckItem",
        back_populates="check_result_details"
    )


class ScheduledTask(Base):
    """定时任务"""
    __tablename__ = "scheduled_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    rule_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("check_rules.id", ondelete="SET NULL"),
        nullable=True
    )
    cron_expression: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    rule: Mapped[Optional["CheckRule"]] = relationship(
        "CheckRule",
        back_populates="scheduled_tasks"
    )


from app.models.communication import Communication
from app.models.check_item import CheckItemList
from app.models.snapshot import Snapshot

CheckRule.check_item_list = relationship("CheckItemList", back_populates="check_rules")
CheckRule.snapshot = relationship("Snapshot", back_populates="check_rules")
CheckResult.communication = relationship("Communication", back_populates="check_results")

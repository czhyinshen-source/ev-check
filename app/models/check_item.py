# 检查项模型
from datetime import datetime
from typing import Optional, Union

from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CheckItem(Base):
    """检查项"""
    __tablename__ = "check_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[Optional[Union[str, list]]] = mapped_column(String(500), nullable=True)
    target_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    check_attributes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    environment_data: Mapped[list["EnvironmentData"]] = relationship(
        "EnvironmentData",
        back_populates="check_item",
        cascade="all, delete-orphan"
    )
    check_result_details: Mapped[list["CheckResultDetail"]] = relationship(
        "CheckResultDetail",
        back_populates="check_item",
        cascade="all, delete-orphan"
    )


class CheckItemList(Base):
    """检查项列表"""
    __tablename__ = "check_item_lists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    items: Mapped[list["CheckItem"]] = relationship(
        "CheckItem",
        secondary="check_item_list_items",
        back_populates="check_item_lists"
    )
    snapshot_groups: Mapped[list["SnapshotGroup"]] = relationship(
        "SnapshotGroup",
        back_populates="check_item_list",
        cascade="all, delete-orphan"
    )
    check_rules: Mapped[list["CheckRule"]] = relationship(
        "CheckRule",
        back_populates="check_item_list",
        cascade="all, delete-orphan"
    )


class CheckItemListItem(Base):
    """检查项列表关联表"""
    __tablename__ = "check_item_list_items"

    list_id: Mapped[int] = mapped_column(
        ForeignKey("check_item_lists.id", ondelete="CASCADE"),
        primary_key=True
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("check_items.id", ondelete="CASCADE"),
        primary_key=True
    )


CheckItem.check_item_lists = relationship(
    "CheckItemList",
    secondary="check_item_list_items",
    back_populates="items"
)

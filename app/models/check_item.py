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
    type: Mapped[Optional[Union[str, list]]] = mapped_column(JSON, nullable=True)
    target_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    check_attributes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # 所属检查项列表（一对多关系）
    list_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("check_item_lists.id", ondelete="SET NULL"),
        nullable=True
    )
    # 列表内序号
    order_index: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关系
    check_item_list: Mapped[Optional["CheckItemList"]] = relationship(
        "CheckItemList",
        back_populates="items"
    )
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

    # 一对多关系：一个列表包含多个检查项
    items: Mapped[list["CheckItem"]] = relationship(
        "CheckItem",
        back_populates="check_item_list",
        cascade="all, delete-orphan",
        order_by="CheckItem.order_index"
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

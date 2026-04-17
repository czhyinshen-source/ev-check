from datetime import datetime
from zoneinfo import ZoneInfo
from app.config import settings

def get_now() -> datetime:
    """
    获取当前时区的识别时间（Aware DateTime）。
    默认使用 Asia/Shanghai。
    """
    return datetime.now(ZoneInfo(settings.TIMEZONE))

def format_datetime(dt: datetime) -> str:
    """格式化时间为标准字符串"""
    if dt is None:
        return "-"
    return dt.strftime("%Y-%m-%d %H:%M:%S")

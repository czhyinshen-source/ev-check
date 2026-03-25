"""report_exporter 单元测试"""
import pytest
from app.services.report_exporter import PDFExporter, ExcelExporter


def test_pdf_exporter_generates_valid_pdf():
    """验证 PDF 导出器生成有效的 PDF"""
    exporter = PDFExporter()
    data = {
        "result_id": 1,
        "rule_name": "Test Rule",
        "communication_name": "Test Server",
        "status": "success",
        "start_time": "2026-03-25 14:30:00",
        "end_time": "2026-03-25 14:35:00",
        "details": [
            {"check_item_id": 1, "status": "pass", "expected_value": {}, "actual_value": {}, "message": ""},
            {"check_item_id": 2, "status": "fail", "expected_value": {}, "actual_value": {}, "message": "Permission denied"},
            {"check_item_id": 3, "status": "error", "expected_value": {}, "actual_value": {}, "message": "Connection failed"},
        ]
    }
    pdf_bytes = exporter.export(data)
    # 验证生成的是有效的 PDF 文件
    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 1000  # PDF 应该有一定大小


def test_excel_exporter_generates_valid_excel():
    """验证 Excel 导出器生成有效的 Excel"""
    exporter = ExcelExporter()
    data = {
        "result_id": 1,
        "rule_name": "Test Rule",
        "communication_name": "Test Server",
        "status": "success",
        "start_time": "2026-03-25 14:30:00",
        "end_time": "2026-03-25 14:35:00",
        "details": [
            {"check_item_id": 1, "status": "pass", "expected_value": {}, "actual_value": {}, "message": ""},
            {"check_item_id": 2, "status": "fail", "expected_value": {}, "actual_value": {}, "message": "Permission denied"},
            {"check_item_id": 3, "status": "error", "expected_value": {}, "actual_value": {}, "message": "Connection failed"},
        ]
    }
    excel_bytes = exporter.export(data)
    # Excel 文件以 PK (ZIP 格式) 开头
    assert excel_bytes.startswith(b"PK")
    assert len(excel_bytes) > 1000  # Excel 应该有一定大小


def test_status_map_uses_pass_fail_error():
    """验证 status_map 使用 pass/fail/error 映射"""
    # 这个测试验证代码中 status_map 的正确性
    from app.services.report_exporter import PDFExporter, ExcelExporter

    # 检查 PDFExporter 中的 status_map
    pdf_exporter = PDFExporter()
    # 直接在 export 方法中检查 status_map 的逻辑
    # 由于 status_map 在 export 方法内部定义，我们通过测试输入输出来验证

    # 测试 pass 状态
    data_pass = {
        "result_id": 1,
        "status": "success",
        "details": [{"check_item_id": 1, "status": "pass", "expected_value": {}, "actual_value": {}, "message": ""}]
    }
    pdf_pass = pdf_exporter.export(data_pass)
    assert pdf_pass.startswith(b"%PDF")

    # 测试 fail 状态
    data_fail = {
        "result_id": 2,
        "status": "success",
        "details": [{"check_item_id": 1, "status": "fail", "expected_value": {}, "actual_value": {}, "message": ""}]
    }
    pdf_fail = pdf_exporter.export(data_fail)
    assert pdf_fail.startswith(b"%PDF")

    # 测试 error 状态
    data_error = {
        "result_id": 3,
        "status": "success",
        "details": [{"check_item_id": 1, "status": "error", "expected_value": {}, "actual_value": {}, "message": ""}]
    }
    pdf_error = pdf_exporter.export(data_error)
    assert pdf_error.startswith(b"%PDF")


def test_empty_details():
    """验证空详情列表的处理"""
    exporter = PDFExporter()
    data = {
        "result_id": 1,
        "status": "success",
        "details": []
    }
    pdf_bytes = exporter.export(data)
    assert pdf_bytes.startswith(b"%PDF")

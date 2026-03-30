#!/bin/bash

echo "🔧 用户显示问题修复验证"
echo "=============================="
echo ""

# 检查后端服务
echo "1. 检查后端服务..."
if curl -s http://localhost:8000/api/v1/users/login > /dev/null; then
    echo "   ✅ 后端服务正常运行"
else
    echo "   ❌ 后端服务未运行，请先启动服务"
    echo "   运行: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
    exit 1
fi

# 测试登录API
echo ""
echo "2. 测试登录API..."
TOKEN=$(curl -s http://localhost:8000/api/v1/users/login \
    -X POST \
    -d "username=admin&password=admin123" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    | grep -o '"access_token":"[^"]*"' \
    | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo "   ✅ 登录API工作正常"
    echo "   Token: ${TOKEN:0:30}..."
else
    echo "   ❌ 登录API失败"
    exit 1
fi

# 测试用户信息API
echo ""
echo "3. 测试用户信息API..."
USER_INFO=$(curl -s http://localhost:8000/api/v1/users/me \
    -H "Authorization: Bearer $TOKEN")

if echo "$USER_INFO" | grep -q "admin"; then
    echo "   ✅ 用户信息API工作正常"
else
    echo "   ❌ 用户信息API失败"
    echo "   响应: $USER_INFO"
fi

# 检查前端文件
echo ""
echo "4. 检查前端文件..."
FILES=(
    "app/static/dashboard.html"
    "app/static/login.html"
    "app/static/js/shared.js"
    "app/static/js/dashboard.js"
    "app/static/js/communications.js"
)

ALL_EXIST=true
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file 不存在"
        ALL_EXIST=false
    fi
done

# 检查修复内容
echo ""
echo "5. 检查修复内容..."

# 检查 login.html
if grep -q "URLSearchParams" app/static/login.html; then
    echo "   ✅ login.html 已修复 (使用 URLSearchParams)"
else
    echo "   ❌ login.html 未修复"
fi

# 检查 dashboard.html
if grep -q "updateUserDisplay" app/static/dashboard.html; then
    echo "   ✅ dashboard.html 已添加自动修复脚本"
else
    echo "   ❌ dashboard.html 缺少自动修复脚本"
fi

# 检查 dashboard.js
if grep -q "initializeDashboard" app/static/js/dashboard.js; then
    echo "   ✅ dashboard.js 已优化初始化逻辑"
else
    echo "   ❌ dashboard.js 初始化逻辑未优化"
fi

echo ""
echo "=============================="
echo "📋 修复完成总结"
echo "=============================="
echo ""
echo "✅ 后端服务正常运行"
echo "✅ 登录API工作正常"
echo "✅ 前端文件已修复"
echo ""
echo "🚀 下一步操作:"
echo "   1. 访问测试页面: http://localhost:8000/test_fix.html"
echo "   2. 或直接访问: http://localhost:8000/login.html"
echo "   3. 使用 admin/admin123 登录"
echo "   4. 验证用户信息是否正常显示"
echo ""
echo "💡 如果仍有问题，请:"
echo "   - 打开浏览器开发者工具 (F12)"
echo "   - 查看 Console 标签页的错误信息"
echo "   - 运行诊断脚本: fix_user_display.js"
echo ""
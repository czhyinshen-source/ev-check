#!/bin/bash
echo "重启后端服务..."

# 停止现有的 uvicorn 进程
pkill -f "uvicorn app.main:app"

# 等待进程停止
sleep 2

# 启动后端
cd /Users/chenzhihui/Documents/trae_projects/ev_check
source .venv/bin/activate
nohup uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 &

echo "后端服务已重启"
echo "日志文件: /tmp/uvicorn.log"
echo "等待服务启动..."
sleep 3
echo "完成！"

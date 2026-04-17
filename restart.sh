#!/bin/zsh  
export TZ='Asia/Shanghai'
# 进入项目目录
cd /Users/chenzhihui/Documents/trae_projects/ev_check

# 激活虚拟环境
source .venv/bin/activate

# 停止旧进程
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "celery.*worker" 2>/dev/null || true
pkill -f "celery.*beat" 2>/dev/null || true

# 等待进程结束
sleep 2

# 创建日志目录
mkdir -p logs

# 启动 Web 服务
nohup uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > logs/web.log 2>&1 &
echo "Web 服务已启动 (PID: $!)"

# 等待服务就绪
sleep 3

# 启动 Celery Worker
nohup celery -A app.celery_config worker --loglevel=info > logs/celery_worker.log 2>&1 &
echo "Celery Worker 已启动 (PID: $!)"

# 启动 Celery Beat
nohup celery -A app.celery_config beat --loglevel=info > logs/celery_beat.log 2>&1 &
echo "Celery Beat 已启动 (PID: $!)"

# 验证服务
echo ""
echo "验证服务状态:"
curl -s http://localhost:8000/health
echo ""

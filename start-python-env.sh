#!/bin/bash

# 设置错误时退出
set -e

# 进入项目目录
cd /var/www/html/LingFlow/app/api/python

# 确保虚拟环境存在
if [ ! -d "venv" ]; then
    echo "错误: 虚拟环境不存在"
    exit 1
fi

# 激活虚拟环境
source venv/bin/activate

# 进入项目目录
cd /var/www/html/LingFlow

# 删除旧的构建文件
echo "清理旧的构建文件..."
rm -rf build/*

# 重新构建前端
echo "开始重新构建前端..."
npm run build

# 确保激活成功
if [ -z "$VIRTUAL_ENV" ]; then
    echo "错误: 虚拟环境激活失败"
    exit 1
fi

# 启动应用
echo "启动应用..."
npm start
exec "$@"